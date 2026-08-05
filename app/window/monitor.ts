import { BrowserWindow, screen } from 'electron';
import { getOverlayBounds } from './bounds';

export function setupMonitorTracking(window: BrowserWindow): () => void {
  const onDisplayChange = () => {
    if (window.isDestroyed()) {
      return;
    }
    const bounds = getOverlayBounds();
    window.setBounds(bounds);
  };

  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  screen.on('display-metrics-changed', onDisplayChange);

  return () => {
    screen.removeListener('display-added', onDisplayChange);
    screen.removeListener('display-removed', onDisplayChange);
    screen.removeListener('display-metrics-changed', onDisplayChange);
  };
}