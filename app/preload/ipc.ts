export const IPC_CHANNELS = {
  PING: 'cortex:ping',
  QUIT: 'cortex:quit',
  TOGGLE_OVERLAY: 'cortex:toggle-overlay',
  FOCUS_WINDOW: 'cortex:focus-window',
  SET_EXPANDED: 'cortex:set-expanded',
  GET_STATE: 'cortex:get-state',
  GENERATE_CONTEXT: 'cortex:generate-context',
  CREATE_PROJECT: 'cortex:create-project',
  SWITCH_PROJECT: 'cortex:switch-project',
  ADD_ENTRY: 'cortex:add-entry',
  UPDATE_ENTRY: 'cortex:update-entry',
  DELETE_ENTRY: 'cortex:delete-entry',
  RENAME_PROJECT: 'cortex:rename-project',
  DELETE_PROJECT: 'cortex:delete-project',
  SET_OBSERVING: 'cortex:set-observing',
  SET_API_KEY: 'cortex:set-api-key',
  CLEAR_API_KEY: 'cortex:clear-api-key',
  PROCESS_PENDING_EVIDENCE: 'cortex:process-pending-evidence',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
