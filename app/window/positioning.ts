import { BrowserWindow, screen } from 'electron';
import { getOverlayBounds } from './bounds';

export function repositionToBottomRight(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }
  
  const bounds = getOverlayBounds();
  window.setBounds(bounds);
}

export function centerWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }
  
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  const windowBounds = window.getBounds();
  const x = Math.floor((width - windowBounds.width) / 2);
  const y = Math.floor((height - windowBounds.height) / 2);
  
  window.setPosition(x, y);
}

export function moveToDisplay(window: BrowserWindow, displayId: number): void {
  if (window.isDestroyed()) {
    return;
  }
  
  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find(d => d.id === displayId);
  
  if (!targetDisplay) {
    return;
  }
  
  const { x, y, width, height } = targetDisplay.workArea;
  const windowBounds = window.getBounds();
  
  const newX = x + width - windowBounds.width - 20;
  const newY = y + height - windowBounds.height - 20;
  
  window.setPosition(newX, newY);
}