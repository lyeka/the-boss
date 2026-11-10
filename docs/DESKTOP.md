# MyGo 客户端

采用 [MyGo 0.8.3 官方打包流程](https://mygo.egoist.dev/docs/distribution)，使用系统 WebView：macOS 为 WKWebView。前端资源编译进应用，生产版不连接 Vite，不启动 HTTP 服务。

## 环境与命令

- Go 1.27.3+（`go.mod` 固定最低工具链版本）。现有 Go 1.21+ 可自动下载指定工具链，但更旧版本需要先升级。执行 `go version` 检查当前 PATH。
- Node.js 22+ 与 npm。`npm ci` 安装锁定的 `mygo-cli` 0.8.3、`mygo-runtime` 0.8.3 和 Bun 1.4.4；无需全局安装 MyGo 或 Bun。
- `npm run desktop:doctor` 检查环境；缺少 Developer ID 证书、NSIS 和 Windows 签名工具不妨碍生成本机 macOS 包。
- `npm run desktop:build` 生成当前平台程序；`npm run desktop:dev` 启动使用 5174 端口的独立开发应用。

`scripts/desktop.mjs` 直接调用 npm 包内的 MyGo 可执行文件，显式继承环境变量。它规避 MyGo 0.8.3 npm 启动脚本在支持 `process.execve` 的 Node 版本中未传 `env`、导致 PATH 丢失的问题。

## 产物与安装

本机目标为 `darwin/arm64`，产物位于 `build/darwin-arm64/`。直接打开 `我是大老板.app`，或打开 `the-boss-1.0.0-arm64.dmg` 并把应用拖入 Applications。构建产物不会提交进 Git。

此游戏的 macOS 最低版本设置为 13.3，以匹配前端使用的现代 WebKit 能力（包括 `structuredClone`、`inert` 和 `color-mix`）；实际验证版本为 14.4.1。WebKit 功能依据：[Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)。

应用标识固定为 `io.github.lyeka.theboss`，版本取自 `package.json`。以后升级保留标识，确保系统应用存储连续。应用使用 ad-hoc 签名，不包含个人 Developer ID 或公证；面向其他机器正式发行时，按官方文档配置证书与公证。没有添加自动更新或发布 Release。

## 存档与平台边界

- 自动进度使用 WebView 的持久 localStorage，每个游戏状态更新后保存。关闭再启动应用会恢复该进度，并显示手牌隐私交接层。
- 浏览器、桌面开发版、桌面生产版各自保存进度。迁移时先在来源导出 JSON，再在目标导入。
- 桌面导出 / 导入使用原生系统文件对话框。取消不改变当前对局。导出完整写入并 flush 后才替换目标文件；导入有 16 MB 限制，随后进行引擎结构、卡牌和现金校验。
- 导出包含全部隐藏手牌，只用于备份或复盘。
- “显示”菜单支持全屏与缩放；窗口大小和位置自动记忆。关闭最后一个窗口即退出应用。
- 支持离线运行；无需安装 Go、Bun 或 Node.js。

## 其他平台

```sh
npm run desktop:build -- -platform darwin/universal
npm run desktop:build -- -platform windows/amd64,linux/amd64
```

跨平台编译由 MyGo 支持，当前仅对本机 macOS Apple Silicon 做运行验证。Windows 需要 WebView2 Runtime，生成安装器还需要 NSIS；Linux 需要 GTK 3 与 WebKitGTK。不要把交叉编译成功当作实机验证通过。

应用图标来自 `scripts/create-icon.py` 的原创黄铜落槌图形，PNG 已纳入源码；仅重绘图标时需要 Python Pillow。

## 客户端冒烟测试

```sh
THE_BOSS_QA=1 npm run desktop:build -- -debug -skip-dmg -o build/qa
python3 scripts/desktop-smoke.py
```

测试包使用独立的 `io.github.lyeka.theboss.qa` 标识。脚本用 MyGo 官方 automation 插件检查嵌入页面、资源、布局、音频 API、新开对局、原生桥接的无效 JSON 拒绝、关闭重开后的存档一致性以及隐私遮罩，截图保存在 `build/qa/client-smoke.png`。正式构建通过 `mygo_noinspector` 排除 `automation_dev.go`，不暴露自动化接口。

2026-11-10 在 macOS 14.4.1 / arm64 上通过以上测试；另通过系统文件对话框实际导出并重新导入同一份存档，确认内容逐字一致，并验证两个对话框的取消行为。`codesign --verify --deep --strict` 和 `hdiutil verify` 均通过。文件服务有 2 项 Go 测试，原有 68 项规则测试全部通过。
