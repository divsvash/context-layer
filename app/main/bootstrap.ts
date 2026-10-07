import { app, clipboard, ipcMain, safeStorage } from 'electron';
import { initializeApp } from './app';
import { createMainWindow, focusMainWindow, setWindowExpanded } from './windows';
import { setupStartup } from './startup';
import { setupTray } from './tray';
import { registerShortcuts } from './shortcuts';
import { IPC_CHANNELS } from '../preload/ipc';
import { SqliteStore } from '../../storage/sqlite/database';
import { CredentialStore } from '../../storage/credentials';
import { OpenAIUnderstandingExtractor } from '../../ai/providers/openai/extractor';
import { CortexCommands } from '../../commands/cortex';

let cortex: CortexCommands | null = null;

export async function bootstrap(): Promise<void> {
  try {
    initializeApp();
    const store = new SqliteStore(`${app.getPath('userData')}\\cortex.sqlite`);
    const credentials = new CredentialStore(store, {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (value) => safeStorage.encryptString(value).toString('base64'),
      decrypt: (value) => safeStorage.decryptString(Buffer.from(value, 'base64')),
    });
    const extractor = new OpenAIUnderstandingExtractor(() => credentials.getApiKey());
    cortex = new CortexCommands(store, extractor, credentials, () => clipboard.readText(), (content) => clipboard.writeText(content));
    cortex.start();
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

  ipcMain.handle(IPC_CHANNELS.GET_STATE, () => cortex?.state());
  ipcMain.handle(IPC_CHANNELS.GENERATE_CONTEXT, () => cortex?.generateContext() ?? '');
  ipcMain.handle(IPC_CHANNELS.CREATE_PROJECT, (_event, name: string) => cortex?.createProject(name));
  ipcMain.handle(IPC_CHANNELS.SWITCH_PROJECT, (_event, projectId: string) => cortex?.switchProject(projectId));
  ipcMain.handle(IPC_CHANNELS.RENAME_PROJECT, (_event, name: string) => cortex?.renameProject(name));
  ipcMain.handle(IPC_CHANNELS.DELETE_PROJECT, (_event, projectId: string) => cortex?.deleteProject(projectId));
  ipcMain.handle(IPC_CHANNELS.ADD_ENTRY, (_event, kind: string, content: string) => cortex?.addManualEntry(kind as any, content));
  ipcMain.handle(IPC_CHANNELS.UPDATE_ENTRY, (_event, entryId: string, kind: string, content: string) => cortex?.updateEntry(entryId, kind as any, content));
  ipcMain.handle(IPC_CHANNELS.DELETE_ENTRY, (_event, entryId: string) => cortex?.deleteEntry(entryId));
  ipcMain.handle(IPC_CHANNELS.SET_OBSERVING, (_event, observing: boolean) => observing ? cortex?.start() : cortex?.stop());
  ipcMain.handle(IPC_CHANNELS.SET_API_KEY, (_event, apiKey: string) => cortex?.setApiKey(apiKey));
  ipcMain.handle(IPC_CHANNELS.CLEAR_API_KEY, () => cortex?.clearApiKey());
}

export function closeCortex(): void {
  cortex?.close();
  cortex = null;
}
