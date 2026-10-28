import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import { eventsReceived } from '../realtime/events';
import type { Vm, VmPatch } from '../types';
import type { RootState } from './index';

const vmsAdapter = createEntityAdapter<Vm>();

type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

const initialState = vmsAdapter.getInitialState({
  loadStatus: 'idle' as LoadStatus,
  error: null as string | null,
  snapshotSeq: 0,
  snapshotRequestId: null as string | null,
  structureVersion: 0,
  pendingPatches: [] as VmPatch[],
});

type VmsState = typeof initialState;

export const fetchVmsSnapshot = createAsyncThunk('vms/fetchSnapshot', async () => {
  const response = await fetch('/api/vms');
  if (!response.ok) throw new Error(`Snapshot request failed: HTTP ${response.status}`);
  return (await response.json()) as { items: Vm[]; seq: number };
});

const STRUCTURAL_FIELDS: ReadonlyArray<keyof Vm> = ['name', 'cluster', 'host', 'ipAddress', 'os', 'status'];

function applyPatches(state: VmsState, patches: VmPatch[]) {
  let structural = false;

  for (const patch of patches) {
    if (patch.seq <= state.snapshotSeq) continue;
    vmsAdapter.updateOne(state, { id: patch.id, changes: patch.changes });
    structural ||= STRUCTURAL_FIELDS.some((field) => field in patch.changes);
  }

  if (structural) state.structureVersion += 1;
}

const vmsSlice = createSlice({
  name: 'vms',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVmsSnapshot.pending, (state, action) => {
        state.loadStatus = 'loading';
        state.error = null;
        state.snapshotRequestId = action.meta.requestId;
        state.pendingPatches = [];
      })
      .addCase(fetchVmsSnapshot.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.snapshotRequestId) return;

        vmsAdapter.setAll(state, action.payload.items);
        state.snapshotSeq = action.payload.seq;
        state.structureVersion += 1;
        state.loadStatus = 'ready';

        const pending = state.pendingPatches;
        state.pendingPatches = [];
        applyPatches(state, pending);
      })
      .addCase(fetchVmsSnapshot.rejected, (state, action) => {
        if (action.meta.requestId !== state.snapshotRequestId) return;

        state.loadStatus = 'failed';
        state.error = action.error.message ?? 'Unknown error';
        state.pendingPatches = [];
      })
      .addCase(eventsReceived, (state, action) => {
        const patches: VmPatch[] = [];
        for (const event of action.payload) {
          if (event.type === 'vm.updated') {
            patches.push({ id: event.payload.id, changes: event.payload.changes, seq: event.seq });
          }
        }
        if (patches.length === 0) return;

        if (state.loadStatus === 'loading') {
          state.pendingPatches.push(...patches);
          return;
        }
        applyPatches(state, patches);
      });
  },
});

export const vmsReducer = vmsSlice.reducer;

export const {
  selectAll: selectAllVms,
  selectById: selectVmById,
  selectTotal: selectVmCount,
} = vmsAdapter.getSelectors<RootState>((state) => state.vms);
