import { app, ipcMain } from 'electron';
import { initializeApp } from './app';
import { createMainWindow, focusMainWindow, setWindowExpanded } from './windows';
import { setupStartup } from './startup';
import { setupTray } from './tray';
import { registerShortcuts } from './shortcuts';
import { IPC_CHANNELS } from '../preload/ipc';

export async function bootstrap(): Promise<void> {
  try {
    initializeApp();
    setupIpcHandlers();
    const window = createMainWindow();
    await setupStartup();
    setupTray(window);
    registerShortcuts(window);
    console.log('Cortex bootstrapped successfully');
  } catch (error) {
    console.error('Failed to bootstrap Cortex:', error);
    throw error;
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PING, () => {
    return 'pong';
  });

  ipcMain.on(IPC_CHANNELS.QUIT, () => {
    app.quit();
  });

  ipcMain.on(IPC_CHANNELS.TOGGLE_OVERLAY, () => {
    const window = createMainWindow();
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      focusMainWindow();
    }
  });

  ipcMain.on(IPC_CHANNELS.FOCUS_WINDOW, () => {
    focusMainWindow();
  });

  ipcMain.on(IPC_CHANNELS.SET_EXPANDED, (_event, expanded: boolean) => {
    setWindowExpanded(expanded);
  });
}