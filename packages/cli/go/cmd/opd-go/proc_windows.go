//go:build windows
// +build windows

package main

import (
    "fmt"
    "os/exec"
)

// setProcessGroup is a no-op on Windows for now. Job Objects would be ideal,
// but for simplicity we use taskkill for tree termination.
func setProcessGroup(cmd *exec.Cmd) {
    // no-op
}

// killProcessTree uses `taskkill /T /F` to terminate the full process tree.
func killProcessTree(cmd *exec.Cmd) {
    if cmd == nil || cmd.Process == nil {
        return
    }
    _ = exec.Command("taskkill", "/T", "/F", "/PID", fmt.Sprintf("%d", cmd.Process.Pid)).Run()
}
