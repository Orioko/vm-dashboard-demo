import { useAppDispatch, useAppSelector } from '../store';
import { actionErrorDismissed } from '../store/tasksSlice';
import { AlertIcon, ErrorIcon } from './Icons';

export function AppAlerts() {
  const dispatch = useAppDispatch();
  const connection = useAppSelector((state) => state.connection.status);
  const hasData = useAppSelector((state) => state.vms.ids.length > 0);
  const actionError = useAppSelector((state) => state.tasks.actionError);

  return (
    <>
      {connection === 'reconnecting' && hasData && (
        <div className="app-alert app-alert--warning" role="alert">
          <AlertIcon />
          <span>Connection to the server was lost. The inventory may be out of date. Reconnecting…</span>
        </div>
      )}
      {actionError && (
        <div className="app-alert app-alert--danger" role="alert">
          <ErrorIcon />
          <span>{actionError}</span>
          <button
            type="button"
            className="app-alert__close"
            aria-label="Dismiss"
            onClick={() => dispatch(actionErrorDismissed())}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
