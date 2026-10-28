import { TRANSITIONAL_STATUSES, type VmStatus } from '../types';
import { ErrorIcon, PauseIcon, PlayIcon, SpinnerIcon, StopIcon } from './Icons';

const STATE_LABELS: Record<VmStatus, string> = {
  running: 'Powered on',
  stopped: 'Powered off',
  paused: 'Suspended',
  starting: 'Powering on…',
  stopping: 'Shutting down…',
  rebooting: 'Restarting…',
  error: 'Error',
};

export function VmState({ status, requested }: { status: VmStatus; requested: boolean }) {
  const busy = requested || TRANSITIONAL_STATUSES.has(status);
  const tone = busy ? 'busy' : status;

  return (
    <span className={`vm-state vm-state--${tone}`}>
      {busy && <SpinnerIcon />}
      {tone === 'running' && <PlayIcon />}
      {tone === 'stopped' && <StopIcon />}
      {tone === 'paused' && <PauseIcon />}
      {tone === 'error' && <ErrorIcon />}
      {requested ? 'Queued…' : STATE_LABELS[status]}
    </span>
  );
}
