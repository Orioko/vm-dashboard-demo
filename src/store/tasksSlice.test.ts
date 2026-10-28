import { describe, expect, it } from 'vitest';

import { eventsReceived } from '../realtime/events';
import type { Task } from '../types';
import { runVmAction, tasksReducer } from './tasksSlice';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  vmId: 'vm-1',
  vmName: 'web-00001',
  action: 'start',
  status: 'running',
  progress: 0,
  error: null,
  startedAt: 1000,
  finishedAt: null,
  ...overrides,
});

const request = { vmIds: ['vm-1'], action: 'start' as const };

describe('tasksSlice: action request vs. socket events', () => {
  it('keeps the newer state when the socket event arrives before the HTTP response', () => {
    let state = tasksReducer(undefined, runVmAction.pending('r1', request));
    expect(state.requestedVmIds).toEqual({ 'vm-1': true });

    state = tasksReducer(state, eventsReceived([{ type: 'task.updated', seq: 7, payload: task({ progress: 40 }) }]));
    state = tasksReducer(state, runVmAction.fulfilled({ tasks: [task({ progress: 0 })], rejected: [] }, 'r1', request));

    expect(state.entities['task-1'].progress).toBe(40);
    expect(state.requestedVmIds).toEqual({});
  });

  it('adds the task from the HTTP response when no event has arrived yet', () => {
    let state = tasksReducer(undefined, runVmAction.pending('r1', request));
    state = tasksReducer(state, runVmAction.fulfilled({ tasks: [task()], rejected: [] }, 'r1', request));

    expect(state.ids).toEqual(['task-1']);
  });

  it('lets later socket events update a task created by the HTTP response', () => {
    let state = tasksReducer(undefined, runVmAction.fulfilled({ tasks: [task()], rejected: [] }, 'r1', request));
    state = tasksReducer(
      state,
      eventsReceived([{ type: 'task.updated', seq: 8, payload: task({ progress: 100, status: 'succeeded' }) }]),
    );

    expect(state.entities['task-1'].status).toBe('succeeded');
  });

  it('reports VMs the server refused to act on', () => {
    const state = tasksReducer(
      undefined,
      runVmAction.fulfilled(
        { tasks: [], rejected: [{ vmId: 'vm-1', reason: 'Cannot start a VM that is running' }] },
        'r1',
        request,
      ),
    );

    expect(state.actionError).toBe('1 VM(s) skipped: Cannot start a VM that is running');
  });

  it('clears the queued marker when the request fails', () => {
    let state = tasksReducer(undefined, runVmAction.pending('r1', request));
    state = tasksReducer(state, runVmAction.rejected(new Error('Network error'), 'r1', request));

    expect(state.requestedVmIds).toEqual({});
    expect(state.actionError).toBe('Network error');
  });
});
