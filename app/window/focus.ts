import { BrowserWindow } from 'electron';
import { getAppState } from '../main/app';

export function setupFocusBehavior(window: BrowserWindow): void {
  const state = getAppState();
  
  window.on('blur', () => {
    if (!state.isDev) {
      window.hide();
    }
  });
  
  window.on('focus', () => {
    window.setAlwaysOnTop(true);
  });
  
  if (state.isDev) {
    window.on('focus', () => {
      console.log('Overlay window focused');
    });
    window.on('blur', () => {
      console.log('Overlay window blurred');
    });
  }
}