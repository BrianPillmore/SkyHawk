import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that tracks whether a CSS media query matches.
 * SSR-safe: returns false during server-side rendering.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }

    // Fallback for older browsers
    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, [query]);

  return matches;
}

/** Returns true when viewport width is less than 768px */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** Returns true when viewport width is between 768px and 1024px (inclusive) */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
}

/** Returns true when viewport width is greater than 1024px */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1025px)');
}

/** Returns true when device is in portrait orientation */
export function useIsPortrait(): boolean {
  return useMediaQuery('(orientation: portrait)');
}
