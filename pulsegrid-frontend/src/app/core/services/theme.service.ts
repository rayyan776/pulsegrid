import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pulsegrid.theme';

function loadInitial(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage blocked — fall through
  }
  // No saved preference yet: default to the visitor's OS-level preference.
  const prefersDark = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemeMode>(loadInitial());

  constructor() {
    // Reflect the current theme onto <html data-theme="..."> so styles.scss's
    // [data-theme="dark"] override block takes effect, and persist the choice
    // so it survives a refresh (the toggle is otherwise just in-memory state).
    effect(() => {
      const mode = this.theme();
      document.documentElement.setAttribute('data-theme', mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // storage full/blocked — theme still works for this session
      }
    });
  }

  toggle(): void {
    this.theme.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }

  set(mode: ThemeMode): void {
    this.theme.set(mode);
  }
}
