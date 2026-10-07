import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc';

const cortexAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),
  quit: () => ipcRenderer.send(IPC_CHANNELS.QUIT),
  toggleOverlay: () => ipcRenderer.send(IPC_CHANNELS.TOGGLE_OVERLAY),
  focusWindow: () => ipcRenderer.send(IPC_CHANNELS.FOCUS_WINDOW),
  setExpanded: (expanded: boolean) => ipcRenderer.send(IPC_CHANNELS.SET_EXPANDED, expanded),
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STATE),
  generateContext: () => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_CONTEXT),
  createProject: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_PROJECT, name),
  switchProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_PROJECT, projectId),
  addEntry: (kind: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.ADD_ENTRY, kind, content),
  updateEntry: (entryId: string, kind: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ENTRY, entryId, kind, content),
  deleteEntry: (entryId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ENTRY, entryId),
  renameProject: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.RENAME_PROJECT, name),
  deleteProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PROJECT, projectId),
  setObserving: (observing: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SET_OBSERVING, observing),
  setApiKey: (apiKey: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_API_KEY, apiKey),
  clearApiKey: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_API_KEY),
};

contextBridge.exposeInMainWorld('cortex', cortexAPI);

export type CortexAPI = typeof cortexAPI;
