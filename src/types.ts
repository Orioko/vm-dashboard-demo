export type VmStatus = 'running' | 'stopped' | 'paused' | 'starting' | 'stopping' | 'rebooting' | 'error';

export interface Vm {
  id: string;
  name: string;
  cluster: string;
  host: string;
  ipAddress: string;
  os: string;
  status: VmStatus;
  cpuUsage: number;
  memoryMb: number;
  memoryUsage: number;
  updatedAt: number;
}

export type VmAction = 'start' | 'stop' | 'reboot';

export type TaskStatus = 'running' | 'succeeded' | 'failed';

export interface Task {
  id: string;
  vmId: string;
  vmName: string;
  action: VmAction;
  status: TaskStatus;
  progress: number;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
}

export interface VmPatch {
  id: string;
  changes: Partial<Vm>;
  seq: number;
}

export const TRANSITIONAL_STATUSES: ReadonlySet<VmStatus> = new Set(['starting', 'stopping', 'rebooting']);

export const ALLOWED_ACTIONS: Record<VmStatus, readonly VmAction[]> = {
  running: ['stop', 'reboot'],
  stopped: ['start'],
  paused: ['start', 'stop'],
  error: ['start', 'stop'],
  starting: [],
  stopping: [],
  rebooting: [],
};
