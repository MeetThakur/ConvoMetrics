import React, { useState, useRef } from 'react';
import { Progress } from '../lib/api';

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
    <div className="max-w-2xl pt-14 sm:pt-20">
      <p className="rise-in text-xs uppercase tracking-[0.2em] text-muted mb-4" style={stagger(0)}>
        WhatsApp · Telegram · in your browser
      </p>
      <h1 className="rise-in font-display text-5xl sm:text-7xl leading-[1.02] tracking-tight mb-6" style={stagger(1)}>
        Your chat,
        <br />
        <span className="text-accent">counted.</span>
      </h1>
      <p className="rise-in text-lg text-muted leading-relaxed mb-10 max-w-xl" style={stagger(2)}>
        Drop in a WhatsApp or Telegram export and get message counts, streaks, busiest hours, reply speed,
        and the words each of you leans on. The file is read in memory and never saved.
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
        className={`rise-in relative px-6 py-12 transition-all duration-300 ${
          isLoading ? 'cursor-progress' : 'cursor-pointer'
        } ${
          isDragging
            ? 'marching bg-accent/5 scale-[1.01]'
            : 'border border-dashed border-ink hover:bg-ink/[0.03] hover:border-accent'
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
              {progress.phase === 'uploading' ? `Reading ${progress.pct}%` : 'Counting messages…'}
            </p>
            <p className="text-sm text-muted truncate mb-4">{progress.name}</p>
            <div className="h-1 bg-rule/60 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ${
                  progress.phase === 'analysing' ? 'shimmer' : 'bg-accent'
                }`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="font-display text-2xl mb-1">
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

      <ul className="rise-in mt-16 grid sm:grid-cols-2 gap-px bg-rule border border-rule" style={stagger(5)}>
        {FEATURES.map(([title, body]) => (
          <li key={title} className="bg-paper p-5">
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
            <li>Upload the .txt or .zip you get, no need to unzip it.</li>
          </ol>
        </div>
        <div>
          <h2 className="font-display text-lg mb-2">Exporting from Telegram</h2>
          <ol className="list-decimal list-inside text-muted space-y-1">
            <li>In Telegram Desktop, open the chat menu (⋮).</li>
            <li>Choose Export chat history and untick media.</li>
            <li>Pick Machine-readable JSON and upload result.json.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
