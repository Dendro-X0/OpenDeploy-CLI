package main

import "io"

// runStreamPTY is a fallback that executes without a PTY when PTY
// implementation is unavailable. It preserves the public contract.
func runStreamPTY(req runRequest, stdout io.Writer) int {
    return runStream(req, stdout)
}
