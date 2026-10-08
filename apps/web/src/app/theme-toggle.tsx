'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const transitionBusy = useRef(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggleTheme() {
    if (transitionBusy.current) return;
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    const button = buttonRef.current;
    const rect = button?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const root = document.documentElement;
    root.style.setProperty('--theme-origin-x', `${x}px`);
    root.style.setProperty('--theme-origin-y', `${y}px`);
    root.style.setProperty('--theme-radius', `${radius}px`);

    const applyTheme = () => {
      root.dataset.theme = nextTheme;
      setTheme(nextTheme);
      try {
        localStorage.setItem('growthos-theme', nextTheme);
      } catch {
        // The theme still works when browser storage is unavailable.
      }
    };

    if (
      document.startViewTransition &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      transitionBusy.current = true;
      const transition = document.startViewTransition(() => flushSync(applyTheme));
      void transition.finished.catch(() => {}).finally(() => { transitionBusy.current = false; });
    } else {
      applyTheme();
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={theme === 'dark'}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? (
        <Sun aria-hidden="true" size={21} />
      ) : (
        <Moon aria-hidden="true" size={21} />
      )}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
