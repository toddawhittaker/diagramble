// Light and dark mode. The app follows the computer's setting until the user picks one.

import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'diagramble.prototype.theme';
const listeners = new Set<() => void>();

function systemMode(): ThemeMode {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedMode(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

let mode: ThemeMode = storedMode() ?? systemMode();

function show(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = mode;
  for (const l of listeners) l();
}

/** Call once before the app is drawn. */
export function initTheme(): void {
  show();
  if (typeof matchMedia === 'undefined') return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (storedMode() !== null) return;
    mode = systemMode();
    show();
  });
}

/** Sets the mode and remembers the choice. */
export function setTheme(next: ThemeMode): void {
  mode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still holds until the page is closed.
  }
  show();
}

/** The current mode. Use it where CSS variables cannot reach, such as React Flow's `colorMode`. */
export function useTheme(): ThemeMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}
