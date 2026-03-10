const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  store: {
    load: () => ipcRenderer.invoke('store:load'),
    save: (data) => ipcRenderer.invoke('store:save', data),
  },
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  inputDialog: (title, label, defaultValue) => ipcRenderer.invoke('dialog:input', title, label, defaultValue),
  pty: {
    spawn: (threadId, cwd, cols, rows, resumeSessionId) => ipcRenderer.invoke('pty:spawn', threadId, cwd, cols, rows, resumeSessionId),
    getBuffer: (threadId) => ipcRenderer.invoke('pty:getBuffer', threadId),
    write: (threadId, data) => ipcRenderer.invoke('pty:write', threadId, data),
    resize: (threadId, cols, rows) => ipcRenderer.invoke('pty:resize', threadId, cols, rows),
    stop: (threadId) => ipcRenderer.invoke('pty:stop', threadId),
    isRunning: (threadId) => ipcRenderer.invoke('pty:isRunning', threadId),
    onOutput: (callback) => {
      const listener = (_, threadId, data) => callback(threadId, data);
      ipcRenderer.on('pty:output', listener);
      return () => ipcRenderer.removeListener('pty:output', listener);
    },
    onExit: (callback) => {
      const listener = (_, threadId, code) => callback(threadId, code);
      ipcRenderer.on('pty:exit', listener);
      return () => ipcRenderer.removeListener('pty:exit', listener);
    },
    onSessionId: (callback) => {
      const listener = (_, threadId, sessionId) => callback(threadId, sessionId);
      ipcRenderer.on('pty:sessionId', listener);
      return () => ipcRenderer.removeListener('pty:sessionId', listener);
    },
  },
});
