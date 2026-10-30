import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PALETTE } from './theme';

interface NamesApi {
  hidden: boolean;
  setHidden: (v: boolean) => void;
  custom: Record<string, string>;
  rename: (name: string, value: string) => void;
  /** Name to show: "Person A" when hidden, a custom name if set, else the real one. */
  label: (name: string) => string;
  /** One colour per person, the same in every chart. */
  color: (name: string) => string;
  /** Hides real names inside free text (used for the first-message quote). */
  scrub: (text: string) => string;
  /** True for words that are part of someone's name (hidden from word lists when names are hidden). */
  isNameWord: (word: string) => boolean;
}

const NamesContext = createContext<NamesApi | null>(null);

const letter = (i: number) =>
  i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`;

export const NamesProvider: React.FC<{ people: string[]; children: React.ReactNode }> = ({
  people,
  children,
}) => {
  const [hidden, setHidden] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});

  const rename = useCallback((name: string, value: string) => {
    setCustom((c) => ({ ...c, [name]: value }));
  }, []);

  const api = useMemo<NamesApi>(() => {
    const index = new Map(people.map((n, i) => [n, i]));
    const crowded = people.length > 6;
    const alias = (name: string) => `Person ${letter(index.get(name) ?? 0)}`;

    const label = (name: string) => {
      if (name === 'Others' || !index.has(name)) return name;
      if (hidden) return alias(name);
      return custom[name]?.trim() || name;
    };

    const color = (name: string) => {
      const i = index.get(name);
      if (i === undefined) return PALETTE[5];
      // Past six people, only the top five get their own colour; the rest share grey.
      return crowded && i >= 5 ? PALETTE[5] : PALETTE[i % PALETTE.length];
    };

    const tokens = new Map<string, string>();
    people.forEach((n) => {
      tokens.set(n.toLowerCase(), alias(n));
      n.split(/\s+/)
        .filter((t) => t.length > 2)
        .forEach((t) => tokens.set(t.toLowerCase(), alias(n)));
    });
    const pattern = tokens.size
      ? new RegExp(
          [...tokens.keys()]
            .sort((a, b) => b.length - a.length)
            .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|'),
          'gi'
        )
      : null;

    return {
      hidden,
      setHidden,
      custom,
      rename,
      label,
      color,
      scrub: (text) => (hidden && pattern ? text.replace(pattern, (m) => tokens.get(m.toLowerCase()) ?? m) : text),
      isNameWord: (word) => hidden && tokens.has(word.toLowerCase()),
    };
  }, [people, hidden, custom, rename]);

  return <NamesContext.Provider value={api}>{children}</NamesContext.Provider>;
};

export function useNames(): NamesApi {
  const ctx = useContext(NamesContext);
  if (!ctx) throw new Error('useNames must be used inside NamesProvider');
  return ctx;
}
