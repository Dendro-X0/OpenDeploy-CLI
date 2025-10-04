package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
	"path/filepath"
	"archive/zip"
	"archive/tar"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"crypto/sha1"
	"net/http"
	"bytes"
	"io/fs"
	"net/url"
)

type runRequest struct {
	Action          string            `json:"action"`
	Cmd             string            `json:"cmd"`
	Cwd             string            `json:"cwd,omitempty"`
	TimeoutSec      int               `json:"timeoutSec,omitempty"`
	IdleTimeoutSec  int               `json:"idleTimeoutSec,omitempty"`
	Env             map[string]string `json:"env,omitempty"`
	// Packaging / checksum fields
	Src             string            `json:"src,omitempty"`
	Dest            string            `json:"dest,omitempty"`
	Algo            string            `json:"algo,omitempty"`
	TarGz           bool              `json:"targz,omitempty"`
	Prefix          string            `json:"prefix,omitempty"`
	// PTY
	Pty             bool              `json:"pty,omitempty"`
	Cols            int               `json:"cols,omitempty"`
	Rows            int               `json:"rows,omitempty"`
	// Netlify direct deploy
	Site            string            `json:"site,omitempty"`
	Prod            bool              `json:"prod,omitempty"`
}

// runStreamPTY is provided by pty_run.go (with build tag) or falls back to non-PTY in pty_stub.go.

type ndjsonEvent struct {
	Action string                 `json:"action"`
	Event  string                 `json:"event"`
	Data   string                 `json:"data,omitempty"`
	OK     *bool                  `json:"ok,omitempty"`
	Exit   *int                   `json:"exitCode,omitempty"`
	Final  *bool                  `json:"final,omitempty"`
	Error  string                 `json:"error,omitempty"`
	Extra  map[string]interface{} `json:"extra,omitempty"`
	Reason string                 `json:"reason,omitempty"`
}

func writeEvent(w io.Writer, ev ndjsonEvent) {
	enc, _ := json.Marshal(ev)
	_, _ = w.Write(enc)
	_, _ = w.Write([]byte("\n"))
}

func shellCommand(cmdline string) *exec.Cmd {
	if cmdline == "" {
		return exec.Command("sh", "-c", ":")
	}
	if runtime.GOOS == "windows" {
		return exec.Command("cmd.exe", "/d", "/s", "/c", cmdline)
	}
	return exec.Command("/bin/sh", "-c", cmdline)
}

func runStream(req runRequest, stdout io.Writer) int {
	ctx := context.Background()
	if req.TimeoutSec > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(req.TimeoutSec)*time.Second)
		defer cancel()
	}
	cmd := shellCommand(req.Cmd)
	if req.Cwd != "" {
		cmd.Dir = req.Cwd
	}
	if req.Env != nil {
		env := os.Environ()
		for k, v := range req.Env {
			if k == "" { continue }
			env = append(env, fmt.Sprintf("%s=%s", k, v))
		}
		cmd.Env = env
	}
	// Ensure subprocesses share a process group on platforms that support it.
	setProcessGroup(cmd)
	// Attach pipes
	stderrPipe, _ := cmd.StderrPipe()
	stdoutPipe, _ := cmd.StdoutPipe()

	// Start
	if err := cmd.Start(); err != nil {
		ok := false
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error(), Reason: "start-failed"})
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true), Reason: "start-failed"})
		return 1
	}

	lastActivity := time.Now()
	emit := func(ev ndjsonEvent) { writeEvent(stdout, ev); lastActivity = time.Now() }

	heartbeatInterval := 5 * time.Second
	heartbeatTicker := time.NewTicker(heartbeatInterval)
	defer heartbeatTicker.Stop()

	go func() {
		for range heartbeatTicker.C {
			emit(ndjsonEvent{
				Action: "go",
				Event: "status",
				Data: fmt.Sprintf("running, last activity: %s", lastActivity.Format(time.RFC3339)),
			})
		}
	}()

	// Readers
	read := func(r io.Reader, kind string) {
		s := bufio.NewScanner(r)
		s.Buffer(make([]byte, 0, 64*1024), 1_000_000)
		for s.Scan() {
			line := strings.TrimRight(s.Text(), "\r\n")
			if line != "" {
				emit(ndjsonEvent{Action: "go", Event: kind, Data: line})
			}
		}
	}

	// Idle timeout watchdog
	idle := req.IdleTimeoutSec
	var idleTicker *time.Ticker
	if idle > 0 {
		idleTicker = time.NewTicker(2 * time.Second)
		defer idleTicker.Stop()
		go func() {
			for range idleTicker.C {
				if time.Since(lastActivity) > time.Duration(idle)*time.Second {
					killProcessTree(cmd)
					return
				}
			}
		}()
	}

	doneCh := make(chan error, 1)
	go func() { doneCh <- cmd.Wait() }()
	go read(stdoutPipe, "stdout")
	go read(stderrPipe, "stderr")

	var exitCode int = 0
	ok := true
	var reason string = ""
	select {
	case <-ctx.Done():
		killProcessTree(cmd)
		err := ctx.Err()
		ok = false
		exitCode = 124
		reason = "timeout"
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error(), Reason: reason})
	case err := <-doneCh:
		if err != nil {
			ok = false
			var ex *exec.ExitError
			if errors.As(err, &ex) && ex.ProcessState != nil {
				exitCode = ex.ProcessState.ExitCode()
			} else {
				exitCode = 1
			}
		}
	}
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: &exitCode, Final: boolPtr(true), Reason: reason})
	return 0
}

func intPtr(i int) *int       { return &i }
func boolPtr(b bool) *bool    { return &b }

func main() {
	// Protocol handshake (v1)
	writeEvent(os.Stdout, ndjsonEvent{Action: "go", Event: "hello", Extra: map[string]interface{}{"protocolVersion": "1", "goVersion": runtime.Version()}})
	dec := json.NewDecoder(os.Stdin)
	var req runRequest
	if err := dec.Decode(&req); err != nil {
		fmt.Fprintln(os.Stderr, "invalid JSON request:", err)
		os.Exit(2)
	}
	switch req.Action {
	case "run-stream", "run":
		if req.Pty {
			_ = runStreamPTY(req, os.Stdout)
		} else {
			_ = runStream(req, os.Stdout)
		}
		return
	case "zip-dir":
		ok := zipDir(req.Src, req.Dest, req.Prefix, os.Stdout)
		if !ok { os.Exit(1) }
		return
	case "tar-dir":
		ok := tarDir(req.Src, req.Dest, req.Prefix, req.TarGz, os.Stdout)
		if !ok { os.Exit(1) }
		return
	case "checksum-file":
		ok := checksumFile(req.Src, req.Algo, os.Stdout)
		if !ok { os.Exit(1) }
		return
	case "netlify-deploy-dir":
		ok := netlifyDeployDir(req, os.Stdout)
		if !ok { os.Exit(1) }
		return
	default:
		fmt.Fprintln(os.Stderr, "unknown action")
		os.Exit(2)
	}
}

type nlCreateReq struct {
    Files map[string]string `json:"files"`
    Draft bool              `json:"draft"`
}
type nlCreateResp struct {
    ID        string   `json:"id"`
    Required  []string `json:"required"`
    DeployURL string   `json:"deploy_url"`
    DeploySSL string   `json:"deploy_ssl_url"`
    SSLURL    string   `json:"ssl_url"`
    URL       string   `json:"url"`
}
type nlGetResp struct {
    ID        string `json:"id"`
    State     string `json:"state"`
    DeployURL string `json:"deploy_url"`
    DeploySSL string `json:"deploy_ssl_url"`
    SSLURL    string `json:"ssl_url"`
    URL       string `json:"url"`
}

func netlifyDeployDir(req runRequest, stdout io.Writer) bool {
    src := req.Src
    site := req.Site
    if src == "" || site == "" {
        ok := false
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "netlify-deploy-dir: src and site required"})
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true), Reason: "invalid-args"})
        return false
    }
    token := os.Getenv("NETLIFY_AUTH_TOKEN")
    if token == "" {
        ok := false
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "NETLIFY_AUTH_TOKEN not set"})
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true), Reason: "auth"})
        return false
    }
    writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: "hashing"})
    files := map[string]string{}
    // Build SHA1 map
    walkErr := filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
        if err != nil { return err }
        if d.IsDir() { return nil }
        rel, rerr := filepath.Rel(src, path)
        if rerr != nil { return rerr }
        // Netlify requires paths starting with '/'
        rel = "/" + filepath.ToSlash(rel)
        f, oerr := os.Open(path)
        if oerr != nil { return oerr }
        h := sha1.New()
        if _, cerr := io.Copy(h, f); cerr != nil { _ = f.Close(); return cerr }
        _ = f.Close()
        files[rel] = fmt.Sprintf("%x", h.Sum(nil))
        return nil
    })
    if walkErr != nil {
        ok := false
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: walkErr.Error()})
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)})
        return false
    }
    // Create deploy
    writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: "creating"})
    body, _ := json.Marshal(nlCreateReq{Files: files, Draft: false})
    api := "https://api.netlify.com"
    createURL := fmt.Sprintf("%s/api/v1/sites/%s/deploys", api, site)
    reqHttp, _ := http.NewRequest("POST", createURL, bytes.NewReader(body))
    reqHttp.Header.Set("Authorization", "Bearer "+token)
    reqHttp.Header.Set("Content-Type", "application/json")
    httpc := &http.Client{Timeout: 60 * time.Second}
    resp, err := httpc.Do(reqHttp)
    if err != nil { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
    defer resp.Body.Close()
    if resp.StatusCode/100 != 2 {
        b, _ := io.ReadAll(resp.Body)
        ok := false
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: fmt.Sprintf("create deploy failed: %s", strings.TrimSpace(string(b)))})
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)})
        return false
    }
    var created nlCreateResp
    _ = json.NewDecoder(resp.Body).Decode(&created)
    deployID := created.ID
    // Upload required files
    if len(created.Required) > 0 {
        writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: fmt.Sprintf("uploading %d", len(created.Required))})
    }
    for _, p := range created.Required {
        full := filepath.Join(src, filepath.FromSlash(strings.TrimPrefix(p, "/")))
        rf, oerr := os.Open(full)
        if oerr != nil { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: oerr.Error()}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
        putURL := fmt.Sprintf("%s/api/v1/deploys/%s/files/%s", api, deployID, url.PathEscape(strings.TrimPrefix(p, "/")))
        preq, _ := http.NewRequest("PUT", putURL, rf)
        preq.Header.Set("Authorization", "Bearer "+token)
        preq.Header.Set("Content-Type", "application/octet-stream")
        pr, perr := httpc.Do(preq)
        _ = rf.Close()
        if perr != nil { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: perr.Error()}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
        _ = pr.Body.Close()
        if pr.StatusCode/100 != 2 { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: fmt.Sprintf("upload failed for %s", p)}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
    }
    // Poll for ready state
    writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: "finalizing"})
    var final nlGetResp
    pollURL := fmt.Sprintf("%s/api/v1/deploys/%s", api, deployID)
    deadline := time.Now().Add(2 * time.Minute)
    for {
        if time.Now().After(deadline) { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "timeout"}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(124), Final: boolPtr(true), Reason: "timeout"}); return false }
        greq, _ := http.NewRequest("GET", pollURL, nil)
        greq.Header.Set("Authorization", "Bearer "+token)
        gr, gerr := httpc.Do(greq)
        if gerr != nil { time.Sleep(1500 * time.Millisecond); continue }
        if gr.StatusCode/100 != 2 { _ = gr.Body.Close(); time.Sleep(1500 * time.Millisecond); continue }
        _ = json.NewDecoder(gr.Body).Decode(&final)
        _ = gr.Body.Close()
        if final.State == "ready" || final.State == "current" { break }
        if final.State == "error" { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "deploy error"}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
        time.Sleep(1500 * time.Millisecond)
    }
    // Determine URLs
    url := firstNonEmpty(final.DeploySSL, final.SSLURL, final.URL, created.DeploySSL, created.SSLURL, created.URL)
    logs := fmt.Sprintf("https://app.netlify.com/sites/%s/deploys/%s", site, deployID)
    ok := true
    writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(0), Final: boolPtr(true), Extra: map[string]interface{}{"url": url, "logsUrl": logs, "deployId": deployID}})
    return true
}

func firstNonEmpty(vals ...string) string {
    for _, v := range vals { if strings.TrimSpace(v) != "" { return v } }
    return ""
}

func zipDir(src, dest, prefix string, stdout io.Writer) bool {
	if src == "" || dest == "" {
		ok := false
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "zip-dir: src and dest required"})
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true), Reason: "invalid-args"})
		return false
	}
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: "zipping"})
	f, err := os.Create(dest)
	if err != nil {
		ok := false
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()})
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)})
		return false
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()
	// Walk src
	err = filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil { return err }
		rel, rerr := filepath.Rel(src, path)
		if rerr != nil { return rerr }
		// Skip root
		if rel == "." { return nil }
		name := filepath.ToSlash(filepath.Join(prefix, rel))
		if d.IsDir() {
			// Ensure directory entries end with /
			if !strings.HasSuffix(name, "/") { name += "/" }
			_, werr := zw.Create(name)
			return werr
		}
		// File entry
		info, ierr := d.Info()
		if ierr != nil { return ierr }
		hdr, herr := zip.FileInfoHeader(info)
		if herr != nil { return herr }
		hdr.Name = name
		hdr.Method = zip.Deflate
		w, cerr := zw.CreateHeader(hdr)
		if cerr != nil { return cerr }
		rf, oerr := os.Open(path)
		if oerr != nil { return oerr }
		defer rf.Close()
		if _, werr := io.Copy(w, rf); werr != nil { return werr }
		return nil
	})
	ok := err == nil
	if !ok { writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()}) }
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(map[bool]int{true:0,false:1}[ok]), Final: boolPtr(true), Extra: map[string]interface{}{"dest": dest}})
	return ok
}

// tarDir creates a tar (optionally gzipped) archive of src at dest.
func tarDir(src, dest, prefix string, gz bool, stdout io.Writer) bool {
	if src == "" || dest == "" {
		ok := false
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "tar-dir: src and dest required"})
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true), Reason: "invalid-args"})
		return false
	}
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: "tarring"})
	f, err := os.Create(dest)
	if err != nil {
		ok := false
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()})
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)})
		return false
	}
	defer f.Close()
	var tw *tar.Writer
	var gw *gzip.Writer
	var out io.Writer = f
	if gz {
		gw = gzip.NewWriter(f)
		defer gw.Close()
		out = gw
	}
	tw = tar.NewWriter(out)
	defer tw.Close()
	err = filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil { return err }
		rel, rerr := filepath.Rel(src, path)
		if rerr != nil { return rerr }
		if rel == "." { return nil }
		name := filepath.ToSlash(filepath.Join(prefix, rel))
		info, ierr := d.Info()
		if ierr != nil { return ierr }
		hdr, herr := tar.FileInfoHeader(info, "")
		if herr != nil { return herr }
		hdr.Name = name
		if err := tw.WriteHeader(hdr); err != nil { return err }
		if d.IsDir() { return nil }
		rf, oerr := os.Open(path)
		if oerr != nil { return oerr }
		defer rf.Close()
		if _, cerr := io.Copy(tw, rf); cerr != nil { return cerr }
		return nil
	})
	ok := err == nil
	if !ok { writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()}) }
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(map[bool]int{true:0,false:1}[ok]), Final: boolPtr(true), Extra: map[string]interface{}{"dest": dest}})
	return ok
}

// checksumFile computes a file digest (sha256 default) and emits it.
func checksumFile(path, algo string, stdout io.Writer) bool {
	if path == "" { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "checksum-file: src required"}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true), Reason: "invalid-args"}); return false }
	if algo == "" { algo = "sha256" }
	if strings.ToLower(algo) != "sha256" { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: "unsupported algo"}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
	f, err := os.Open(path)
	if err != nil { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil { ok := false; writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()}); writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)}); return false }
	sum := hex.EncodeToString(h.Sum(nil))
	ok := true
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "status", Data: "checksum"})
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(0), Final: boolPtr(true), Extra: map[string]interface{}{"algo": "sha256", "digest": sum}})
	return ok
}
