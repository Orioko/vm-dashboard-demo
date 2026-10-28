import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useVmList } from '../hooks/useVmList';
import { useAppDispatch, useAppSelector } from '../store';
import { runVmAction } from '../store/tasksSlice';
import type { Vm, VmAction, VmStatus } from '../types';
import { PowerIcon, RestartIcon, StopIcon } from './Icons';
import type { InventoryScope } from './InventoryTree';
import { VmRow } from './VmRow';

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 32;
const MAX_VMS_PER_ACTION = 1000;
const METRIC_SORT_REFRESH_MS = 1000;
const METRIC_COLUMNS = new Set(['cpuUsage', 'memoryUsage']);

const STATE_FILTERS: { value: 'all' | VmStatus; label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'running', label: 'Powered on' },
  { value: 'stopped', label: 'Powered off' },
  { value: 'paused', label: 'Suspended' },
  { value: 'error', label: 'Error' },
];

const ACTIONS: { action: VmAction; label: string; icon: ReactNode }[] = [
  { action: 'start', label: 'Power on', icon: <PowerIcon /> },
  { action: 'stop', label: 'Shut down', icon: <StopIcon /> },
  { action: 'reboot', label: 'Restart', icon: <RestartIcon /> },
];

const columns: ColumnDef<Vm>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'status', accessorKey: 'status', header: 'State' },
  { id: 'host', accessorKey: 'host', header: 'Node' },
  { id: 'ipAddress', accessorKey: 'ipAddress', header: 'IP address' },
  { id: 'os', accessorKey: 'os', header: 'Guest OS' },
  { id: 'cpuUsage', accessorKey: 'cpuUsage', header: 'CPU' },
  { id: 'memoryUsage', accessorKey: 'memoryUsage', header: 'Memory' },
];

const formatCount = (value: number) => value.toLocaleString('en-US');

function matchesScope(vm: Vm, scope: InventoryScope) {
  if (scope.kind === 'cluster') return vm.cluster === scope.name;
  if (scope.kind === 'node') return vm.host === scope.name;
  return true;
}

function scopeTitle(scope: InventoryScope) {
  if (scope.kind === 'cluster') return scope.name;
  if (scope.kind === 'node') return `${scope.cluster} / ${scope.name}`;
  return 'All virtual machines';
}

export function VmTable({ scope }: { scope: InventoryScope }) {
  const dispatch = useAppDispatch();
  const requestedVmIds = useAppSelector((state) => state.tasks.requestedVmIds);
  const loadStatus = useAppSelector((state) => state.vms.loadStatus);
  const loadError = useAppSelector((state) => state.vms.error);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [stateFilter, setStateFilter] = useState<'all' | VmStatus>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const sortsByMetric = METRIC_COLUMNS.has(sorting[0]?.id ?? '');
  const vms = useVmList(sortsByMetric ? METRIC_SORT_REFRESH_MS : null);

  const scoped = useMemo(() => vms.filter((vm) => matchesScope(vm, scope)), [vms, scope]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle && stateFilter === 'all') return scoped;

    return scoped.filter(
      (vm) =>
        (stateFilter === 'all' || vm.status === stateFilter) &&
        (!needle || vm.name.includes(needle) || vm.ipAddress.startsWith(needle) || vm.host.includes(needle)),
    );
  }, [scoped, deferredQuery, stateFilter]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (vm) => vm.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    scrollMargin: HEADER_HEIGHT,
    getItemKey: (index) => rows[index].id,
  });

  const toggleRow = useCallback((id: string) => {
    setRowSelection((previous) => {
      const next = { ...previous };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const selectOnly = useCallback((id: string) => setRowSelection({ [id]: true }), []);

  useEffect(() => setRowSelection({}), [scope]);

  const selectedIds = useMemo(() => rows.filter((row) => rowSelection[row.id]).map((row) => row.id), [rows, rowSelection]);
  const allVisibleSelected = rows.length > 0 && selectedIds.length === rows.length;
  const tooManySelected = selectedIds.length > MAX_VMS_PER_ACTION;

  const toggleAllVisible = () => {
    setRowSelection(allVisibleSelected ? {} : Object.fromEntries(rows.map((row) => [row.id, true])));
  };

  const runAction = (action: VmAction) => {
    dispatch(runVmAction({ vmIds: selectedIds, action }));
  };

  let emptyMessage: string | null = null;
  if (rows.length === 0) {
    if (loadStatus === 'failed') emptyMessage = `Could not load the inventory: ${loadError}`;
    else if (vms.length === 0) emptyMessage = 'Loading inventory…';
    else emptyMessage = 'No virtual machines match the current filters.';
  }

  return (
    <section className="vm-table" aria-labelledby="vm-table-title">
      <div className="content__header">
        <h1 id="vm-table-title" className="content__title">
          {scopeTitle(scope)}
        </h1>
        <span className="content__subtitle">Virtual machines</span>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Virtual machine actions">
        <div className="toolbar__group">
          {ACTIONS.map(({ action, label, icon }) => (
            <button
              key={action}
              type="button"
              className="tool-button"
              disabled={selectedIds.length === 0 || tooManySelected}
              onClick={() => runAction(action)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar__group toolbar__group--filters">
          <select
            className="field"
            aria-label="Filter by state"
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as 'all' | VmStatus)}
          >
            {STATE_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="search"
            className="field field--search"
            placeholder="Filter by name, node or IP"
            aria-label="Filter by name, node or IP address"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="grid"
        role="grid"
        aria-labelledby="vm-table-title"
        aria-rowcount={rows.length + 1}
        aria-multiselectable
      >
        <div role="rowgroup" className="grid__head" style={{ height: HEADER_HEIGHT }}>
          <div role="row" aria-rowindex={1} className="grid__row grid__row--head">
            <div role="columnheader" className="grid__cell grid__cell--check">
              <input
                type="checkbox"
                aria-label="Select all virtual machines in the list"
                checked={allVisibleSelected}
                ref={(element) => {
                  if (element) element.indeterminate = selectedIds.length > 0 && !allVisibleSelected;
                }}
                onChange={toggleAllVisible}
              />
            </div>
            {table.getHeaderGroups()[0].headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <div
                  key={header.id}
                  role="columnheader"
                  className="grid__cell"
                  aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                >
                  <button type="button" className="sort-button" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span className="sort-button__icon" aria-hidden>
                      {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div role="rowgroup" className="grid__body" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const id = rows[item.index].id;
            return (
              <VmRow
                key={id}
                id={id}
                index={item.index}
                offset={item.start - HEADER_HEIGHT}
                selected={rowSelection[id] === true}
                requested={requestedVmIds[id] === true}
                onToggle={toggleRow}
                onSelectOnly={selectOnly}
              />
            );
          })}
        </div>

        {emptyMessage && <p className="grid__empty">{emptyMessage}</p>}
      </div>

      <div className="grid-footer">
        <span>
          {selectedIds.length > 0 && (
            <>
              {formatCount(selectedIds.length)} selected
              <button type="button" className="link-button" onClick={() => setRowSelection({})}>
                Clear selection
              </button>
              {tooManySelected && (
                <span className="grid-footer__warning">
                  Actions are limited to {formatCount(MAX_VMS_PER_ACTION)} VMs at a time
                </span>
              )}
            </>
          )}
        </span>
        <span>
          {rows.length === scoped.length
            ? `${formatCount(rows.length)} items`
            : `${formatCount(rows.length)} of ${formatCount(scoped.length)} items`}
          {sortsByMetric && ' · order refreshes every second'}
        </span>
      </div>
    </section>
  );
}
