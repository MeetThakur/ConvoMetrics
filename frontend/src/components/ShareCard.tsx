import React, { useRef, useState } from 'react';
import { ChatAnalytics } from '../types';
import { useNames } from '../lib/names';
import { Reveal } from '../lib/motion';
import { formatDate, formatDuration, formatSpan, hourLabel } from '../lib/format';
import { Section } from './Section';

type Theme = 'ink' | 'paper' | 'accent';

const THEMES: Record<Theme, { bg: string; fg: string; dim: string; hi: string }> = {
  ink: { bg: '#141b28', fg: '#f1f4f9', dim: '#a8b3c6', hi: '#ffb77e' },
  paper: { bg: '#fff7f5', fg: '#392035', dim: '#77586a', hi: '#b82b50' },
  accent: { bg: '#f8758f', fg: '#392035', dim: '#573047', hi: '#392035' },
};

interface Line {
  label: string;
  value: string;
  detail?: string;
}

/** The numbers worth posting, in plain words. Shared between the on-screen card, the PNG and the clipboard text. */
export function summaryLines(data: ChatAnalytics, label: (n: string) => string): Line[] {
  const { overview: o, wrapped: w, insights: i, participants } = data;
  const top = participants[0];
  const quick = [...i.responsiveness.per_sender].sort((a, b) => a.median_minutes - b.median_minutes)[0];
  const opener = [...i.openers.per_sender].sort((a, b) => b.opened - a.opened)[0];
  const emoji = data.emojis.overall[0];
  const lines: Line[] = [
    { label: 'Messages', value: o.total_messages.toLocaleString(), detail: `over ${formatSpan(o.span_days)}` },
    { label: 'Words', value: o.total_words.toLocaleString(), detail: w.book_pages ? `about ${w.book_pages.toLocaleString()} printed pages` : undefined },
    { label: 'Longest streak', value: `${w.max_streak} days`, detail: w.streak_start ? `from ${w.streak_start}` : undefined },
    { label: 'Busiest day', value: w.busiest_date ?? '', detail: w.busiest_count ? `${w.busiest_count.toLocaleString()} messages` : undefined },
    { label: 'Peak hour', value: w.peak_hour ?? hourLabel(i.heatmap.peak.hour), detail: `${i.heatmap.peak.day}s run hottest` },
  ];
  if (participants.length > 1 && top) {
    lines.push({ label: 'Talks most', value: label(top.name), detail: `${top.percentage}% of messages` });
  }
  if (quick && quick.replies >= 10) {
    lines.push({ label: 'Fastest reply', value: label(quick.name), detail: `${formatDuration(quick.median_minutes)} median` });
  }
  if (opener && participants.length > 1) {
    lines.push({ label: 'Starts the chat', value: label(opener.name), detail: `${opener.opened_share}% of conversations` });
  }
  if (emoji) lines.push({ label: 'Top emoji', value: emoji.emoji, detail: `${emoji.count.toLocaleString()} times` });
  return lines;
}

export function summaryText(data: ChatAnalytics, label: (n: string) => string): string {
  const { overview: o } = data;
  const who = data.participants.length === 2 ? `${label(data.participants[0].name)} & ${label(data.participants[1].name)}` : `${o.participants_count} people`;
  const head = `${who} · ${formatDate(o.date_start)} to ${formatDate(o.date_end)}`;
  const body = summaryLines(data, label)
    .map((l) => `${l.label}: ${l.value}${l.detail ? ` (${l.detail})` : ''}`)
    .join('\n');
  return `${head}\n\n${body}\n\nCounted with ConvoMetrics`;
}

/** Draws the card on a 1080x1350 canvas (a portrait post) and returns it as a PNG blob. */
async function renderPng(data: ChatAnalytics, label: (n: string) => string, theme: Theme): Promise<Blob> {
  const t = THEMES[theme];
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  try {
    await Promise.all([document.fonts.load('600 96px "Fraunces Variable"'), document.fonts.load('500 28px "Instrument Sans"')]);
  } catch {
    // fall back to system fonts
  }
  const serif = '"Fraunces Variable", Georgia, serif';
  const sans = '"Instrument Sans", system-ui, sans-serif';

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 84;
  const { overview: o } = data;
  const who =
    data.participants.length === 2
      ? `${label(data.participants[0].name)} & ${label(data.participants[1].name)}`
      : `${o.participants_count} people`;

  ctx.fillStyle = t.dim;
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(`${data.platform.toUpperCase()}  ·  ${formatDate(o.date_start)} – ${formatDate(o.date_end)}`, pad, pad + 26);

  ctx.fillStyle = t.fg;
  ctx.font = `600 84px ${serif}`;
  ctx.fillText(who, pad, pad + 130, W - pad * 2);

  ctx.fillStyle = t.hi;
  ctx.font = `600 190px ${serif}`;
  ctx.fillText(o.total_messages.toLocaleString(), pad, pad + 340, W - pad * 2);
  ctx.fillStyle = t.dim;
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(`messages in ${formatSpan(o.span_days)}`, pad, pad + 400);

  ctx.strokeStyle = t.dim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 450);
  ctx.lineTo(W - pad, pad + 450);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const lines = summaryLines(data, label).slice(1, 9);
  const rowH = 92;
  let y = pad + 520;
  for (const line of lines) {
    ctx.fillStyle = t.dim;
    ctx.font = `500 24px ${sans}`;
    ctx.fillText(line.label.toUpperCase(), pad, y);
    ctx.fillStyle = t.fg;
    ctx.font = `600 44px ${serif}`;
    ctx.fillText(line.value, pad, y + 48, 560);
    if (line.detail) {
      ctx.fillStyle = t.dim;
      ctx.font = `400 26px ${sans}`;
      ctx.textAlign = 'right';
      ctx.fillText(line.detail, W - pad, y + 44, 380);
      ctx.textAlign = 'left';
    }
    y += rowH;
  }

  ctx.fillStyle = t.dim;
  ctx.font = `500 24px ${sans}`;
  ctx.fillText('Counted with ConvoMetrics · nothing leaves your browser but this picture', pad, H - pad + 10);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the card.'))), 'image/png')
  );
}

export const ShareCard: React.FC<{ data: ChatAnalytics }> = ({ data }) => {
  const { label, hidden } = useNames();
  const [theme, setTheme] = useState<Theme>('ink');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | null>(null);
  const t = THEMES[theme];
  const lines = summaryLines(data, label);
  const { overview: o } = data;
  const who =
    data.participants.length === 2
      ? `${label(data.participants[0].name)} & ${label(data.participants[1].name)}`
      : `${o.participants_count} people`;

  const flash = (msg: string) => {
    setNote(msg);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2500);
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderPng(data, label, theme);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `convometrics-${o.date_start}-${o.date_end}.png`;
      a.click();
      URL.revokeObjectURL(url);
      flash('Saved as PNG.');
    } catch (e: any) {
      flash(e.message || 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  };

  const copyImage = async () => {
    setBusy(true);
    try {
      const blob = await renderPng(data, label, theme);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('Card copied. Paste it anywhere.');
    } catch {
      flash('This browser can’t copy images. Use Save PNG instead.');
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(data, label));
      flash('Summary copied as text.');
    } catch {
      flash('Could not copy. Select the text and copy it by hand.');
    }
  };

  const canCopyImage = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  const swatch = (k: Theme) =>
    `h-6 w-6 border transition-transform ${theme === k ? 'scale-110 border-ink' : 'border-rule hover:scale-105'}`;

  return (
    <Section
      title="Share card"
      note="A picture of the headline numbers, drawn in your browser."
      aside={
        <div className="flex items-center gap-2" role="group" aria-label="Card colour">
          {(Object.keys(THEMES) as Theme[]).map((k) => (
            <button
              key={k}
              onClick={() => setTheme(k)}
              aria-label={`${k} card`}
              aria-pressed={theme === k}
              className={swatch(k)}
              style={{ backgroundColor: THEMES[k].bg }}
            />
          ))}
        </div>
      }
    >
      <div className="grid lg:grid-cols-[minmax(0,26rem)_1fr] gap-x-10 gap-y-6 items-start">
        <Reveal
          className="aspect-[4/5] w-full p-7 sm:p-8 flex flex-col shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)] transition-colors duration-300"
          style={{ backgroundColor: t.bg, color: t.fg }}
        >
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: t.dim }}>
            {data.platform} · {formatDate(o.date_start)} – {formatDate(o.date_end)}
          </p>
          <p className="font-display text-2xl sm:text-3xl mt-3 leading-tight truncate">{who}</p>
          <p className="font-display text-6xl sm:text-7xl mt-4 leading-none tracking-tight" style={{ color: t.hi }}>
            {o.total_messages.toLocaleString()}
          </p>
          <p className="text-sm mt-2" style={{ color: t.dim }}>
            messages in {formatSpan(o.span_days)}
          </p>
          <div className="mt-5 pt-4 space-y-2.5 text-sm border-t" style={{ borderColor: `${t.dim}66` }}>
            {lines.slice(1, 7).map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <span className="truncate" style={{ color: t.dim }}>
                  {l.label}
                </span>
                <span className="font-medium text-right truncate">{l.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-auto pt-4 text-[11px]" style={{ color: t.dim }}>
            Counted with ConvoMetrics
          </p>
        </Reveal>

        <div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-solid" onClick={download} disabled={busy}>
              {busy ? 'Drawing…' : 'Save PNG'}
            </button>
            {canCopyImage && (
              <button className="btn" onClick={copyImage} disabled={busy}>
                Copy image
              </button>
            )}
            <button className="btn" onClick={copyText}>
              Copy as text
            </button>
          </div>
          <p className="mt-3 text-sm text-muted min-h-[1.5rem]" aria-live="polite">
            {note ?? 'The PNG is 1080×1350, sized for a story or a post.'}
          </p>
          <p className="mt-6 text-sm text-muted max-w-md">
            {hidden
              ? 'Names are hidden, so the card says Person A and Person B. Switch them back on in the header if you want real names.'
              : 'Posting this somewhere public? Use Hide names in the header first and the card will say Person A and Person B instead.'}
          </p>
          <pre className="mt-6 whitespace-pre-wrap font-sans text-sm text-muted border-l-2 border-rule pl-4 max-w-md">
            {summaryText(data, label)}
          </pre>
        </div>
      </div>
    </Section>
  );
};
