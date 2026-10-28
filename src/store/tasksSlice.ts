import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import { eventsReceived } from '../realtime/events';
import type { Task, VmAction } from '../types';
import type { RootState } from './index';

const TASKS_LIMIT = 200;

const tasksAdapter = createEntityAdapter<Task>({
  sortComparer: (a, b) => b.startedAt - a.startedAt,
});

const initialState = tasksAdapter.getInitialState({
  requestedVmIds: {} as Record<string, true>,
  actionError: null as string | null,
});

type TasksState = typeof initialState;

interface ActionResponse {
  tasks: Task[];
  rejected: { vmId: string; reason: string }[];
}

export const runVmAction = createAsyncThunk(
  'tasks/runVmAction',
  async ({ vmIds, action }: { vmIds: string[]; action: VmAction }) => {
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vmIds, action }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
    return body as ActionResponse;
  },
);

export const fetchTasks = createAsyncThunk('tasks/fetch', async () => {
  const response = await fetch('/api/tasks');
  if (!response.ok) throw new Error(`Tasks request failed: HTTP ${response.status}`);
  return ((await response.json()) as { items: Task[] }).items;
});

function pruneFinished(state: TasksState) {
  const overflow = state.ids.length - TASKS_LIMIT;
  if (overflow <= 0) return;

  const removable = state.ids
    .slice()
    .reverse()
    .filter((id) => state.entities[id].status !== 'running')
    .slice(0, overflow);
  tasksAdapter.removeMany(state, removable);
}

function clearRequested(state: TasksState, vmIds: string[]) {
  for (const id of vmIds) delete state.requestedVmIds[id];
}

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    actionErrorDismissed(state) {
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runVmAction.pending, (state, action) => {
        for (const id of action.meta.arg.vmIds) state.requestedVmIds[id] = true;
        state.actionError = null;
      })
      .addCase(runVmAction.fulfilled, (state, action) => {
        tasksAdapter.addMany(state, action.payload.tasks);
        clearRequested(state, action.meta.arg.vmIds);
        pruneFinished(state);

        const { rejected } = action.payload;
        if (rejected.length > 0) {
          state.actionError = `${rejected.length} VM(s) skipped: ${rejected[0].reason}`;
        }
      })
      .addCase(runVmAction.rejected, (state, action) => {
        clearRequested(state, action.meta.arg.vmIds);
        state.actionError = action.error.message ?? 'Action failed';
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        tasksAdapter.upsertMany(state, action.payload);
        pruneFinished(state);
      })
      .addCase(eventsReceived, (state, action) => {
        const tasks: Task[] = [];
        for (const event of action.payload) {
          if (event.type === 'task.updated') tasks.push(event.payload);
        }
        if (tasks.length === 0) return;

        tasksAdapter.upsertMany(state, tasks);
        pruneFinished(state);
      });
  },
});

export const tasksReducer = tasksSlice.reducer;
export const { actionErrorDismissed } = tasksSlice.actions;

export const { selectAll: selectAllTasks } = tasksAdapter.getSelectors<RootState>((state) => state.tasks);
