import { app } from 'electron';
import { APP_NAME } from '../constants';
import { isDev, isProd, platform } from '../env';

export interface AppState {
  readonly name: string;
  readonly version: string;
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly platform: NodeJS.Platform;
}

let appState: AppState | null = null;

export function initializeApp(): void {
  if (appState !== null) {
    if (isDev) {
      console.warn('Cortex: initializeApp() called multiple times');
    }
    return;
  }

  appState = {
    name: APP_NAME,
    version: app.getVersion(),
    isDev,
    isProd,
    platform,
  };

  if (isDev) {
    console.log(`Cortex v${appState.version} initializing on ${platform}`);
  }
}

export function getAppState(): AppState {
  if (appState === null) {
    throw new Error('Cortex: initializeApp() must be called before getAppState()');
  }
  return appState;
}

export function isDevelopment(): boolean {
  return getAppState().isDev;
}

export function isProduction(): boolean {
  return getAppState().isProd;
}

export function getPlatform(): NodeJS.Platform {
  return getAppState().platform;
}