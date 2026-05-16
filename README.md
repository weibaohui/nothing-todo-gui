# nothing-todo-gui

ntd 的 Tauri 桌面壳子，独立项目，专门负责构建跨平台桌面应用。

## 职责

- Tauri 桌面应用构建
- 多平台打包（macOS / Windows / Linux）
- GUI 与 ntd 后端的桥接

## 构建

需要先有 `ntd` 后端二进制和前端 `dist` 目录，CI 会通过 `rust.yaml` workflow 自动准备。

本地开发：

```bash
# 安装依赖
cd src-tauri
cargo install cargo-tauri

# 构建
cargo tauri build
```

## 架构

- `src-tauri/src/main.rs` — 入口
- `src-tauri/src/lib.rs` — 应用逻辑 + 状态机
- `src-tauri/src/backend.rs` — ntd 后端状态检测与启动
- `src-tauri/icons/` — 应用图标
