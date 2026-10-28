import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { HistoryMode } from '../hooks/useViewState';
import { useVmList } from '../hooks/useVmList';
import { useAppDispatch, useAppSelector, useAppStore } from '../store';
import { runVmAction } from '../store/tasksSlice';
import { ALLOWED_ACTIONS, type InventoryScope, type Vm, type VmAction } from '../types';
import {
  scopeToParam,
  SORTABLE_COLUMNS,
  type SortableColumn,
  STATE_FILTERS,
  type StateFilter,
  type ViewState,
} from '../viewState';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { PowerIcon, RestartIcon, StopIcon } from './Icons';
import { VmRow } from './VmRow';

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 32;
const MAX_VMS_PER_ACTION = 1000;
const METRIC_SORT_REFRESH_MS = 1000;
const METRIC_COLUMNS = new Set<string>(['cpuUsage', 'memoryUsage']);

const STATE_FILTER_LABELS: Record<StateFilter, string> = {
  all: 'All states',
  running: 'Powered on',
  stopped: 'Powered off',
  paused: 'Suspended',
  error: 'Error',
};

const ACTIONS: { action: VmAction; label: string; icon: ReactNode }[] = [
  { action: 'start', label: 'Power on', icon: <PowerIcon /> },
  { action: 'stop', label: 'Shut down', icon: <StopIcon /> },
  { action: 'reboot', label: 'Restart', icon: <RestartIcon /> },
];

const columns: (ColumnDef<Vm> & { id: SortableColumn })[] = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'status', accessorKey: 'status', header: 'State' },
  { id: 'host', accessorKey: 'host', header: 'Node' },
  { id: 'ipAddress', accessorKey: 'ipAddress', header: 'IP address' },
  { id: 'os', accessorKey: 'os', header: 'Guest OS' },
  { id: 'cpuUsage', accessorKey: 'cpuUsage', header: 'CPU' },
  { id: 'memoryUsage', accessorKey: 'memoryUsage', header: 'Memory' },
];

const formatCount = (value: number) => value.toLocaleString('en-US');

const isSortable = (id: string): id is SortableColumn => (SORTABLE_COLUMNS as readonly string[]).includes(id);

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

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

interface MenuState {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
}

interface VmTableProps {
  view: ViewState;
  onViewChange: (patch: Partial<ViewState>, mode?: HistoryMode) => void;
}

export function VmTable({ view, onViewChange }: VmTableProps) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const requestedVmIds = useAppSelector((state) => state.tasks.requestedVmIds);
  const loadStatus = useAppSelector((state) => state.vms.loadStatus);
  const loadError = useAppSelector((state) => state.vms.error);

  const { scope, stateFilter } = view;
  const deferredQuery = useDeferredValue(view.query);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const sorting = useMemo<SortingState>(() => [{ id: view.sort.id, desc: view.sort.desc }], [view.sort]);
  const sortsByMetric = METRIC_COLUMNS.has(view.sort.id);
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

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const first = next[0];
    if (first && isSortable(first.id)) onViewChange({ sort: { id: first.id, desc: first.desc } });
  };

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, rowSelection },
    onSortingChange,
    onRowSelectionChange: setRowSelection,
    getRowId: (vm) => vm.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  const rows = table.getRowModel().rows;
  const focusableIndex = Math.min(activeIndex, rows.length - 1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    getItemKey: (index) => rows[index].id,
  });

  const rowElement = (index: number) =>
    scrollRef.current?.querySelector<HTMLElement>(`[role="row"][data-row-index="${index}"]`) ?? null;

  const focusRow = (index: number) => {
    setActiveIndex(index);
    virtualizer.scrollToIndex(index);

    let attempts = 0;
    const tryFocus = () => {
      const active = document.activeElement;
      if (active && active !== document.body && !scrollRef.current?.contains(active)) return;

      const element = rowElement(index);
      if (element) element.focus({ preventScroll: true });
      else if (attempts++ < 5) requestAnimationFrame(tryFocus);
    };
    requestAnimationFrame(tryFocus);
  };

  const scopeKey = scopeToParam(scope);
  useEffect(() => {
    setRowSelection({});
    setActiveIndex(0);
    setMenu(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scopeKey]);

  const toggleRow = useCallback((id: string) => {
    setRowSelection((previous) => {
      const next = { ...previous };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const selectOnly = useCallback((id: string) => setRowSelection({ [id]: true }), []);

  const selectedIds = useMemo(() => rows.filter((row) => rowSelection[row.id]).map((row) => row.id), [rows, rowSelection]);
  const allVisibleSelected = rows.length > 0 && selectedIds.length === rows.length;
  const tooManySelected = selectedIds.length > MAX_VMS_PER_ACTION;

  const selectAllVisible = () => setRowSelection(Object.fromEntries(rows.map((row) => [row.id, true])));
  const toggleAllVisible = () => (allVisibleSelected ? setRowSelection({}) : selectAllVisible());

  const runAction = (vmIds: string[], action: VmAction) => {
    dispatch(runVmAction({ vmIds, action }));
  };

  const buildMenuItems = (targetIds: string[]): MenuItem[] => {
    const entities = store.getState().vms.entities;
    const targets = targetIds.map((id) => entities[id]).filter(Boolean);
    const single = targets.length === 1 ? targets[0] : null;
    const allows = (action: VmAction) =>
      targets.length <= MAX_VMS_PER_ACTION &&
      targets.some((vm) => !requestedVmIds[vm.id] && ALLOWED_ACTIONS[vm.status].includes(action));

    const items: MenuItem[] = ACTIONS.map(({ action, label, icon }) => ({
      id: action,
      label: single ? label : `${label} (${formatCount(targets.length)})`,
      icon,
      disabled: !allows(action),
      onSelect: () => runAction(targetIds, action),
    }));

    items.push(
      {
        id: 'copy-name',
        label: single ? 'Copy name' : `Copy ${formatCount(targets.length)} names`,
        separatorBefore: true,
        onSelect: () => copyToClipboard(targets.map((vm) => vm.name).join('\n')),
      },
      {
        id: 'copy-ip',
        label: single ? 'Copy IP address' : `Copy ${formatCount(targets.length)} IP addresses`,
        onSelect: () => copyToClipboard(targets.map((vm) => vm.ipAddress).join('\n')),
      },
    );

    if (single && scope.kind !== 'node') {
      items.push({
        id: 'show-node',
        label: `Show node ${single.host}`,
        separatorBefore: true,
        onSelect: () => onViewChange({ scope: { kind: 'node', cluster: single.cluster, name: single.host } }, 'push'),
      });
    }

    return items;
  };

  const latest = useRef({ selectedIds, buildMenuItems });
  latest.current = { selectedIds, buildMenuItems };

  const openMenu = useCallback((id: string, x: number, y: number) => {
    const { selectedIds: selected, buildMenuItems: build } = latest.current;
    const targets = selected.includes(id) ? selected : [id];
    if (!selected.includes(id)) setRowSelection({ [id]: true });

    setMenu({ x, y, label: 'Virtual machine actions', items: build(targets) });
  }, []);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const closeMenu = useCallback(({ restoreFocus }: { restoreFocus: boolean }) => {
    setMenu(null);
    if (restoreFocus) {
      requestAnimationFrame(() =>
        scrollRef.current
          ?.querySelector<HTMLElement>(`[role="row"][data-row-index="${activeIndexRef.current}"]`)
          ?.focus({ preventScroll: true }),
      );
    }
  }, []);

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute('role') !== 'row' || rows.length === 0) return;

    const current = focusableIndex;
    const visibleRows = Math.floor(((scrollRef.current?.clientHeight ?? 0) - HEADER_HEIGHT) / ROW_HEIGHT);
    const pageSize = Math.max(1, visibleRows - 1);
    let next: number;

    switch (event.key) {
      case 'ArrowDown':
        next = current + 1;
        break;
      case 'ArrowUp':
        next = current - 1;
        break;
      case 'PageDown':
        next = current + pageSize;
        break;
      case 'PageUp':
        next = current - pageSize;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = rows.length - 1;
        break;
      case ' ':
        event.preventDefault();
        toggleRow(rows[current].id);
        return;
      case 'Enter':
        event.preventDefault();
        selectOnly(rows[current].id);
        return;
      case 'Escape':
        setRowSelection({});
        return;
      case 'a':
      case 'A':
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        selectAllVisible();
        return;
      case 'F10':
      case 'ContextMenu': {
        if (event.key === 'F10' && !event.shiftKey) return;
        event.preventDefault();
        const rect = target.getBoundingClientRect();
        openMenu(rows[current].id, rect.left + 48, rect.bottom);
        return;
      }
      default:
        return;
    }

    event.preventDefault();
    next = Math.max(0, Math.min(rows.length - 1, next));

    if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const from = rows[current].id;
      const to = rows[next].id;
      setRowSelection((previous) => ({ ...previous, [from]: true, [to]: true }));
    }

    focusRow(next);
  };

  const onFocusRow = useCallback((index: number) => setActiveIndex(index), []);

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
              onClick={() => runAction(selectedIds, action)}
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
            onChange={(event) => onViewChange({ stateFilter: event.target.value as StateFilter })}
          >
            {STATE_FILTERS.map((value) => (
              <option key={value} value={value}>
                {STATE_FILTER_LABELS[value]}
              </option>
            ))}
          </select>
          <input
            type="search"
            className="field field--search"
            placeholder="Filter by name, node or IP"
            aria-label="Filter by name, node or IP address"
            value={view.query}
            onChange={(event) => onViewChange({ query: event.target.value })}
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
        onKeyDown={onGridKeyDown}
        onScroll={menu ? () => closeMenu({ restoreFocus: false }) : undefined}
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
                focusable={item.index === focusableIndex}
                onToggle={toggleRow}
                onSelectOnly={selectOnly}
                onFocusRow={onFocusRow}
                onOpenMenu={openMenu}
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

      {menu && <ContextMenu label={menu.label} x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </section>
  );
}
