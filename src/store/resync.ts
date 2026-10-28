import { type ResyncReason, resyncStarted } from './connectionSlice';
import type { AppDispatch } from './index';
import { fetchTasks } from './tasksSlice';
import { fetchVmsSnapshot } from './vmsSlice';

export const resync = (reason: ResyncReason) => (dispatch: AppDispatch) => {
  dispatch(resyncStarted(reason));
  dispatch(fetchVmsSnapshot());
  dispatch(fetchTasks());
};
