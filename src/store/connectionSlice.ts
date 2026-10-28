import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ConnectionStatus } from '../realtime/socketClient';

export type ResyncReason = 'connected' | 'gap';

interface ConnectionState {
  status: ConnectionStatus;
  reconnects: number;
  gapResyncs: number;
}

const initialState: ConnectionState = { status: 'idle', reconnects: 0, gapResyncs: 0 };

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    connectionStatusChanged(state, action: PayloadAction<ConnectionStatus>) {
      if (action.payload === 'open' && state.status === 'reconnecting') state.reconnects += 1;
      state.status = action.payload;
    },
    resyncStarted(state, action: PayloadAction<ResyncReason>) {
      if (action.payload === 'gap') state.gapResyncs += 1;
    },
  },
});

export const connectionReducer = connectionSlice.reducer;
export const { connectionStatusChanged, resyncStarted } = connectionSlice.actions;
