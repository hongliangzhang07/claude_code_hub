import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

// Global map: keep xterm instances alive across re-renders
const terminalInstances = new Map();

function getOrCreateTerminal(threadId) {
  if (terminalInstances.has(threadId)) {
    return terminalInstances.get(threadId);
  }

  const term = new Terminal({
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#ffffff',
      foreground: '#1a1a1a',
      cursor: '#1a1a1a',
      cursorAccent: '#ffffff',
      selectionBackground: '#b4d5fe',
      selectionForeground: '#1a1a1a',
      black: '#1a1a1a',
      red: '#d73a49',
      green: '#22863a',
      yellow: '#b08800',
      blue: '#0366d6',
      magenta: '#6f42c1',
      cyan: '#1b7c83',
      white: '#6a737d',
      brightBlack: '#586069',
      brightRed: '#cb2431',
      brightGreen: '#28a745',
      brightYellow: '#dbab09',
      brightBlue: '#2188ff',
      brightMagenta: '#8a63d2',
      brightCyan: '#3192aa',
      brightWhite: '#959da5',
    },
    cursorBlink: true,
    scrollback: 10000,
    allowProposedApi: true,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  // Handle macOS shortcuts (Cmd+A, Cmd+C, Cmd+V)
  term.attachCustomKeyEventHandler((e) => {
    // Backspace/Delete with selection → clear input line (Ctrl+U)
    if ((e.key === 'Backspace' || e.key === 'Delete') && e.type === 'keydown' && term.hasSelection()) {
      window.api.pty.write(threadId, '\x15'); // Ctrl+U
      term.clearSelection();
      return false;
    }
    if (e.metaKey && e.type === 'keydown') {
      if (e.key === 'a') {
        term.selectAll();
        return false;
      }
      if (e.key === 'c') {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel);
        return false;
      }
      if (e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.api.pty.write(threadId, text);
        });
        return false;
      }
    }
    return true;
  });

  // Buffer output that arrives before xterm is opened in DOM
  let pendingWrites = [];
  let isOpened = false;

  // Track whether user has scrolled up
  let userScrolledUp = false;
  term.onScroll(() => {
    userScrolledUp = term.buffer.active.viewportY < term.buffer.active.baseY;
  });

  // Listen for output globally (always, even before DOM attach)
  const unsubOutput = window.api.pty.onOutput((id, data) => {
    if (id === threadId) {
      if (isOpened) {
        term.write(data, () => {
          if (!userScrolledUp) term.scrollToBottom();
        });
      } else {
        pendingWrites.push(data);
      }
    }
  });

  // Send input to PTY
  term.onData((data) => {
    window.api.pty.write(threadId, data);
  });

  const inst = {
    term,
    fitAddon,
    unsubOutput,
    pendingWrites,
    needsBufferReplay: true,
    markOpened() {
      isOpened = true;
      // Flush any output that arrived before DOM open
      if (pendingWrites.length > 0) {
        for (const chunk of pendingWrites) {
          term.write(chunk);
        }
        pendingWrites.length = 0;
        term.scrollToBottom();
      }
    },
  };
  terminalInstances.set(threadId, inst);
  return inst;
}

export function destroyTerminal(threadId) {
  const inst = terminalInstances.get(threadId);
  if (inst) {
    inst.unsubOutput();
    inst.term.dispose();
    terminalInstances.delete(threadId);
  }
}

// Call this BEFORE spawning, so the listener is ready
export function ensureTerminal(threadId) {
  return getOrCreateTerminal(threadId);
}

export default function TerminalView({ thread, project, isRunning }) {
  const containerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const inst = getOrCreateTerminal(thread.id);
    const { term, fitAddon } = inst;

    // If terminal is not attached to any DOM, open it
    if (!term.element) {
      term.open(containerRef.current);
    } else {
      // Re-attach: move the terminal element to this container
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(term.element);
    }

    // Reset scroll button state on thread switch
    setShowScrollBtn(false);

    // Mark as opened so future output goes directly to term.write
    inst.markOpened();

    // Fit to container and scroll to bottom (delay to let xterm fully render after re-attach)
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        window.api.pty.resize(thread.id, cols, rows);
      } catch (e) { /* ignore fit errors */ }
      // Scroll after xterm finishes re-rendering
      setTimeout(() => term.scrollToBottom(), 150);
    });

    // Replay buffer from pty-host (catches output from before this xterm instance existed)
    if (inst.needsBufferReplay) {
      inst.needsBufferReplay = false;
      window.api.pty.getBuffer(thread.id).then((buf) => {
        if (buf) term.write(buf, () => term.scrollToBottom());
      });
    }

    // Handle resize
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        window.api.pty.resize(thread.id, cols, rows);
      } catch (e) { /* ignore */ }
    });
    observer.observe(containerRef.current);

    // Show/hide scroll-to-bottom button
    const scrollListener = term.onScroll(() => {
      const isAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY;
      setShowScrollBtn(!isAtBottom);
    });

    term.focus();

    return () => {
      observer.disconnect();
      scrollListener.dispose();
    };
  }, [thread.id]);

  const scrollToBottom = () => {
    const inst = terminalInstances.get(thread.id);
    if (inst) {
      inst.term.scrollToBottom();
      inst.term.focus();
      setShowScrollBtn(false);
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-info">
          <span className="terminal-project">{project.name}</span>
          <span className="terminal-sep">/</span>
          <span className="terminal-title">{thread.title}</span>
        </div>
        <div className="terminal-meta">
          <span className="terminal-cwd">{project.cwd}</span>
          <span className={`terminal-status ${isRunning ? 'status-running' : 'status-stopped'}`}>
            {isRunning ? '运行中' : '已停止'}
          </span>
        </div>
      </div>
      <div className="terminal-body-wrapper">
        <div className="terminal-body" ref={containerRef} />
        {showScrollBtn && (
          <button className="scroll-to-bottom-btn" onClick={scrollToBottom} title="回到底部">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
