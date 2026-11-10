//go:build !mygo_noinspector

package main

// Opt-in through MYGO_AUTOMATION for development smoke tests only.
// Release builds exclude this file and expose no automation socket.
import _ "github.com/egoist/mygo/plugins/automation"
