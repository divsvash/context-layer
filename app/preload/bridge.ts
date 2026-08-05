import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc';

const cortexAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),
  quit: () => ipcRenderer.send(IPC_CHANNELS.QUIT),
  toggleOverlay: () => ipcRenderer.send(IPC_CHANNELS.TOGGLE_OVERLAY),
  focusWindow: () => ipcRenderer.send(IPC_CHANNELS.FOCUS_WINDOW),
  setExpanded: (expanded: boolean) => ipcRenderer.send(IPC_CHANNELS.SET_EXPANDED, expanded),
};

contextBridge.exposeInMainWorld('cortex', cortexAPI);

export type CortexAPI = typeof cortexAPI;