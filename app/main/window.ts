import { BrowserWindow, screen } from 'electron';
import { createOverlayWindow } from '../window/overlay';
import { getOverlayBounds } from '../window/bounds';
import { getAppState } from './app';
import { getConfig } from '../config';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  const window = createOverlayWindow();
  mainWindow = window;

  window.on('closed', () => {
    mainWindow = null;
  });

  return window;
}

export function focusMainWindow(): boolean {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return true;
  }
  return false;
}

export function getMainWindow(): BrowserWindow | null {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  return null;
}

export function setWindowExpanded(expanded: boolean): void {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    return;
  }
  
  const config = getConfig();
  const width = expanded ? config.overlay.expandedWidth : config.overlay.defaultWidth;
  const height = expanded ? config.overlay.expandedHeight : config.overlay.collapsedHeight;
  
  mainWindow.setBounds({ width, height });
  
  if (expanded) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const x = Math.floor((screenWidth - width) / 2);
    const y = Math.floor((screenHeight - height) / 2);
    mainWindow.setPosition(x, y);
  } else {
    const bounds = getOverlayBounds();
    mainWindow.setBounds(bounds);
  }
}

export function handleActivate(): void {
  const state = getAppState();
  
  if (state.platform !== 'darwin') {
    return;
  }

  if (mainWindow === null || mainWindow.isDestroyed()) {
    createMainWindow();
  } else {
    mainWindow.focus();
  }
}

export function destroyMainWindow(): void {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  mainWindow = null;
}