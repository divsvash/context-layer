import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { getAppState } from '../main/app';
import { getOverlayBounds } from './bounds';
import { configureTransparency } from './transparency';
import { setupFocusBehavior } from './focus';
import { setupMonitorTracking } from './monitor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createOverlayWindow(): BrowserWindow {
  const state = getAppState();
  
  const bounds = getOverlayBounds();
  
  const window = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: !state.isDev,
      allowRunningInsecureContent: false,
    },
  });
  
  configureTransparency(window);
  setupFocusBehavior(window);
  const cleanupMonitor = setupMonitorTracking(window);
  setupWindowCleanup(window, cleanupMonitor);
  loadRenderer(window);
  
  window.once('ready-to-show', () => {
    window.show();
    if (state.isDev) {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  });
  
  return window;
}

function getPreloadPath(): string {
  // In both dev and production, the preload is at out/preload/index.js
  // __dirname is out/main/ when running from compiled output
  return join(__dirname, '../preload/index.js');
}

function loadRenderer(window: BrowserWindow): void {
  const isDev = getAppState().isDev;
  
  if (isDev) {
    window.loadURL('http://localhost:5173');
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function setupWindowCleanup(window: BrowserWindow, cleanupMonitor: () => void): void {
  window.on('closed', () => {
    cleanupMonitor();
  });
}