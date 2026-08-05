import { BrowserWindow } from 'electron';
import { getAppState } from '../main/app';

export function configureTransparency(window: BrowserWindow): void {
  const state = getAppState();
  
  if (state.platform === 'darwin') {
    window.setVibrancy('fullscreen-ui');
  }
  
  window.setBackgroundColor('#00000000');
  
  if (state.isDev) {
    console.log('Transparency configured for overlay window');
  }
}