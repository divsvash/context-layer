import { app } from 'electron';
import { destroyMainWindow } from './windows';
import { unregisterShortcuts } from './shortcuts';
import { destroyTray } from './tray';
import { getAppState } from './app';
import { closeCortex } from './bootstrap';

export async function shutdown(): Promise<void> {
  const state = getAppState();

  if (state.isDev) {
    console.log('Cortex shutting down...');
  }

  unregisterShortcuts();
  closeCortex();
  destroyTray();
  destroyMainWindow();

  if (state.isDev) {
    console.log('Cortex shutdown complete');
  }
}
