import { getAppState } from './main/app';

interface CortexConfig {
  overlay: {
    defaultWidth: number;
    defaultHeight: number;
    collapsedHeight: number;
    expandedWidth: number;
    expandedHeight: number;
    marginFromEdge: number;
  };
  shortcuts: {
    toggle: string;
    generateContext: string;
    switchProject: string;
  };
  dev: {
    enableDevTools: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export function getConfig(): CortexConfig {
  const state = getAppState();
  
  return {
    overlay: {
      defaultWidth: 320,
      defaultHeight: 60,
      collapsedHeight: 60,
      expandedWidth: 380,
      expandedHeight: 280,
      marginFromEdge: 20,
    },
    shortcuts: {
      toggle: state.platform === 'darwin' ? 'Command+Shift+C' : 'Control+Shift+C',
      generateContext: state.platform === 'darwin' ? 'Command+Shift+G' : 'Control+Shift+G',
      switchProject: state.platform === 'darwin' ? 'Command+Shift+P' : 'Control+Shift+P',
    },
    dev: {
      enableDevTools: state.isDev,
      logLevel: state.isDev ? 'debug' : 'info',
    },
  };
}