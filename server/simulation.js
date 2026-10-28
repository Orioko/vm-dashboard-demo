import { createPicker } from './random.js';

const TRANSITIONS = {
  start: { from: ['stopped', 'paused', 'error'], during: 'starting', to: 'running' },
  stop: { from: ['running', 'paused', 'error'], during: 'stopping', to: 'stopped' },
  reboot: { from: ['running'], during: 'rebooting', to: 'running' },
};

const FAILURE_CHANCE_PER_STEP = 0.015;
const FAILURE_REASONS = [
  'Host is not responding',
  'Not enough free memory on host',
  'Storage request timed out',
  'Hypervisor rejected the operation',
];
const RECENT_TASKS_LIMIT = 200;

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

export function createSimulation({ vms, random, emit }) {
  const pick = createPicker(random);
  const ids = [...vms.keys()];
  const activeTasks = new Map();
  const recentTasks = [];
  let taskCounter = 0;

  function updateVm(vm, changes) {
    Object.assign(vm, changes, { updatedAt: Date.now() });
    emit({ type: 'vm.updated', payload: { id: vm.id, changes: { ...changes, updatedAt: vm.updatedAt } } });
  }

  function emitTask(task) {
    emit({ type: 'task.updated', payload: { ...task } });
  }

  function tick(eventCount) {
    for (let i = 0; i < eventCount; i++) {
      const vm = vms.get(pick(ids));
      if (vm.status !== 'running') continue;

      updateVm(vm, {
        cpuUsage: clampPercent(vm.cpuUsage + (random() - 0.5) * 30),
        memoryUsage: clampPercent(vm.memoryUsage + (random() - 0.5) * 8),
      });
    }
  }

  function startTasks(vmIds, action) {
    const transition = TRANSITIONS[action];
    const tasks = [];
    const rejected = [];

    for (const vmId of vmIds) {
      const vm = vms.get(vmId);

      if (!vm) {
        rejected.push({ vmId, reason: 'VM not found' });
        continue;
      }
      if (!transition.from.includes(vm.status)) {
        rejected.push({ vmId, reason: `Cannot ${action} a VM that is ${vm.status}` });
        continue;
      }

      const task = {
        id: `task-${++taskCounter}`,
        vmId,
        vmName: vm.name,
        action,
        status: 'running',
        progress: 0,
        error: null,
        startedAt: Date.now(),
        finishedAt: null,
      };

      activeTasks.set(task.id, task);
      updateVm(vm, { status: transition.during });
      emitTask(task);
      tasks.push({ ...task });
    }

    return { tasks, rejected };
  }

  function finishTask(task) {
    task.finishedAt = Date.now();
    activeTasks.delete(task.id);
    recentTasks.unshift(task);
    recentTasks.length = Math.min(recentTasks.length, RECENT_TASKS_LIMIT);
  }

  function stepTasks() {
    for (const task of activeTasks.values()) {
      const vm = vms.get(task.vmId);
      const transition = TRANSITIONS[task.action];

      if (random() < FAILURE_CHANCE_PER_STEP) {
        task.status = 'failed';
        task.error = pick(FAILURE_REASONS);
        finishTask(task);
        updateVm(vm, { status: 'error', cpuUsage: 0, memoryUsage: 0 });
        emitTask(task);
        continue;
      }

      task.progress = Math.min(100, task.progress + 5 + Math.round(random() * 20));

      if (task.progress === 100) {
        const running = transition.to === 'running';
        task.status = 'succeeded';
        finishTask(task);
        updateVm(vm, { status: transition.to, cpuUsage: running ? 5 : 0, memoryUsage: running ? 20 : 0 });
      }

      emitTask(task);
    }
  }

  function listTasks() {
    return [...activeTasks.values(), ...recentTasks].map((task) => ({ ...task }));
  }

  return { tick, startTasks, stepTasks, listTasks };
}
