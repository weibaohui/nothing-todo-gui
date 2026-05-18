# NTD Desktop

[![Build GUI (Tauri)](https://github.com/weibaohui/nothing-todo-gui/actions/workflows/gui.yml/badge.svg)](https://github.com/weibaohui/nothing-todo-gui/actions/workflows/gui.yml)

NTD 的跨平台桌面客户端，基于 Tauri 2 + React 构建。

## 功能

- 🖥️ **嵌入 Web UI** — 以 iframe 内嵌 [ntd](https://github.com/weibaohui/nothing-todo) 的 Web 界面，原生窗口体验
- 🔄 **ntd daemon 管理** — 在应用内直接启动/停止/重启 ntd 后端服务
- 🚀 **自动启动** — 应用启动时自动检测并启动 ntd daemon
- 🖱️ **系统托盘** — 最小化到系统托盘，后台运行
- 🌐 **外部浏览器打开** — 一键在默认浏览器中打开 ntd 页面
- 📦 **跨平台** — macOS（ARM64）、Windows（x64）、Linux（x64）三平台构建

## 使用前提

> **ntd 需要预先安装。** 桌面应用本身只是 ntd 的 GUI 外壳，真正的功能由 [ntd CLI](https://github.com/weibaohui/nothing-todo) 提供。

```bash
npm install -g @weibaohui/nothing-todo@latest
```

## 下载安装

从 [Releases](https://github.com/weibaohui/nothing-todo-gui/releases) 页面下载对应平台的安装包：

| 平台 | 安装包 |
|------|--------|
| macOS (Apple Silicon) | `ntd-desktop-darwin-arm64.dmg` |
| Windows (x64) | `ntd-desktop-windows-x64.exe` / `.msi` |
| Linux (x64) | `ntd-desktop-linux-x64.deb` |

### macOS

下载 `.dmg` 后打开，将 NTD 拖入 Applications 文件夹。

首次打开时需右键 → 打开（因未签名开发者提示），或执行：

```bash
sudo xattr -d com.apple.quarantine /Applications/NTD.app
```

### Windows

下载 `.exe` 安装程序，运行安装。安装后 NTD 会在开始菜单创建快捷方式。

### Linux（Debian/Ubuntu）

```bash
sudo dpkg -i ntd-desktop-linux-x64.deb
```

桌面入口会自动注册，可在应用菜单中找到 NTD。

## 从源码构建

### 前置条件

- Rust 1.70+
- Node.js 20+
- 各平台系统依赖（详见 [Tauri 文档](https://v2.tauri.app/start/prerequisites/)）

### 步骤

```bash
# 克隆
git clone https://github.com/weibaohui/nothing-todo-gui.git
cd nothing-todo-gui

# 安装前端依赖
cd frontend && npm ci --legacy-peer-deps && cd ..

# 构建 Tauri 应用
cd src-tauri
npx @tauri-apps/cli@latest build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 架构

```
nothing-todo-gui/
├── frontend/                   # React 前端
│   └── src/
│       ├── App.tsx             # 主应用组件（状态管理、iframe 嵌入）
│       ├── components/
│       │   └── NtdManager.tsx  # ntd 管理面板（启动/停止/重启）
│       └── main.tsx            # 前端入口
├── src-tauri/                  # Tauri 后端（Rust）
│   └── src/
│       ├── main.rs             # 应用入口
│       ├── lib.rs              # 应用逻辑 + 状态机
│       └── backend.rs          # ntd 后端检测与进程管理
└── .github/workflows/
    └── gui.yml                 # CI：三平台自动构建与 release
```

### 工作流程

1. 应用启动，Rust 后端检测 `ntd` 二进制是否安装及 daemon 是否运行
2. 如果检测到 daemon 未运行，尝试自动启动
3. 启动成功后，前端 iframe 加载 `http://localhost:{port}`（默认 8088）
4. 用户可在管理面板中手动启停 ntd 服务
5. 系统托盘图标支持后台运行

## 开发

```bash
# 前端开发（热更新）
cd frontend && npm run dev

# 另一个终端：Tauri 开发模式
cd src-tauri
npx @tauri-apps/cli@latest dev
```

## 相关项目

- [nothing-todo](https://github.com/weibaohui/nothing-todo) — ntd CLI 工具，AI 驱动的 Todo 管理

## License

MIT
