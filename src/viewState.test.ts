import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEW, parseViewState, serializeViewState, type ViewState } from './viewState';

describe('view state in the URL', () => {
  it('uses the default view for an empty query string', () => {
    expect(parseViewState('')).toEqual(DEFAULT_VIEW);
    expect(serializeViewState(DEFAULT_VIEW)).toBe('');
  });

  it('round-trips a full view', () => {
    const view: ViewState = {
      scope: { kind: 'node', cluster: 'cluster-a', name: 'node-05' },
      sort: { id: 'cpuUsage', desc: true },
      stateFilter: 'running',
      query: 'web 10.10',
    };

    const search = serializeViewState(view);
    expect(search).toBe('?scope=cluster-a%2Fnode-05&sort=-cpuUsage&state=running&q=web+10.10');
    expect(parseViewState(search)).toEqual(view);
  });

  it('parses a cluster scope', () => {
    expect(parseViewState('?scope=cluster-b').scope).toEqual({ kind: 'cluster', name: 'cluster-b' });
  });

  it('falls back to defaults for unknown or malformed values', () => {
    const view = parseViewState('?scope=a/b/c&sort=-password&state=deleted');

    expect(view.scope).toEqual(DEFAULT_VIEW.scope);
    expect(view.sort).toEqual(DEFAULT_VIEW.sort);
    expect(view.stateFilter).toBe('all');
  });

  it('rejects scope names with unexpected characters', () => {
    expect(parseViewState('?scope=%3Cscript%3E').scope).toEqual(DEFAULT_VIEW.scope);
  });

  it('caps the search query length', () => {
    expect(parseViewState(`?q=${'x'.repeat(500)}`).query).toHaveLength(100);
  });
});
