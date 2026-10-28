import type { InventoryScope, VmStatus } from './types';

export const SORTABLE_COLUMNS = ['name', 'status', 'host', 'ipAddress', 'os', 'cpuUsage', 'memoryUsage'] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const STATE_FILTERS = ['all', 'running', 'stopped', 'paused', 'error'] as const satisfies readonly (
  | 'all'
  | VmStatus
)[];
export type StateFilter = (typeof STATE_FILTERS)[number];

export interface ViewState {
  scope: InventoryScope;
  sort: { id: SortableColumn; desc: boolean };
  stateFilter: StateFilter;
  query: string;
}

export const DEFAULT_VIEW: ViewState = {
  scope: { kind: 'all' },
  sort: { id: 'name', desc: false },
  stateFilter: 'all',
  query: '',
};

const NAME_PATTERN = /^[\w.-]+$/;

const isOneOf = <T extends string>(list: readonly T[], value: string | null): value is T =>
  value !== null && (list as readonly string[]).includes(value);

export function scopeToParam(scope: InventoryScope): string | null {
  if (scope.kind === 'cluster') return scope.name;
  if (scope.kind === 'node') return `${scope.cluster}/${scope.name}`;
  return null;
}

function parseScope(value: string | null): InventoryScope {
  if (!value) return DEFAULT_VIEW.scope;

  const parts = value.split('/');
  if (!parts.every((part) => NAME_PATTERN.test(part))) return DEFAULT_VIEW.scope;
  if (parts.length === 1) return { kind: 'cluster', name: parts[0] };
  if (parts.length === 2) return { kind: 'node', cluster: parts[0], name: parts[1] };
  return DEFAULT_VIEW.scope;
}

function parseSort(value: string | null): ViewState['sort'] {
  if (!value) return DEFAULT_VIEW.sort;

  const desc = value.startsWith('-');
  const id = desc ? value.slice(1) : value;
  return isOneOf(SORTABLE_COLUMNS, id) ? { id, desc } : DEFAULT_VIEW.sort;
}

export function parseViewState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const state = params.get('state');

  return {
    scope: parseScope(params.get('scope')),
    sort: parseSort(params.get('sort')),
    stateFilter: isOneOf(STATE_FILTERS, state) ? state : DEFAULT_VIEW.stateFilter,
    query: params.get('q')?.slice(0, 100) ?? '',
  };
}

export function serializeViewState(view: ViewState): string {
  const params = new URLSearchParams();

  const scope = scopeToParam(view.scope);
  if (scope) params.set('scope', scope);
  if (view.sort.id !== DEFAULT_VIEW.sort.id || view.sort.desc !== DEFAULT_VIEW.sort.desc) {
    params.set('sort', `${view.sort.desc ? '-' : ''}${view.sort.id}`);
  }
  if (view.stateFilter !== DEFAULT_VIEW.stateFilter) params.set('state', view.stateFilter);
  if (view.query) params.set('q', view.query);

  const search = params.toString();
  return search ? `?${search}` : '';
}
