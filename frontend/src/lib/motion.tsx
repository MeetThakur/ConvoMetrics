import React, { useEffect, useRef, useState } from 'react';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement>(margin = '0px 0px -10% 0px'): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen];
}

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger index: each step adds 60 ms. */
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}

/** Fades and lifts its children in the first time they scroll into view. */
export const Reveal: React.FC<RevealProps> = ({ delay = 0, as = 'div', className = '', style, children, ...rest }) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? 'is-in' : ''} ${className}`}
      style={{ ...style, transitionDelay: `${delay * 60}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from 0 to `value` once visible. Decimals are kept as given. */
export function useCountUp(value: number, active: boolean, duration = 900): number {
  const [shown, setShown] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (!active) return;
    if (reduced() || duration <= 0) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(from + (value - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active, duration]);
  return shown;
}

interface CountProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/** A number that counts up when it first scrolls into view. */
export const Count: React.FC<CountProps> = ({ value, decimals = 0, suffix = '', className }) => {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const shown = useCountUp(value, seen);
  const text = (seen ? shown : 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref} className={className} aria-label={`${value.toLocaleString()}${suffix}`}>
      <span aria-hidden="true">
        {text}
        {suffix}
      </span>
    </span>
  );
};

/** Id of the section nearest the top of the viewport, for highlighting the sticky nav. */
export function useActiveSection(ids: string[], offset = 120): string {
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - offset <= 0) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids.join('|'), offset]);
  return active;
}
