import { useCallback, useSyncExternalStore } from 'react';

/** Tablet landscape and desktop get the side panel layout. The single source for "wide". */
export const WIDE_QUERY = '(min-width: 900px), (orientation: landscape) and (min-width: 640px)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
