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
    if ((e.key === 'Backspace' || e.key === 'Delete') && e.type === 'keydown' && term.hasSelection()) {
      window.api.pty.write(threadId, '\x15');
      term.clearSelection();
      return false;
    }
    if (e.metaKey && e.type === 'keydown') {
      if (e.key === 'a') { term.selectAll(); return false; }
      if (e.key === 'c') {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel);
        return false;
      }
      // Cmd+V: let xterm handle paste natively via browser paste event
      if (e.key === 'v') {
        return false;
      }
    }
    return true;
  });

  // Buffer output that arrives before xterm is opened in DOM
  let pendingWrites = [];
  let isOpened = false;

  // Listen for output globally — always scroll to bottom
  let rafId = null;
  const unsubOutput = window.api.pty.onOutput((id, data) => {
    if (id === threadId) {
      if (isOpened) {
        term.write(data, () => {
          term.scrollToBottom();
          if (inst.onScrollCheck) inst.onScrollCheck();
        });
        // Second scroll after xterm finishes rendering the full batch
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          term.scrollToBottom();
          if (inst.onScrollCheck) inst.onScrollCheck();
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
    onScrollCheck: null,
    markOpened() {
      isOpened = true;
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

    // Attach to DOM
    if (!term.element) {
      term.open(containerRef.current);
    } else {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(term.element);
    }

    // Reset state on switch
    setShowScrollBtn(false);
    inst.markOpened();

    // Force scroll helper
    const forceScroll = () => {
      term.scrollToBottom();
      const vp = containerRef.current?.querySelector('.xterm-viewport');
      if (vp) vp.scrollTop = vp.scrollHeight;
    };

    // After switch: scroll on every render until rendering stops (debounce 100ms)
    let settling = true;
    let settleTimer = null;
    const renderListener = term.onRender(() => {
      if (settling) {
        forceScroll();
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => { settling = false; }, 100);
      }
    });
    // Fallback: if no render fires at all
    settleTimer = setTimeout(() => { forceScroll(); settling = false; }, 300);

    // Fit to container
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        window.api.pty.resize(thread.id, cols, rows);
      } catch (e) { /* ignore */ }
      forceScroll();
    });

    // Replay buffer
    if (inst.needsBufferReplay) {
      inst.needsBufferReplay = false;
      window.api.pty.getBuffer(thread.id).then((buf) => {
        if (buf) term.write(buf, () => forceScroll());
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

    // Scroll position check for button
    const checkScrollPosition = () => {
      const atBottom = term.buffer.active.viewportY >= term.buffer.active.baseY;
      setShowScrollBtn(!atBottom);
    };
    inst.onScrollCheck = checkScrollPosition;

    const scrollListener = term.onScroll(checkScrollPosition);

    // Wheel: detect scroll position for arrow button
    const viewportEl = containerRef.current.querySelector('.xterm-viewport');
    const onWheel = () => {
      setTimeout(checkScrollPosition, 50);
    };
    if (viewportEl) viewportEl.addEventListener('wheel', onWheel, { passive: true });

    term.focus();

    return () => {
      observer.disconnect();
      scrollListener.dispose();
      renderListener.dispose();
      clearTimeout(settleTimer);
      inst.onScrollCheck = null;
      if (viewportEl) viewportEl.removeEventListener('wheel', onWheel);
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
