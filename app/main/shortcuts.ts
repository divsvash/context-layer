import { BrowserWindow, globalShortcut } from 'electron';
import { getAppState } from './app';
import { focusMainWindow } from './windows';

let shortcutsRegistered = false;

export function registerShortcuts(window: BrowserWindow): void {
  const state = getAppState();
  
  if (shortcutsRegistered) {
    return;
  }
  
  const toggleShortcut = state.platform === 'darwin' 
    ? 'Command+Shift+C' 
    : 'Control+Shift+C';
  
  const registered = globalShortcut.register(toggleShortcut, () => {
    toggleOverlay(window);
  });
  
  if (registered) {
    shortcutsRegistered = true;
    if (state.isDev) {
      console.log(`Global shortcut registered: ${toggleShortcut}`);
    }
  } else {
    if (state.isDev) {
      console.warn(`Failed to register global shortcut: ${toggleShortcut}`);
    }
  }
  
  window.on('closed', () => {
    unregisterShortcuts();
  });
}

export function unregisterShortcuts(): void {
  if (shortcutsRegistered) {
    globalShortcut.unregisterAll();
    shortcutsRegistered = false;
  }
}

function toggleOverlay(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }
  
  if (window.isVisible()) {
    window.hide();
  } else {
    window.show();
    focusMainWindow();
  }
}