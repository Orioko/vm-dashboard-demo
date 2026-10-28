import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ConnectionStatus } from '../realtime/socketClient';

interface ConnectionState {
  status: ConnectionStatus;
  reconnects: number;
}

const initialState: ConnectionState = { status: 'idle', reconnects: 0 };

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    connectionStatusChanged(state, action: PayloadAction<ConnectionStatus>) {
      if (action.payload === 'open' && state.status === 'reconnecting') state.reconnects += 1;
      state.status = action.payload;
    },
  },
});

export const connectionReducer = connectionSlice.reducer;
export const { connectionStatusChanged } = connectionSlice.actions;
