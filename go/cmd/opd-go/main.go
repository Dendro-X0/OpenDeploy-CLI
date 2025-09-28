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
)

type runRequest struct {
	Action          string            `json:"action"`
	Cmd             string            `json:"cmd"`
	Cwd             string            `json:"cwd,omitempty"`
	TimeoutSec      int               `json:"timeoutSec,omitempty"`
	IdleTimeoutSec  int               `json:"idleTimeoutSec,omitempty"`
	Env             map[string]string `json:"env,omitempty"`
}

type ndjsonEvent struct {
	Action string                 `json:"action"`
	Event  string                 `json:"event"`
	Data   string                 `json:"data,omitempty"`
	OK     *bool                  `json:"ok,omitempty"`
	Exit   *int                   `json:"exitCode,omitempty"`
	Final  *bool                  `json:"final,omitempty"`
	Error  string                 `json:"error,omitempty"`
	Extra  map[string]interface{} `json:"extra,omitempty"`
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
	// Attach pipes
	stderrPipe, _ := cmd.StderrPipe()
	stdoutPipe, _ := cmd.StdoutPipe()

	// Start
	if err := cmd.Start(); err != nil {
		ok := false
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()})
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: intPtr(1), Final: boolPtr(true)})
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
					_ = cmd.Process.Kill()
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
	select {
	case <-ctx.Done():
		_ = cmd.Process.Kill()
		err := ctx.Err()
		ok = false
		exitCode = 124
		writeEvent(stdout, ndjsonEvent{Action: "go", Event: "error", Error: err.Error()})
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
	writeEvent(stdout, ndjsonEvent{Action: "go", Event: "done", OK: &ok, Exit: &exitCode, Final: boolPtr(true)})
	return 0
}

func intPtr(i int) *int       { return &i }
func boolPtr(b bool) *bool    { return &b }

func main() {
	dec := json.NewDecoder(os.Stdin)
	var req runRequest
	if err := dec.Decode(&req); err != nil {
		fmt.Fprintln(os.Stderr, "invalid JSON request:", err)
		os.Exit(2)
	}
	if req.Action == "run-stream" || req.Action == "run" {
		_ = runStream(req, os.Stdout)
		return
	}
	fmt.Fprintln(os.Stderr, "unknown action")
	os.Exit(2)
}
