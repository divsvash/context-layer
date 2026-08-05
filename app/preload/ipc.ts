export const IPC_CHANNELS = {
  PING: 'cortex:ping',
  QUIT: 'cortex:quit',
  TOGGLE_OVERLAY: 'cortex:toggle-overlay',
  FOCUS_WINDOW: 'cortex:focus-window',
  SET_EXPANDED: 'cortex:set-expanded',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];