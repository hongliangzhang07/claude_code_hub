// Pre-flight dependency check: Node.js and Claude Code CLI
const { execSync, exec } = require('child_process');
const { dialog, BrowserWindow } = require('electron');
const fs = require('fs');

const NODE_PATHS = [
  '/usr/local/bin/node',
  '/opt/homebrew/bin/node',
  '/usr/bin/node',
];

const CLAUDE_PATHS = [
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
];

// Resolve full PATH including shell profile paths
function getShellPath() {
  try {
    return execSync('/bin/zsh -ilc "echo $PATH"', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch (e) {
    return process.env.PATH || '';
  }
}

function findBinary(name, knownPaths) {
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const fullPath = getShellPath();
    return execSync(`PATH="${fullPath}" which ${name}`, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch (e) {
    return null;
  }
}

function checkNode() {
  return findBinary('node', NODE_PATHS);
}

function checkClaude() {
  return findBinary('claude', CLAUDE_PATHS);
}

// Show a setup window with install progress
function showSetupWindow(parentWindow, missing) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 400,
      parent: parentWindow,
      modal: !!parentWindow,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: 'hiddenInset',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const needNode = missing.includes('node');
    const needClaude = missing.includes('claude');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, sans-serif; padding: 40px 32px 24px; background: #f7f7f8; color: #1a1a1a; }
      h2 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
      .subtitle { font-size: 13px; color: #8b8b8e; margin-bottom: 24px; }
      .dep { padding: 14px 16px; background: white; border: 1px solid #e5e5e7; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; }
      .dep-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
      .dep-icon.ok { background: #dcfce7; }
      .dep-icon.missing { background: #fee2e2; }
      .dep-icon.installing { background: #dbeafe; }
      .dep-name { font-size: 14px; font-weight: 600; }
      .dep-desc { font-size: 12px; color: #8b8b8e; margin-top: 2px; }
      .dep-status { margin-left: auto; font-size: 12px; font-weight: 500; flex-shrink: 0; }
      .dep-status.ok { color: #16a34a; }
      .dep-status.missing { color: #dc2626; }
      .dep-status.installing { color: #2563eb; }
      .btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
      button { padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s; }
      button:hover { opacity: 0.85; }
      .btn-install { background: #1a1a1a; color: white; }
      .btn-skip { background: white; border: 1px solid #e5e5e7; color: #1a1a1a; }
      .btn-install:disabled { opacity: 0.5; cursor: not-allowed; }
      #log { margin-top: 16px; padding: 10px; background: #1a1a1a; color: #c0caf5; border-radius: 8px; font-family: Menlo, monospace; font-size: 11px; height: 80px; overflow-y: auto; display: none; white-space: pre-wrap; }
    </style></head><body>
      <h2>环境检查</h2>
      <p class="subtitle">Claude Code Hub 需要以下依赖</p>
      <div class="dep" id="dep-node">
        <div class="dep-icon ${needNode ? 'missing' : 'ok'}" id="icon-node">${needNode ? '✗' : '✓'}</div>
        <div>
          <div class="dep-name">Node.js</div>
          <div class="dep-desc">JavaScript 运行时</div>
        </div>
        <div class="dep-status ${needNode ? 'missing' : 'ok'}" id="status-node">${needNode ? '未安装' : '已安装'}</div>
      </div>
      <div class="dep" id="dep-claude">
        <div class="dep-icon ${needClaude ? 'missing' : 'ok'}" id="icon-claude">${needClaude ? '✗' : '✓'}</div>
        <div>
          <div class="dep-name">Claude Code CLI</div>
          <div class="dep-desc">npm install -g @anthropic-ai/claude-code</div>
        </div>
        <div class="dep-status ${needClaude ? 'missing' : 'ok'}" id="status-claude">${needClaude ? '未安装' : '已安装'}</div>
      </div>
      <div id="log"></div>
      <div class="btns">
        <button class="btn-skip" onclick="document.title='__SKIP__'">跳过</button>
        <button class="btn-install" id="btnInstall" onclick="startInstall()">一键安装</button>
      </div>
      <script>
        const log = document.getElementById('log');
        function appendLog(text) {
          log.style.display = 'block';
          log.textContent += text + '\\n';
          log.scrollTop = log.scrollHeight;
        }
        function setStatus(dep, status, icon, cls) {
          document.getElementById('status-' + dep).textContent = status;
          document.getElementById('status-' + dep).className = 'dep-status ' + cls;
          document.getElementById('icon-' + dep).textContent = icon;
          document.getElementById('icon-' + dep).className = 'dep-icon ' + cls;
        }
        function startInstall() {
          document.getElementById('btnInstall').disabled = true;
          document.title = '__INSTALL__';
        }
        // Listen for progress updates via title
        let checkInterval = setInterval(() => {
          // Title will be set by main process via executeJavaScript
        }, 500);
      </script>
    </body></html>`;

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    win.once('ready-to-show', () => win.show());

    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      try { win.close(); } catch (e) {}
      resolve(result);
    };

    win.on('closed', () => finish('skip'));

    win.webContents.on('page-title-updated', async (e, title) => {
      if (title === '__SKIP__') {
        finish('skip');
        return;
      }
      if (title === '__INSTALL__') {
        const wc = win.webContents;
        const run = (cmd) => wc.executeJavaScript(`appendLog('$ ${cmd.replace(/'/g, "\\'")}')`)
          .then(() => wc.executeJavaScript(`appendLog('')`));
        const log = (msg) => wc.executeJavaScript(`appendLog('${msg.replace(/'/g, "\\'")}')`);
        const setStatus = (dep, s, icon, cls) =>
          wc.executeJavaScript(`setStatus('${dep}','${s}','${icon}','${cls}')`);

        try {
          if (needNode) {
            await setStatus('node', '安装中...', '⟳', 'installing');
            await log('正在安装 Node.js...');

            // Try homebrew first
            const hasHomebrew = fs.existsSync('/opt/homebrew/bin/brew') || fs.existsSync('/usr/local/bin/brew');
            if (hasHomebrew) {
              await run('brew install node');
              try {
                const shellPath = getShellPath();
                execSync(`PATH="${shellPath}" brew install node`, { timeout: 120000 });
                await setStatus('node', '已安装', '✓', 'ok');
                await log('Node.js 安装成功');
              } catch (err) {
                await log('brew 安装失败: ' + err.message);
                await setStatus('node', '安装失败', '✗', 'missing');
                await log('请手动安装: https://nodejs.org');
              }
            } else {
              await log('未检测到 Homebrew，请手动安装 Node.js');
              await log('下载地址: https://nodejs.org');
              await setStatus('node', '需手动安装', '!', 'missing');
            }
          }

          if (needClaude) {
            await setStatus('claude', '安装中...', '⟳', 'installing');
            await log('正在安装 Claude Code CLI...');

            const npmPath = findBinary('npm', ['/usr/local/bin/npm', '/opt/homebrew/bin/npm']);
            if (npmPath) {
              await run(npmPath + ' install -g @anthropic-ai/claude-code');
              try {
                execSync(`${npmPath} install -g @anthropic-ai/claude-code`, { timeout: 120000 });
                await setStatus('claude', '已安装', '✓', 'ok');
                await log('Claude Code CLI 安装成功');
              } catch (err) {
                await log('安装失败: ' + err.message);
                await log('请手动运行: npm install -g @anthropic-ai/claude-code');
                await setStatus('claude', '安装失败', '✗', 'missing');
              }
            } else {
              await log('未找到 npm，请先安装 Node.js');
              await setStatus('claude', '需先安装 Node.js', '!', 'missing');
            }
          }

          await log('');
          await log('安装完成，3秒后启动...');
          setTimeout(() => finish('done'), 3000);
        } catch (err) {
          await log('安装过程出错: ' + err.message);
          setTimeout(() => finish('done'), 5000);
        }
      }
    });
  });
}

function checkClaudeHud() {
  try {
    const shellPath = getShellPath();
    const output = execSync(`PATH="${shellPath}" claude plugins list`, { encoding: 'utf-8', timeout: 10000 });
    return output.includes('claude-hud');
  } catch (e) {
    return false;
  }
}

function installClaudeHud() {
  try {
    const shellPath = getShellPath();
    execSync(`PATH="${shellPath}" claude plugins install claude-hud`, { encoding: 'utf-8', timeout: 60000 });
    return true;
  } catch (e) {
    console.error('[preflight] claude-hud install failed:', e.message);
    return false;
  }
}

async function runPreflight(parentWindow) {
  const nodePath = checkNode();
  const claudePath = checkClaude();

  const missing = [];
  if (!nodePath) missing.push('node');
  if (!claudePath) missing.push('claude');

  if (missing.length === 0) {
    // Auto-install claude-hud plugin if not present
    if (!checkClaudeHud()) {
      console.log('[preflight] Installing claude-hud plugin...');
      installClaudeHud();
    }
    return { ok: true, nodePath, claudePath };
  }

  // Show setup UI
  const result = await showSetupWindow(parentWindow, missing);

  // Re-check after install
  const nodePathAfter = checkNode();
  const claudePathAfter = checkClaude();

  // Auto-install claude-hud if claude is now available
  if (claudePathAfter && !checkClaudeHud()) {
    console.log('[preflight] Installing claude-hud plugin...');
    installClaudeHud();
  }

  return {
    ok: !!nodePathAfter && !!claudePathAfter,
    nodePath: nodePathAfter,
    claudePath: claudePathAfter,
    skipped: result === 'skip',
  };
}

module.exports = { runPreflight, checkNode, checkClaude };
