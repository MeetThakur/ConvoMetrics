import React from 'react';
import { useTheme } from '../lib/theme';
import { useNames } from '../lib/names';

interface HeaderProps {
  onLoadSample: () => void;
  onReset: () => void;
  hasData: boolean;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onLoadSample, onReset, hasData, isLoading }) => {
  const [theme, toggleTheme] = useTheme();
  const { hidden, setHidden } = useNames();
  const link = 'text-muted hover:text-ink';

  return (
    <header className="border-b border-rule">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <button onClick={onReset} className="font-display text-lg tracking-tight">
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
              className={hidden ? 'text-accent' : link}
            >
              {hidden ? 'Show names' : 'Hide names'}
            </button>
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
            className={link}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
      </div>
    </header>
  );
};
