import { useState } from 'react';

import { useAppSelector } from '../store';
import { selectAllTasks } from '../store/tasksSlice';
import type { Task, VmAction } from '../types';
import { CheckIcon, ChevronIcon, ErrorIcon } from './Icons';

const VISIBLE_TASKS = 50;

const TASK_NAMES: Record<VmAction, string> = {
  start: 'Power on virtual machine',
  stop: 'Shut down virtual machine',
  reboot: 'Restart virtual machine',
};

const formatTime = (timestamp: number | null) =>
  timestamp === null
    ? '—'
    : new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function TaskStatus({ task }: { task: Task }) {
  if (task.status === 'succeeded') {
    return (
      <span className="task-status task-status--ok">
        <CheckIcon />
        Completed
      </span>
    );
  }

  if (task.status === 'failed') {
    return (
      <span className="task-status task-status--failed" title={task.error ?? undefined}>
        <ErrorIcon />
        Failed: {task.error}
      </span>
    );
  }

  return (
    <span className="task-status">
      <span
        className="task-progress"
        role="progressbar"
        aria-label={`${TASK_NAMES[task.action]} ${task.vmName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={task.progress}
      >
        <span className="task-progress__fill" style={{ transform: `scaleX(${task.progress / 100})` }} />
      </span>
      {task.progress}%
    </span>
  );
}

export function TasksPanel() {
  const [expanded, setExpanded] = useState(true);
  const tasks = useAppSelector(selectAllTasks);
  const running = tasks.filter((task) => task.status === 'running').length;
  const failed = tasks.filter((task) => task.status === 'failed').length;

  return (
    <section className={`tasks${expanded ? '' : ' tasks--collapsed'}`} aria-label="Recent tasks">
      <div className="tasks__bar">
        <button type="button" className="tasks__toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <ChevronIcon className={expanded ? 'chevron chevron--open' : 'chevron'} />
          Recent tasks
        </button>
        <span className="tasks__meta">
          {running} running · {failed} failed
        </span>
      </div>

      {expanded && (
        <div className="tasks__body">
          <table className="tasks-table">
            <thead>
              <tr>
                <th scope="col">Task name</th>
                <th scope="col">Target</th>
                <th scope="col">Status</th>
                <th scope="col">Start time</th>
                <th scope="col">Completion time</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tasks-table__empty">
                    No recent tasks. Select virtual machines and use Power on, Shut down or Restart.
                  </td>
                </tr>
              ) : (
                tasks.slice(0, VISIBLE_TASKS).map((task) => (
                  <tr key={task.id}>
                    <td>{TASK_NAMES[task.action]}</td>
                    <td className="tasks-table__target">{task.vmName}</td>
                    <td>
                      <TaskStatus task={task} />
                    </td>
                    <td className="tasks-table__time">{formatTime(task.startedAt)}</td>
                    <td className="tasks-table__time">{formatTime(task.finishedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
