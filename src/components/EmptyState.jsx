import React from 'react';

export default function EmptyState({ onAddProject }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <path d="M8 20h48" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <path d="M32 30v12M26 36h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
        </svg>
      </div>
      <h2>Claude Code Hub</h2>
      <p>管理多个项目的 Claude Code 会话</p>
      <div className="empty-steps">
        <div className="step">1. 添加项目目录</div>
        <div className="step">2. 创建会话线程</div>
        <div className="step">3. 自动启动 Claude Code</div>
      </div>
      <button className="btn-primary" onClick={onAddProject}>
        + 添加新项目
      </button>
    </div>
  );
}
