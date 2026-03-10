# Claude Code Hub

macOS 桌面应用，用于管理多个项目的 Claude Code 终端会话。

[English](./README.md)

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/hongliangzhang07/claude_code_hub/main/install.sh | bash
```

自动检测 Mac 架构（Intel / Apple Silicon），下载对应版本并安装到 `/Applications`。

## 功能

- **多项目管理** — 同时管理多个项目目录
- **多会话线程** — 每个项目可创建多个独立的 Claude Code 会话
- **内嵌终端** — 完整的终端体验，支持颜色、链接、滚动回看
- **会话恢复** — 自动保存 Claude 会话 ID，重启后可恢复对话上下文
- **环境检查** — 首次启动自动检测 Node.js 和 Claude CLI，支持一键安装依赖

## 前置依赖

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code)
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

## 本地开发

```bash
git clone git@github.com:hongliangzhang07/claude_code_hub.git
cd claude_code_hub
npm install
npm run dev
```

## 手动构建

```bash
npm run build
```

构建产物在 `dist/` 目录下。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | React |
| 构建工具 | Vite |
| 终端模拟 | xterm.js |
| PTY 进程 | node-pty |

## License

MIT
