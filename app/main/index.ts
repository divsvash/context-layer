import { app } from 'electron';
import { bootstrap } from './bootstrap';
import { shutdown } from './shutdown';
import { focusMainWindow, handleActivate } from './windows';

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusMainWindow();
  });

  app.whenReady().then(bootstrap).catch((error) => {
    console.error('Failed to bootstrap Cortex:', error);
    app.quit();
  });

  app.on('will-quit', shutdown);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    handleActivate();
  });
}