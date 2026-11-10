package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/egoist/mygo"
)

const maxSaveBytes = 16 << 20

// Desktop exposes only user-selected JSON files; the rules engine stays in TypeScript.
type Desktop struct{}

// ExportSave opens a native save dialog. False means the user canceled.
func (Desktop) ExportSave(ctx context.Context, name, data string) (bool, error) {
	if err := validateSave(data); err != nil {
		return false, err
	}
	path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{
		Parent: mygo.CallerWindow(ctx), Title: "导出对局存档",
		DefaultPath: filepath.Base(name),
		Filters:     []mygo.FileFilter{{Name: "对局存档", Extensions: []string{"json"}}},
	})
	if err != nil || path == "" {
		return false, err
	}
	if !strings.EqualFold(filepath.Ext(path), ".json") {
		path += ".json"
	}
	return true, writeSave(path, data)
}

// ImportSave reads only the JSON file the user selects. Empty means canceled.
func (Desktop) ImportSave(ctx context.Context) (string, error) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent: mygo.CallerWindow(ctx), Title: "导入对局存档",
		Filters: []mygo.FileFilter{{Name: "对局存档", Extensions: []string{"json"}}},
	})
	if err != nil || len(paths) == 0 {
		return "", err
	}
	f, err := os.Open(paths[0])
	if err != nil {
		return "", err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxSaveBytes+1))
	if err != nil {
		return "", err
	}
	if err = validateSave(string(data)); err != nil {
		return "", err
	}
	return string(data), nil
}

func validateSave(data string) error {
	if len(data) > maxSaveBytes {
		return fmt.Errorf("存档超过 16 MB 上限")
	}
	if !json.Valid([]byte(data)) {
		return fmt.Errorf("存档不是有效 JSON")
	}
	return nil
}

// Write beside the destination and rename only after the complete file is flushed.
func writeSave(path, data string) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".the-boss-save-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	defer f.Close()
	if _, err = f.WriteString(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}

func main() {
	mygo.Bind(Desktop{})
	mygo.App.WhenReady(func() {
		mygo.App.SetMenu(mygo.NewMenu([]*mygo.MenuItem{
			{Role: mygo.RoleAppMenu},
			{Label: "编辑", Role: mygo.RoleEditMenu},
			{Label: "显示", Submenu: []*mygo.MenuItem{
				{Label: "进入 / 退出全屏", Role: mygo.RoleToggleFullScreen},
				{Label: "放大", Role: mygo.RoleZoomIn},
				{Label: "缩小", Role: mygo.RoleZoomOut},
				{Label: "实际大小", Role: mygo.RoleResetZoom},
			}},
			{Label: "窗口", Role: mygo.RoleWindowMenu},
		}))
		win := mygo.NewWindow(mygo.WindowOptions{
			Title: "我是大老板 · 私人董事会", URL: "/",
			Width: 1440, Height: 960, MinWidth: 900, MinHeight: 680,
			StateKey: "game-table", BackgroundColor: "#092b24", Hidden: true,
		})
		win.OnReadyToShow(win.Show)
	})
	mygo.App.OnWindowAllClosed(mygo.App.Quit)
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
