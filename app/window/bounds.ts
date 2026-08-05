import { screen } from 'electron';

const OVERLAY_WIDTH = 320;
const OVERLAY_HEIGHT = 60;
const OFFSET_FROM_EDGE = 20;

export function getOverlayBounds(): { width: number; height: number; x: number; y: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  const x = screenWidth - OVERLAY_WIDTH - OFFSET_FROM_EDGE;
  const y = screenHeight - OVERLAY_HEIGHT - OFFSET_FROM_EDGE;
  
  return {
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x,
    y,
  };
}

export function getOverlaySize(): { width: number; height: number } {
  return {
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
  };
}