import React, { useState } from 'react';
import { ChatAnalytics } from './types';
import { Progress, RangeParams, analyzeFile, checkFile, fetchSample } from './lib/api';
import { NamesProvider, useNames } from './lib/names';
import { Reveal, useActiveSection } from './lib/motion';
import { formatDate, formatSpan } from './lib/format';
import { Header } from './components/Header';
import { UploadDropzone } from './components/UploadDropzone';
import { ChatWrapped } from './components/ChatWrapped';
import { MetricsOverview } from './components/MetricsOverview';
import { RangeFilter } from './components/RangeFilter';
import { RenamePanel } from './components/RenamePanel';
import { ExportBar } from './components/ExportBar';
import { ShareCard } from './components/ShareCard';
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
  { id: 'share', label: 'Share' },
  { id: 'export', label: 'Export' },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

const GroupHeading: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const n = SECTION_IDS.indexOf(id) + 1;
  return (
    <Reveal as="div" className="mt-20 mb-8 flex items-baseline gap-4 scroll-mt-28" id={id}>
      <span aria-hidden="true" className="font-display text-sm text-accent tabular-nums">
        {String(n).padStart(2, '0')}
      </span>
      <h2 className="font-display text-4xl sm:text-5xl tracking-tight">{children}</h2>
      <span aria-hidden="true" className="flex-1 border-t border-rule translate-y-[-0.35em]" />
    </Reveal>
  );
};

const NO_RANGE: RangeParams = { start: null, end: null };

/** The headline over the dashboard: who, and when. */
const Title: React.FC<{ data: ChatAnalytics }> = ({ data }) => {
  const { label } = useNames();
  const names = data.participants.map((p) => label(p.name));
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
      ? `${names[0]} & ${names[1]}`
      : names.length <= 4
      ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
      : `${names.slice(0, 3).join(', ')} & ${names.length - 3} more`;
  return (
    <div className="mb-8 rise-in">
      <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">
        {data.platform} · {formatSpan(data.overview.span_days)}
      </p>
      <h1 className="font-display text-4xl sm:text-6xl tracking-tight leading-[1.05]">{who}</h1>
      <p className="mt-3 text-lg text-muted">
        {formatDate(data.overview.date_start)} <span aria-hidden="true">→</span> {formatDate(data.overview.date_end)}
      </p>
    </div>
  );
};

const Nav: React.FC = () => {
  const active = useActiveSection(SECTION_IDS);
  return (
    <nav
      aria-label="Sections"
      className="sticky top-[49px] z-10 -mx-5 sm:-mx-8 px-5 sm:px-8 bg-paper/90 backdrop-blur border-b border-rule"
    >
      <div className="flex gap-6 overflow-x-auto">
        {SECTIONS.map((sec) => (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            aria-current={active === sec.id ? 'location' : undefined}
            className={`nav-link py-3 whitespace-nowrap text-sm ${
              active === sec.id ? 'is-active text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {sec.label}
          </a>
        ))}
      </div>
    </nav>
  );
};

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
        src.kind === 'file' ? await analyzeFile(src.file, range, setProgress) : await fetchSample(range, setProgress);
      setData(result);
      setSource(src);
      if (!data) window.scrollTo({ top: 0 });
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
    window.scrollTo({ top: 0 });
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
            <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-60' : ''}`}>
              <Title data={data} />

              {error && (
                <p role="alert" className="fade-in mb-6 border-l-2 border-accent pl-3 text-sm text-accent">
                  {error}
                </p>
              )}
              <RangeFilter range={data.range} disabled={isLoading} onApply={handleApplyRange} />
              <RenamePanel people={people} />

              <MetricsOverview overview={data.overview} />
              <ChatWrapped wrapped={data.wrapped} insights={data.insights} />

              <Nav />

              <GroupHeading id="people">People</GroupHeading>
              <OverviewTab
                participants={data.participants}
                share={data.insights.share_over_time}
                openers={data.insights.openers}
                balance={data.overview.balance}
              />

              <GroupHeading id="activity">Activity</GroupHeading>
              <ActivityTab timeline={data.timeline} insights={data.insights} />

              <GroupHeading id="conversations">Conversations</GroupHeading>
              <ConversationsTab insights={data.insights} platform={data.platform} />

              <GroupHeading id="style">Style</GroupHeading>
              <StyleTab style={data.insights.style} tone={data.insights.tone} vocabulary={data.insights.vocabulary} />

              <GroupHeading id="words">Words</GroupHeading>
              <WordsTab
                words={data.words}
                participants={data.participants}
                vocabulary={data.insights.vocabulary}
                common={data.insights.common_messages}
                onSelectWord={handleSelectWord}
              />

              <GroupHeading id="search">Word search</GroupHeading>
              <WordSearcherTab index={data.word_index} initialQuery={searchQuery} />

              <GroupHeading id="emoji">Emoji</GroupHeading>
              <EmojiTab emojis={data.emojis} participants={data.participants} />

              <GroupHeading id="media">Links &amp; media</GroupHeading>
              <MediaTab media={data.insights.media} deleted={data.insights.deleted_messages} />

              <GroupHeading id="share">Share</GroupHeading>
              <ShareCard data={data} />

              <GroupHeading id="export">Export</GroupHeading>
              <ExportBar data={data} />
            </div>
          )}
        </main>

        <footer className="border-t border-rule py-6 px-5 sm:px-8 text-sm text-muted">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-between gap-x-6 gap-y-2">
            <span>Files are processed in memory and never written to disk.</span>
            <span>
              <a
                href="https://github.com/MeetThakur/ConvoMetrics"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink transition-colors"
              >
                Open source on GitHub
              </a>
            </span>
          </div>
        </footer>
      </div>
    </NamesProvider>
  );
};

export default App;
