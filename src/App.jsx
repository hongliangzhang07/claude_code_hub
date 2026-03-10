import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TerminalView, { destroyTerminal, ensureTerminal } from './components/TerminalView';
import EmptyState from './components/EmptyState';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return mins + ' 分钟';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' 小时';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + ' 天';
  const weeks = Math.floor(days / 7);
  return weeks + ' 周';
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [runningThreads, setRunningThreads] = useState(new Set());
  const loaded = useRef(false);

  // Load data on mount
  useEffect(() => {
    window.api.store.load().then((data) => {
      if (data.projects && data.projects.length > 0) {
        setProjects(data.projects);
      }
      loaded.current = true;
    });
  }, []);

  // Persist on change
  useEffect(() => {
    if (loaded.current) {
      // Log threads missing claudeSessionId for debugging
      for (const p of projects) {
        for (const t of p.threads) {
          if (!t.claudeSessionId) {
            console.warn('[save] thread missing claudeSessionId:', t.id, t.title);
          }
        }
      }
      window.api.store.save({ projects });
    }
  }, [projects]);

  // Listen for thread exit
  useEffect(() => {
    const unsub = window.api.pty.onExit((threadId) => {
      setRunningThreads((prev) => {
        const next = new Set(prev);
        next.delete(threadId);
        return next;
      });
    });
    return () => unsub();
  }, []);

  // Listen for claude session ID capture
  useEffect(() => {
    const unsub = window.api.pty.onSessionId((threadId, sessionId) => {
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          threads: p.threads.map((t) =>
            t.id === threadId ? { ...t, claudeSessionId: sessionId } : t
          ),
        }))
      );
    });
    return () => unsub();
  }, []);

  const addProject = async () => {
    const cwd = await window.api.selectDirectory();
    if (!cwd) return;
    const name = cwd.split('/').filter(Boolean).pop();
    const project = {
      id: genId(),
      name,
      cwd,
      threads: [],
      createdAt: Date.now(),
    };
    setProjects((prev) => [project, ...prev]);
  };

  const removeProject = (projectId) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      proj.threads.forEach((t) => window.api.pty.stop(t.id));
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (proj && proj.threads.some((t) => t.id === activeThreadId)) {
      setActiveThreadId(null);
    }
  };

  const addThread = async (projectId) => {
    const title = await window.api.inputDialog('新建会话', '输入会话名称', '');
    if (!title) return;
    const proj = projects.find((p) => p.id === projectId);
    const thread = {
      id: genId(),
      title,
      cwd: proj ? proj.cwd : '',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, threads: [thread, ...p.threads] }
          : p
      )
    );
    setActiveThreadId(thread.id);

    if (proj) {
      // Ensure terminal listener is ready before spawn
      ensureTerminal(thread.id);
      window.api.pty.spawn(thread.id, proj.cwd).then(() => {
        setRunningThreads((prev) => new Set(prev).add(thread.id));
      });
    }
  };

  const selectThread = async (threadId, projectCwd) => {
    // Ensure terminal + output listener exist BEFORE spawn
    ensureTerminal(threadId);
    setActiveThreadId(threadId);
    // Update lastActiveAt
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        threads: p.threads.map((t) =>
          t.id === threadId ? { ...t, lastActiveAt: Date.now() } : t
        ),
      }))
    );
    const running = await window.api.pty.isRunning(threadId);
    if (!running) {
      // Find the thread's saved claudeSessionId for resume
      let resumeId = null;
      for (const p of projects) {
        const t = p.threads.find((t) => t.id === threadId);
        if (t && t.claudeSessionId) {
          resumeId = t.claudeSessionId;
          break;
        }
      }
      console.log('[selectThread] threadId:', threadId, 'resumeId:', resumeId);
      if (!resumeId) {
        console.warn('[selectThread] WARNING: no claudeSessionId found for thread', threadId, 'projects:', JSON.stringify(projects.map(p => ({ id: p.id, threads: p.threads.map(t => ({ id: t.id, title: t.title, claudeSessionId: t.claudeSessionId })) }))));
      }
      window.api.pty.spawn(threadId, projectCwd, null, null, resumeId).then(() => {
        setRunningThreads((prev) => new Set(prev).add(threadId));
      });
    }
  };

  const stopThread = (threadId) => {
    window.api.pty.stop(threadId);
    setRunningThreads((prev) => {
      const next = new Set(prev);
      next.delete(threadId);
      return next;
    });
  };

  const restartClaude = async (threadId) => {
    // Find the thread's claudeSessionId for resume
    let resumeId = null;
    for (const p of projects) {
      const t = p.threads.find((t) => t.id === threadId);
      if (t && t.claudeSessionId) {
        resumeId = t.claudeSessionId;
        break;
      }
    }
    const cmd = resumeId ? `claude --resume ${resumeId}` : 'claude';
    window.api.pty.write(threadId, cmd + '\r');
  };

  const renameThread = async (projectId, threadId, oldTitle) => {
    const newTitle = await window.api.inputDialog('重命名会话', '输入新名称', oldTitle);
    if (!newTitle || newTitle === oldTitle) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, threads: p.threads.map((t) => t.id === threadId ? { ...t, title: newTitle } : t) }
          : p
      )
    );
  };

  const removeThread = (projectId, threadId) => {
    window.api.pty.stop(threadId);
    destroyTerminal(threadId);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, threads: p.threads.filter((t) => t.id !== threadId) }
          : p
      )
    );
    if (activeThreadId === threadId) setActiveThreadId(null);
    setRunningThreads((prev) => {
      const next = new Set(prev);
      next.delete(threadId);
      return next;
    });
  };

  // Find active thread's project
  let activeProject = null;
  let activeThread = null;
  for (const p of projects) {
    const t = p.threads.find((t) => t.id === activeThreadId);
    if (t) { activeProject = p; activeThread = t; break; }
  }

  return (
    <div className="app">
      <div className="titlebar">
        <span className="titlebar-text">Claude Code Hub</span>
        <button className="titlebar-btn" onClick={addProject}>
          添加新项目
        </button>
      </div>
      <div className="main">
        <Sidebar
          projects={projects}
          activeThreadId={activeThreadId}
          runningThreads={runningThreads}
          timeAgo={timeAgo}
          onSelectThread={selectThread}
          onAddThread={addThread}
          onStopThread={stopThread}
          onRemoveThread={removeThread}
          onRestartClaude={restartClaude}
          onRenameThread={renameThread}
          onRemoveProject={removeProject}
          onAddProject={addProject}
        />
        <div className="content">
          {activeThread ? (
            <TerminalView
              key={activeThread.id}
              thread={activeThread}
              project={activeProject}
              isRunning={runningThreads.has(activeThread.id)}
            />
          ) : (
            <EmptyState onAddProject={addProject} />
          )}
        </div>
      </div>
    </div>
  );
}
