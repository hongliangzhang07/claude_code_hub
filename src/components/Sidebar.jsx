import React, { useState, useRef, useEffect } from 'react';

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-buttons">
          <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>取消</button>
          <button className="confirm-btn confirm-btn-danger" onClick={onConfirm}>删除</button>
        </div>
      </div>
    </div>
  );
}

function CollapsibleThreadList({ collapsed, children }) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(collapsed ? 0 : 'auto');
  const [isAnimating, setIsAnimating] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      setHeight(collapsed ? 0 : 'auto');
      return;
    }

    const el = contentRef.current;
    if (!el) return;

    if (collapsed) {
      // Collapse: set explicit height first, then to 0
      setHeight(el.scrollHeight);
      setIsAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    } else {
      // Expand: set to scrollHeight, then auto after transition
      setHeight(el.scrollHeight);
      setIsAnimating(true);
    }
  }, [collapsed]);

  const onTransitionEnd = () => {
    setIsAnimating(false);
    if (!collapsed) setHeight('auto');
  };

  return (
    <div
      ref={contentRef}
      className="thread-list-collapsible"
      style={{
        height: height === 'auto' ? 'auto' : `${height}px`,
        overflow: isAnimating || collapsed ? 'hidden' : 'visible',
      }}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
}

export default function Sidebar({
  projects,
  activeThreadId,
  runningThreads,
  timeAgo,
  onSelectThread,
  onAddThread,
  onStopThread,
  onRestartClaude,
  onRenameThread,
  onRemoveThread,
  onRemoveProject,
  onAddProject,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [newThreadMenu, setNewThreadMenu] = useState(null);

  const toggleProject = (id) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRemoveThread = (projectId, threadId, threadTitle) => {
    setConfirmDelete({ type: 'thread', projectId, threadId, title: threadTitle });
  };

  const handleRemoveProject = (projectId, projectName) => {
    setConfirmDelete({ type: 'project', projectId, title: projectName });
  };

  const confirmAction = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'thread') {
      onRemoveThread(confirmDelete.projectId, confirmDelete.threadId);
    } else {
      onRemoveProject(confirmDelete.projectId);
    }
    setConfirmDelete(null);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">线程</span>
        <div className="sidebar-actions">
          <button
            className="sidebar-icon-btn"
            onClick={onAddProject}
            title="添加项目"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3.5A1.5 1.5 0 013.5 2H6l1 1.5h5.5A1.5 1.5 0 0114 5v7.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="sidebar-list">
        {projects.map((project) => {
          const isCollapsed = !!collapsed[project.id];
          const threadCount = project.threads.length;
          const runningCount = project.threads.filter((t) => runningThreads.has(t.id)).length;

          return (
            <div key={project.id} className="project-group">
              <div
                className="project-header"
                onClick={() => toggleProject(project.id)}
              >
                <span className="project-folder-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M2 4.5A1.5 1.5 0 013.5 3H7l1.5 1.5H14.5A1.5 1.5 0 0116 6v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 13.5v-9z" fill="#8b8b8e" opacity="0.25" stroke="#8b8b8e" strokeWidth="1"/>
                  </svg>
                </span>
                <span className="project-name">{project.name}</span>
                <div className="project-actions">
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setNewThreadMenu({ projectId: project.id, x: rect.left, y: rect.bottom + 4 });
                    }}
                    title="新建会话"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    className="icon-btn icon-btn-danger"
                    onClick={(e) => { e.stopPropagation(); handleRemoveProject(project.id, project.name); }}
                    title="删除项目"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M6 6.5v3M8 6.5v3M4 4l.5 7a1 1 0 001 1h3a1 1 0 001-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              <CollapsibleThreadList collapsed={isCollapsed}>
                <div className="thread-list">
                  {project.threads.map((thread) => {
                    const isActive = thread.id === activeThreadId;
                    const isRunning = runningThreads.has(thread.id);
                    const hasSession = !!thread.claudeSessionId;
                    return (
                      <div
                        key={thread.id}
                        className={`thread-item ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectThread(thread.id, project.cwd, thread.claudeSessionId, thread.autoConfirm)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, projectId: project.id, threadId: thread.id, title: thread.title });
                        }}
                      >
                        <div className="thread-main">
                          <span className="thread-title">
                            {thread.title}
                            {thread.autoConfirm && <span className="auto-confirm-badge" title="自动确认模式">Y</span>}
                          </span>
                          <span className="thread-time">
                            {timeAgo(thread.lastActiveAt || thread.createdAt)}
                          </span>
                        </div>
                        <div className="thread-actions">
                          {isRunning && (
                            <button
                              className="icon-btn icon-btn-small icon-btn-restart"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestartClaude(thread.id);
                              }}
                              title="重新启动 Claude"
                            >
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M10 2v3.5H6.5M2 10V6.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2.5 4.5A4 4 0 017.5 2.1L10 5.5M9.5 7.5A4 4 0 014.5 9.9L2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                          {hasSession && !isRunning && (
                            <span className="session-badge" title={`可恢复: ${thread.claudeSessionId}`}>↻</span>
                          )}
                          {isRunning && (
                            <span className="running-dot" title="运行中" />
                          )}
                          <button
                            className="icon-btn icon-btn-small icon-btn-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveThread(project.id, thread.id, thread.title);
                            }}
                            title="删除"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 3.5h7M4.5 3.5V3a1 1 0 011-1h1a1 1 0 011 1v.5M5 5.5v2.5M7 5.5v2.5M3.5 3.5l.4 5.6a1 1 0 001 .9h2.2a1 1 0 001-.9l.4-5.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {project.threads.length === 0 && (
                    <div className="no-threads">暂无会话，点击 + 创建</div>
                  )}
                </div>
              </CollapsibleThreadList>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="empty-sidebar">
            <p>暂无项目</p>
            <p className="hint">点击上方按钮添加项目</p>
          </div>
        )}
      </div>

      {newThreadMenu && (
        <div className="context-menu-overlay" onClick={() => setNewThreadMenu(null)}>
          <div
            className="context-menu"
            style={{ top: newThreadMenu.y, left: newThreadMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-menu-item" onClick={() => {
              onAddThread(newThreadMenu.projectId, false);
              setNewThreadMenu(null);
            }}>普通会话</div>
            <div className="context-menu-item" onClick={() => {
              onAddThread(newThreadMenu.projectId, true);
              setNewThreadMenu(null);
            }}>自动确认会话</div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="context-menu-overlay" onClick={() => setContextMenu(null)}>
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-menu-item" onClick={() => {
              onRestartClaude(contextMenu.threadId);
              setContextMenu(null);
            }}>重启 Claude</div>
            <div className="context-menu-item" onClick={() => {
              onRenameThread(contextMenu.projectId, contextMenu.threadId, contextMenu.title);
              setContextMenu(null);
            }}>重命名</div>
            <div className="context-menu-item context-menu-danger" onClick={() => {
              handleRemoveThread(contextMenu.projectId, contextMenu.threadId, contextMenu.title);
              setContextMenu(null);
            }}>删除</div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={
            confirmDelete.type === 'thread'
              ? `确定删除会话「${confirmDelete.title}」吗？`
              : `确定删除项目「${confirmDelete.title}」及其所有会话吗？`
          }
          onConfirm={confirmAction}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
