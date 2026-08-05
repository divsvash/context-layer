import { BrowserWindow, Tray, Menu, nativeImage, app } from 'electron';
import { getAppState } from './app';
import { focusMainWindow } from './windows';

let trayInstance: Tray | null = null;

export function setupTray(window: BrowserWindow): void {
  const state = getAppState();
  
  const icon = createMinimalIcon();
  
  trayInstance = new Tray(icon);
  trayInstance.setToolTip('Cortex');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Cortex',
      click: () => {
        focusMainWindow();
        window.show();
      }
    },
    {
      label: 'Hide Cortex',
      click: () => {
        if (!window.isDestroyed()) {
          window.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Cortex',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  trayInstance.setContextMenu(contextMenu);
  
  trayInstance.on('double-click', () => {
    if (window.isDestroyed()) {
      return;
    }
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      window.focus();
    }
  });
  
  window.on('closed', () => {
    if (trayInstance) {
      trayInstance.destroy();
      trayInstance = null;
    }
  });
  
  if (state.isDev) {
    console.log('System tray initialized');
  }
}

export function destroyTray(): void {
  if (trayInstance) {
    trayInstance.destroy();
    trayInstance = null;
  }
}

function createMinimalIcon(): nativeImage {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = size / 2;
      const cy = size / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = size / 2;
      if (dist < maxDist * 0.7) {
        buffer[idx] = 70;
        buffer[idx + 1] = 130;
        buffer[idx + 2] = 255;
        buffer[idx + 3] = 255;
      } else if (dist < maxDist) {
        const alpha = 255 * (1 - (dist - maxDist * 0.7) / (maxDist * 0.3));
        buffer[idx] = 70;
        buffer[idx + 1] = 130;
        buffer[idx + 2] = 255;
        buffer[idx + 3] = Math.floor(alpha);
      } else {
        buffer[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}