import { memo, useEffect } from 'react';

import { metrics } from '../metrics';
import { useAppSelector } from '../store';
import { UsageBar } from './UsageBar';
import { VmState } from './VmState';

interface VmRowProps {
  id: string;
  index: number;
  offset: number;
  selected: boolean;
  requested: boolean;
  onToggle: (id: string) => void;
  onSelectOnly: (id: string) => void;
}

const formatMemory = (mb: number) => `of ${mb / 1024} GB`;

export const VmRow = memo(function VmRow({ id, index, offset, selected, requested, onToggle, onSelectOnly }: VmRowProps) {
  const vm = useAppSelector((state) => state.vms.entities[id]);

  useEffect(() => {
    metrics.rowCommits += 1;
  });

  if (!vm) return null;

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      className={`grid__row${selected ? ' grid__row--selected' : ''}`}
      style={{ transform: `translateY(${offset}px)` }}
      onClick={() => onSelectOnly(id)}
    >
      <div role="gridcell" className="grid__cell grid__cell--check">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select ${vm.name}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggle(id)}
        />
      </div>
      <div role="gridcell" className="grid__cell grid__cell--name">
        {vm.name}
      </div>
      <div role="gridcell" className="grid__cell">
        <VmState status={vm.status} requested={requested} />
      </div>
      <div role="gridcell" className="grid__cell">
        {vm.host}
      </div>
      <div role="gridcell" className="grid__cell grid__cell--mono">
        {vm.ipAddress}
      </div>
      <div role="gridcell" className="grid__cell grid__cell--muted">
        {vm.os}
      </div>
      <div role="gridcell" className="grid__cell">
        <UsageBar value={vm.cpuUsage} label={`CPU usage of ${vm.name}`} />
      </div>
      <div role="gridcell" className="grid__cell">
        <UsageBar value={vm.memoryUsage} label={`Memory usage of ${vm.name}`} detail={formatMemory(vm.memoryMb)} />
      </div>
    </div>
  );
});
