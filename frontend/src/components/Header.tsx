import React from 'react';
import { useTheme } from '../lib/theme';
import { useNames } from '../lib/names';

interface HeaderProps {
  onLoadSample: () => void;
  onReset: () => void;
  hasData: boolean;
  isLoading: boolean;
}

const Sun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({ onLoadSample, onReset, hasData, isLoading }) => {
  const [theme, toggleTheme] = useTheme();
  const { hidden, setHidden } = useNames();
  const link = 'text-muted hover:text-ink transition-colors';

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <button onClick={onReset} className="font-display text-lg tracking-tight flex items-center gap-2">
          <span aria-hidden="true" className="inline-block w-4 h-4 bg-accent" />
          ConvoMetrics
        </button>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {hasData && (
            <button onClick={onReset} className={link}>
              New file
            </button>
          )}
          <button onClick={onLoadSample} disabled={isLoading} className={`${link} disabled:opacity-50`}>
            Sample chat
          </button>
          {hasData && (
            <button
              onClick={() => setHidden(!hidden)}
              aria-pressed={hidden}
              title="Swap names for Person A, Person B… so screenshots are safe to share"
              className={`${hidden ? 'text-accent' : link} transition-colors`}
            >
              {hidden ? 'Show names' : 'Hide names'}
            </button>
          )}
          {hasData && (
            <a href="#share" className={`${link} hidden sm:inline`}>
              Share
            </a>
          )}
          <a
            href="https://github.com/MeetThakur/ConvoMetrics"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            GitHub
          </a>
          <button
            onClick={toggleTheme}
            className={`${link} inline-flex items-center gap-1.5`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
