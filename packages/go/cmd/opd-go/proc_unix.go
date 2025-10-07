//go:build !windows
// +build !windows

package main

import (
    "os/exec"
    "syscall"
    "time"
)

// setProcessGroup ensures the spawned process is placed into its own
// process group so we can signal the entire group on termination.
func setProcessGroup(cmd *exec.Cmd) {
    if cmd == nil {
        return
    }
    if cmd.SysProcAttr == nil {
        cmd.SysProcAttr = &syscall.SysProcAttr{}
    }
    cmd.SysProcAttr.Setpgid = true
}

// killProcessTree best-effort terminates the full process tree by
// signaling the process group: first SIGTERM, then SIGKILL.
func killProcessTree(cmd *exec.Cmd) {
    if cmd == nil || cmd.Process == nil {
        return
    }
    pgid := cmd.Process.Pid
    // Try TERM then KILL
    _ = syscall.Kill(-pgid, syscall.SIGTERM)
    time.Sleep(500 * time.Millisecond)
    _ = syscall.Kill(-pgid, syscall.SIGKILL)
}
