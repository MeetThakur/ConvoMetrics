import React, { useState, useRef } from 'react';
import { Progress } from '../lib/localAnalysis';

interface UploadDropzoneProps {
  onFileUpload: (file: File) => void;
  onLoadSample: () => void;
  isLoading: boolean;
  progress: Progress | null;
  error: string | null;
}

const FEATURES: [string, string][] = [
  ['Who talks, who listens', 'Share of messages, a balance score, who opens and who gets the last word.'],
  ['When it happens', 'A day-by-day calendar, a weekday × hour heatmap, streaks and milestones.'],
  ['How it sounds', 'Reply speed, rallies, laughter, questions, signature words and favourite emoji.'],
  ['Made to share', 'A share card drawn in your browser, with names hidden if you want.'],
];

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileUpload,
  onLoadSample,
  isLoading,
  progress,
  error,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (files: FileList | null) => {
    if (files && files.length > 0) onFileUpload(files[0]);
  };

  const stagger = (i: number) => ({ animationDelay: `${i * 90}ms` });

  return (
    <div className="relative max-w-2xl pt-14 sm:pt-20">
      <svg aria-hidden="true" className="hidden xl:block absolute left-[calc(100%+40px)] top-32 w-56" viewBox="0 0 224 270" fill="none">
        <rect x="8" y="10" width="168" height="92" rx="22" fill="rgb(var(--signal))" />
        <path d="M30 95v24l30-24" fill="rgb(var(--signal))" />
        <circle cx="52" cy="56" r="7" fill="#392035" />
        <circle cx="88" cy="56" r="7" fill="#392035" />
        <circle cx="124" cy="56" r="7" fill="#392035" />
        <rect x="55" y="131" width="160" height="112" rx="22" fill="#a4dcd5" />
        <path d="M193 235v25l-30-25" fill="#a4dcd5" />
        <path d="M82 211v-25m26 25v-46m26 46v-34m26 34v-58m26 58v-40" stroke="#305c61" strokeWidth="12" strokeLinecap="round" />
        <path d="M193 32v34m-17-17h34" stroke="#f6b580" strokeWidth="7" strokeLinecap="round" />
      </svg>
      <p className="rise-in text-xs uppercase tracking-[0.2em] text-muted mb-4" style={stagger(0)}>
        WhatsApp · Telegram · in your browser
      </p>
      <h1 className="rise-in font-sans font-semibold text-6xl sm:text-8xl leading-[0.98] tracking-[-0.065em] mb-6" style={stagger(1)}>
        Your chat,
        <br />
        <span className="text-accent">counted.</span>
      </h1>
      <p className="rise-in text-lg text-muted leading-relaxed mb-10 max-w-xl" style={stagger(2)}>
        Drop in a WhatsApp or Telegram export and get message counts, streaks, busiest hours, reply speed,
        and the words each of you leans on. Your export stays on your device.
      </p>

      {error && (
        <p role="alert" className="fade-in mb-6 border-l-2 border-accent pl-3 text-sm text-accent">
          {error}
        </p>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a chat export file"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!isLoading) pick(e.dataTransfer.files);
        }}
        onClick={() => !isLoading && inputRef.current?.click()}
        style={stagger(3)}
        className={`upload-zone rise-in relative px-7 py-7 transition-all duration-300 ${
          isLoading ? 'cursor-progress' : 'cursor-pointer'
        } ${
          isDragging
            ? 'marching scale-[1.01]'
            : 'hover:border-accent'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.json,.zip"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = ''; // lets the same file be chosen again after an error
          }}
          className="hidden"
          disabled={isLoading}
        />

        {isLoading && progress ? (
          <div aria-live="polite" className="fade-in">
            <p className="font-display text-2xl mb-1">
              {progress.phase === 'preparing' ? 'Loading the analysis engine…' : 'Analyzing on your device…'}
            </p>
            <p className="text-sm text-muted truncate mb-4">{progress.name}</p>
            <div className="h-1 bg-rule/60 overflow-hidden">
              <div className="w-full h-full shimmer" />
            </div>
          </div>
        ) : (
          <>
            <span className="upload-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" />
              </svg>
            </span>
            <p className="font-sans font-semibold text-xl mb-1">
              {isLoading ? (
                <span className="blink">Loading…</span>
              ) : isDragging ? (
                'Let go to count it'
              ) : (
                'Drop a file here, or click to choose'
              )}
            </p>
            <p className="text-sm text-muted">
              WhatsApp .txt, Telegram result.json, or a .zip of either, up to 50 MB
            </p>
          </>
        )}
      </div>

      <p className="rise-in mt-4 text-sm text-muted" style={stagger(4)}>
        No export handy?{' '}
        <button
          onClick={onLoadSample}
          disabled={isLoading}
          className="text-ink underline underline-offset-4 decoration-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          Look at a sample chat
        </button>{' '}
        — two fictional friends, two years, thirteen thousand messages.
      </p>

      <ul className="feature-list rise-in mt-12 grid sm:grid-cols-2 gap-x-8" style={stagger(5)}>
        {FEATURES.map(([title, body]) => (
          <li key={title} className="py-6">
            <h2 className="font-display text-lg mb-1">{title}</h2>
            <p className="text-sm text-muted leading-relaxed">{body}</p>
          </li>
        ))}
      </ul>

      <div
        className="rise-in mt-12 grid sm:grid-cols-2 gap-x-10 gap-y-8 border-t border-rule pt-8 text-sm leading-relaxed"
        style={stagger(6)}
      >
        <div>
          <h2 className="font-display text-lg mb-2">Exporting from WhatsApp</h2>
          <ol className="list-decimal list-inside text-muted space-y-1">
            <li>Open the chat, tap the contact or group name.</li>
            <li>Choose Export Chat, then Without Media.</li>
            <li>Open the .txt or .zip in ConvoMetrics.</li>
          </ol>
        </div>
        <div>
          <h2 className="font-display text-lg mb-2">Exporting from Telegram</h2>
          <ol className="list-decimal list-inside text-muted space-y-1">
            <li>In Telegram Desktop, open the chat menu (⋮).</li>
            <li>Choose Export chat history and untick media.</li>
            <li>Pick Machine-readable JSON and open result.json here.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
