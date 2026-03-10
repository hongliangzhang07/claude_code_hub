# Claude Code Hub

A macOS desktop app for managing multiple Claude Code terminal sessions across projects.

[中文文档](./README_CN.md)

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/hongliangzhang07/claude_code_hub/main/install.sh | bash
```

Automatically detects Mac architecture (Intel / Apple Silicon), downloads the matching build, and installs to `/Applications`.

## Features

- **Multi-project management** — Manage multiple project directories side by side
- **Multi-session threads** — Create multiple independent Claude Code sessions per project
- **Embedded terminal** — Full terminal experience with colors, links, and scrollback
- **Session resume** — Automatically saves Claude session IDs, resume conversations after restart
- **Environment check** — Detects Node.js and Claude CLI on first launch, offers one-click install

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code)
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
- Run `claude` in terminal once to complete authentication

## Post-Install Notes

- If macOS says the app is "damaged" or "can't be opened", run:
  ```bash
  xattr -cr /Applications/Claude\ Code\ Hub.app
  ```
- Alternatively, **right-click → Open** and click "Open" in the dialog

## Usage Tips

- Click the folder icon (top-left) to add a project
- Click `+` under a project to create a new Claude Code session
- **Right-click** a session to rename or delete it
- Scroll up to see history; a floating arrow button appears to jump back to the bottom
- Sessions auto-resume — restart the app and conversations pick up where they left off

## Local Development

```bash
git clone git@github.com:hongliangzhang07/claude_code_hub.git
cd claude_code_hub
npm install
npm run dev
```

## Build

```bash
npm run build
```

Build output is in the `dist/` directory.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron |
| Frontend | React |
| Bundler | Vite |
| Terminal | xterm.js |
| PTY | node-pty |

## License

MIT
