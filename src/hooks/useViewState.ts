import { useCallback, useEffect, useRef, useState } from 'react';

import { parseViewState, serializeViewState, type ViewState } from '../viewState';

export type HistoryMode = 'push' | 'replace';

export function useViewState() {
  const [view, setView] = useState(() => parseViewState(window.location.search));
  const viewRef = useRef(view);

  useEffect(() => {
    const onPopState = () => {
      viewRef.current = parseViewState(window.location.search);
      setView(viewRef.current);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const updateView = useCallback((patch: Partial<ViewState>, mode: HistoryMode = 'replace') => {
    const next = { ...viewRef.current, ...patch };
    viewRef.current = next;

    const url = `${window.location.pathname}${serializeViewState(next)}${window.location.hash}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);

    setView(next);
  }, []);

  return [view, updateView] as const;
}
