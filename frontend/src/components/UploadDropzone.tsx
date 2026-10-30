import React, { useState, useRef } from 'react';
import { Progress } from '../lib/api';

interface UploadDropzoneProps {
  onFileUpload: (file: File) => void;
  onLoadSample: () => void;
  isLoading: boolean;
  progress: Progress | null;
  error: string | null;
}

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

  return (
    <div className="max-w-2xl pt-14 sm:pt-20">
      <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight mb-6">
        Your chat, counted.
      </h1>
      <p className="text-lg text-muted leading-relaxed mb-10 max-w-xl">
        Drop in a WhatsApp or Telegram export and get message counts, streaks, busiest hours and
        the words each of you leans on. The file is read in memory and never saved.
      </p>

      {error && (
        <p role="alert" className="mb-6 border-l-2 border-accent pl-3 text-sm text-accent">
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
        className={`border border-dashed px-6 py-12 transition-colors ${
          isLoading ? 'cursor-progress' : 'cursor-pointer'
        } ${isDragging ? 'border-accent bg-accent/5' : 'border-ink hover:bg-ink/[0.03]'}`}
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
          <div aria-live="polite">
            <p className="font-display text-2xl mb-1">
              {progress.phase === 'uploading' ? `Reading ${progress.pct}%` : 'Counting messages…'}
            </p>
            <p className="text-sm text-muted truncate mb-4">{progress.name}</p>
            <div className="h-1 bg-rule/60 overflow-hidden">
              <div
                className={`h-full bg-accent ${progress.phase === 'analysing' ? 'animate-pulse' : ''}`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="font-display text-2xl mb-1">
              {isLoading ? 'Loading…' : 'Drop a file here, or click to choose'}
            </p>
            <p className="text-sm text-muted">
              WhatsApp .txt, Telegram result.json, or a .zip of either, up to 50 MB
            </p>
          </>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">
        No export handy?{' '}
        <button
          onClick={onLoadSample}
          disabled={isLoading}
          className="text-ink underline underline-offset-4 decoration-accent hover:text-accent disabled:opacity-50"
        >
          Look at a sample chat
        </button>
        .
      </p>

      <div className="mt-16 grid sm:grid-cols-2 gap-x-10 gap-y-8 border-t border-rule pt-8 text-sm leading-relaxed">
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
