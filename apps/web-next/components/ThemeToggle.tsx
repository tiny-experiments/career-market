'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

/** Dark/light switch. Dark is the default; the choice is remembered in this browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('cm-theme', next);
    } catch {
      // storage unavailable: the theme still applies for this page view
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className={`theme-toggle is-${theme}`}
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label="Dark theme"
      onClick={toggle}
    >
      <span className="theme-toggle-knob" aria-hidden="true">
        {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
      </span>
    </button>
  );
}
