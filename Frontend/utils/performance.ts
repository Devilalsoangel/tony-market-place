/**
 * Performance optimization utilities for React Native
 * Provides memoized callbacks and event handlers for list rendering
 */

import {useCallback, useMemo, useRef} from 'react';

/**
 * Creates a stable callback for handling list item interactions
 * Prevents unnecessary re-renders when properties change
 */
export function useListItemHandler<T extends {id: number | string}>(
  onItemPressed: (item: T) => void
) {
  return useCallback(
    (item: T) => {
      onItemPressed(item);
    },
    [onItemPressed]
  );
}

/**
 * Creates a stable callback for text input changes
 * Common pattern for search/filter inputs in lists
 */
export function useTextChangeHandler(
  onChangeText: (text: string) => void
) {
  return useCallback(
    (text: string) => {
      onChangeText(text);
    },
    [onChangeText]
  );
}

/**
 * Creates a stable callback for toggle switches
 * Commonly used for filters, watchlist toggles, etc.
 */
export function useToggleHandler(
  onToggle: (onToggled: (prev: boolean) => boolean) => void
) {
  return useCallback(
    () => {
      onToggle((prev: boolean) => !prev);
    },
    [onToggle]
  );
}

/**
 * Memoizes a computed list based on filter criteria
 * Prevents recomputation when data hasn't changed
 */
export function useFilteredList<T>(
  items: T[],
  filterFn: (item: T) => boolean
): T[] {
  return useMemo(() => items.filter(filterFn), [items, filterFn]);
}

/**
 * Memoizes a sorted list based on sort criteria
 * Useful for maintaining sort order in markets/feeds
 */
export function useSortedList<T>(
  items: T[],
  sortFn: (a: T, b: T) => number
): T[] {
  return useMemo(() => [...items].sort(sortFn), [items, sortFn]);
}

/**
 * Creates a debounced callback for expensive operations
 * Use for API calls triggered by user input
 */
export function useDebouncedCallback<T extends any[]>(
  callback: (...args: T) => void,
  delay: number = 300
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Type-safe event handler factory
 * Creates handlers that properly type event objects
 */
export function createEventHandler<E = any>(
  handler: (e: E) => void,
  deps: React.DependencyList
) {
  return useCallback(handler, deps);
}

/**
 * Memoizes array comparison (useful for deps arrays)
 * Prevents re-renders when array contents haven't changed
 */
export function useArrayMemo<T>(array: T[]): T[] {
  return useMemo(() => array, [JSON.stringify(array)]);
}
