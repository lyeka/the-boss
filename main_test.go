package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExportValidation(t *testing.T) {
	for _, data := range []string{"", "not json", strings.Repeat(" ", maxSaveBytes+1)} {
		if validateSave(data) == nil {
			t.Fatal("invalid or oversized input accepted")
		}
	}
	if err := validateSave(`{"revision":42}`); err != nil {
		t.Fatal(err)
	}
}

func TestSaveReplacement(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "save.json")
	for _, data := range []string{`{"revision":1}`, `{"revision":2}`} {
		if err := writeSave(path, data); err != nil {
			t.Fatal(err)
		}
		got, err := os.ReadFile(path)
		if err != nil || string(got) != data {
			t.Fatalf("save mismatch: %q %v", got, err)
		}
	}
	files, _ := os.ReadDir(dir)
	if len(files) != 1 {
		t.Fatal("temporary save files leaked")
	}
}
