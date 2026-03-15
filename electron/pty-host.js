// This script runs in system Node.js (not Electron) to avoid ABI issues with node-pty.
// Communication with the Electron main process is via stdin/stdout JSON lines.

const pty = require('node-pty');

const sessions = new Map();      // id -> pty process
const buffers = new Map();       // id -> output buffer (circular)

const MAX_BUFFER = 200 * 1024;   // 200KB per session

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function appendBuffer(id, data) {
  let buf = buffers.get(id) || '';
  buf += data;
  if (buf.length > MAX_BUFFER) {
    buf = buf.slice(buf.length - MAX_BUFFER);
  }
  buffers.set(id, buf);
}

const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// Get the user's full shell PATH (packaged apps have a minimal PATH)
let userPath = process.env.PATH || '';
try {
  const shell = process.env.SHELL || '/bin/zsh';
  userPath = execSync(`${shell} -ilc "echo \\$PATH"`, { encoding: 'utf-8', timeout: 5000 }).trim();
} catch (e) {
  const extra = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  const current = new Set(userPath.split(':'));
  for (const p of extra) {
    if (!current.has(p)) userPath += ':' + p;
  }
}

function handleMessage(msg) {
  switch (msg.action) {
    case 'spawn': {
      const { id, cwd, cols, rows, env, sessionId, isResume, autoConfirm } = msg;
      try {
        const proc = pty.spawn('/bin/zsh', [], {
          name: 'xterm-256color',
          cols: cols || 120,
          rows: rows || 30,
          cwd: cwd || process.env.HOME,
          env: { ...process.env, ...env, PATH: userPath, TERM: 'xterm-256color' },
        });

        proc.onData((data) => {
          appendBuffer(id, data);
          send({ type: 'output', id, data });
        });

        proc.onExit(({ exitCode }) => {
          sessions.delete(id);
          send({ type: 'exit', id, code: exitCode });
        });

        sessions.set(id, proc);

        // Build claude command
        const yesFlag = autoConfirm ? ' --dangerously-skip-permissions' : '';
        setTimeout(() => {
          if (isResume) {
            proc.write('claude --resume ' + sessionId + yesFlag + '\r');
          } else {
            proc.write('claude --session-id ' + sessionId + yesFlag + ' "hi"\r');
          }
        }, 500);

        send({ type: 'spawned', id, success: true });
      } catch (err) {
        send({ type: 'spawned', id, success: false, error: err.message });
      }
      break;
    }
    case 'write': {
      const proc = sessions.get(msg.id);
      if (proc) proc.write(msg.data);
      break;
    }
    case 'resize': {
      const proc = sessions.get(msg.id);
      if (proc) proc.resize(msg.cols, msg.rows);
      break;
    }
    case 'stop': {
      const proc = sessions.get(msg.id);
      if (proc) {
        proc.kill();
        sessions.delete(msg.id);
      }
      send({ type: 'stopped', id: msg.id });
      break;
    }
    case 'isRunning': {
      send({ type: 'isRunning', id: msg.id, running: sessions.has(msg.id) });
      break;
    }
    case 'getBuffer': {
      const buf = buffers.get(msg.id) || '';
      send({ type: 'buffer', id: msg.id, data: buf });
      break;
    }
  }
}

// Read JSON lines from stdin
let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIdx);
    buffer = buffer.slice(newlineIdx + 1);
    if (line.trim()) {
      try {
        handleMessage(JSON.parse(line));
      } catch (e) {
        // ignore parse errors
      }
    }
  }
});

process.on('SIGTERM', () => {
  for (const [, proc] of sessions) proc.kill();
  process.exit(0);
});

send({ type: 'ready' });
