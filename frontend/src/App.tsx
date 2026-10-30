import React, { useState } from 'react';
import { ChatAnalytics } from './types';
import { Progress, RangeParams, analyzeFile, checkFile, fetchSample } from './lib/api';
import { NamesProvider } from './lib/names';
import { Header } from './components/Header';
import { UploadDropzone } from './components/UploadDropzone';
import { ChatWrapped } from './components/ChatWrapped';
import { MetricsOverview } from './components/MetricsOverview';
import { RangeFilter } from './components/RangeFilter';
import { RenamePanel } from './components/RenamePanel';
import { ExportBar } from './components/ExportBar';
import { OverviewTab } from './components/Tabs/OverviewTab';
import { ActivityTab } from './components/Tabs/ActivityTab';
import { ConversationsTab } from './components/Tabs/ConversationsTab';
import { StyleTab } from './components/Tabs/StyleTab';
import { WordsTab } from './components/Tabs/WordsTab';
import { WordSearcherTab } from './components/Tabs/WordSearcherTab';
import { EmojiTab } from './components/Tabs/EmojiTab';
import { MediaTab } from './components/Tabs/MediaTab';

type Source = { kind: 'file'; file: File } | { kind: 'sample' };

const SECTIONS = [
  { id: 'people', label: 'People' },
  { id: 'activity', label: 'Activity' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'style', label: 'Style' },
  { id: 'words', label: 'Words' },
  { id: 'search', label: 'Word search' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'media', label: 'Links & media' },
  { id: 'export', label: 'Export' },
];

const GroupHeading: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2 id={id} className="font-display text-4xl tracking-tight mt-16 mb-8 scroll-mt-24">
    {children}
  </h2>
);

const NO_RANGE: RangeParams = { start: null, end: null };

export const App: React.FC = () => {
  const [data, setData] = useState<ChatAnalytics | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const run = async (src: Source, range: RangeParams) => {
    setIsLoading(true);
    setError(null);
    setProgress(null);
    try {
      const result =
        src.kind === 'file' ? await analyzeFile(src.file, range, setProgress) : await fetchSample(range);
      setData(result);
      setSource(src);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleFileUpload = (file: File) => {
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setSearchQuery('');
    run({ kind: 'file', file }, NO_RANGE);
  };

  const handleLoadSample = () => {
    setSearchQuery('');
    run({ kind: 'sample' }, NO_RANGE);
  };

  const handleApplyRange = (range: RangeParams) => {
    if (source) run(source, range);
  };

  const handleReset = () => {
    setData(null);
    setSource(null);
    setError(null);
    setSearchQuery('');
  };

  const handleSelectWord = (word: string) => {
    setSearchQuery(word);
    document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' });
  };

  const people = data?.participants.map((p) => p.name) ?? [];

  return (
    <NamesProvider people={people}>
      <div className="min-h-screen flex flex-col">
        <Header
          onLoadSample={handleLoadSample}
          onReset={handleReset}
          hasData={!!data}
          isLoading={isLoading}
        />

        <main className="flex-1 max-w-5xl w-full mx-auto px-5 sm:px-8 py-10">
          {!data ? (
            <UploadDropzone
              onFileUpload={handleFileUpload}
              onLoadSample={handleLoadSample}
              isLoading={isLoading}
              progress={progress}
              error={error}
            />
          ) : (
            <>
              <div className="mb-8">
                <p className="text-sm text-muted mb-2">{data.platform}</p>
                <h1 className="font-display text-4xl sm:text-5xl tracking-tight">
                  {data.overview.date_start} <span className="text-muted">to</span> {data.overview.date_end}
                </h1>
              </div>

              {error && (
                <p role="alert" className="mb-6 border-l-2 border-accent pl-3 text-sm text-accent">
                  {error}
                </p>
              )}
              <RangeFilter range={data.range} disabled={isLoading} onApply={handleApplyRange} />
              <RenamePanel people={people} />

              <MetricsOverview overview={data.overview} />
              <ChatWrapped wrapped={data.wrapped} />

              <nav
                aria-label="Sections"
                className="sticky top-0 z-10 -mx-5 sm:-mx-8 px-5 sm:px-8 bg-paper border-b border-rule"
              >
                <div className="flex gap-6 overflow-x-auto">
                  {SECTIONS.map((sec) => (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      className="py-3 whitespace-nowrap text-sm text-muted hover:text-ink"
                    >
                      {sec.label}
                    </a>
                  ))}
                </div>
              </nav>

              <GroupHeading id="people">People</GroupHeading>
              <OverviewTab participants={data.participants} share={data.insights.share_over_time} />

              <GroupHeading id="activity">Activity</GroupHeading>
              <ActivityTab timeline={data.timeline} insights={data.insights} />

              <GroupHeading id="conversations">Conversations</GroupHeading>
              <ConversationsTab insights={data.insights} platform={data.platform} />

              <GroupHeading id="style">Style</GroupHeading>
              <StyleTab style={data.insights.style} />

              <GroupHeading id="words">Words</GroupHeading>
              <WordsTab words={data.words} participants={data.participants} onSelectWord={handleSelectWord} />

              <GroupHeading id="search">Word search</GroupHeading>
              <WordSearcherTab index={data.word_index} initialQuery={searchQuery} />

              <GroupHeading id="emoji">Emoji</GroupHeading>
              <EmojiTab emojis={data.emojis} participants={data.participants} />

              <GroupHeading id="media">Links &amp; media</GroupHeading>
              <MediaTab media={data.insights.media} deleted={data.insights.deleted_messages} />

              <GroupHeading id="export">Export</GroupHeading>
              <ExportBar data={data} />
            </>
          )}
        </main>

        <footer className="border-t border-rule py-6 px-5 sm:px-8 text-sm text-muted">
          <div className="max-w-5xl mx-auto">Files are processed in memory and never written to disk.</div>
        </footer>
      </div>
    </NamesProvider>
  );
};

export default App;
