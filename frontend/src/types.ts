export interface Award {
  title: string;
  emoji: string;
  recipient: string;
  description: string;
  color: string;
}

export interface WrappedData {
  first_date: string;
  first_sender: string;
  first_msg: string;
  total_words: number;
  book_pages: number;
  max_streak: number;
  streak_start: string;
  streak_end: string;
  top_starter: string;
  busiest_date?: string;
  busiest_count?: number;
  peak_hour?: string;
  awards?: Award[];
}

export interface OverviewData {
  total_messages: number;
  total_words: number;
  total_chars: number;
  days_talked: number;
  participants_count: number;
  date_start: string;
  date_end: string;
}

export interface ParticipantStat {
  name: string;
  messages: number;
  percentage: number;
  words: number;
  chars: number;
  emojis: number;
  avg_words: number;
}

export interface DailyPoint {
  date: string;
  count: number;
}

export interface DayOfWeekPoint {
  day: string;
  count: number;
}

export interface HourlyPoint {
  hour: string;
  count: number;
}

export interface TimelineData {
  daily: DailyPoint[];
  day_of_week: DayOfWeekPoint[];
  hourly: HourlyPoint[];
}

export interface WordItem {
  word: string;
  count: number;
}

export interface WordsData {
  overall: WordItem[];
  by_sender: Record<string, WordItem[]>;
}

export interface EmojiItem {
  emoji: string;
  count: number;
}

export interface EmojisData {
  overall: EmojiItem[];
  by_sender: Record<string, EmojiItem[]>;
}

export interface ChatAnalytics {
  platform: string;
  wrapped: WrappedData;
  overview: OverviewData;
  participants: ParticipantStat[];
  insights: Insights;
  word_index: WordIndex;
  range: DateRange;
  timeline: TimelineData;
  words: WordsData;
  emojis: EmojisData;
}

export interface SearchResult {
  term: string;
  total: number;
  by_sender: { sender: string; count: number }[];
  timeline: { date: string; count: number }[];
}

export interface Insights {
  conversations: {
    total: number;
    avg_minutes: number;
    longest: { date: string; minutes: number; messages: number }[];
    longest_silence: { days: number; ended: string };
  };
  double_texting: { name: string; run: number; date: string }[];
  responsiveness: {
    median_minutes: number;
    avg_minutes: number;
    per_sender: { name: string; median_minutes: number; avg_minutes: number; replies: number }[];
  };
  rally_gap_minutes: number;
  rallies: {
    longest: Rally[];
    ping_pong: Rally | null;
  };
  texting_hours: { name: string; hourly: number[]; peak_hour: number; peak_period: string }[];
  style: {
    name: string;
    messages: number;
    questions: number;
    exclamations: number;
    night: number;
  }[];
  time_of_day: {
    buckets: { label: string; count: number; percentage: number }[];
    monthly: { month: string; count: number }[];
    span_days: number;
    active_days: number;
    active_percentage: number;
    messages_per_active_day: number;
  };
  media: {
    media_total: number;
    media_share: number;
    links_total: number;
    per_sender: { name: string; media: number; links: number }[];
    platforms: { name: string; count: number }[];
    top_domains: { name: string; count: number }[];
  };
  busiest_days: { date: string; count: number; top_sender: string | null }[];
  share_over_time: {
    granularity: 'month' | 'week';
    people: string[];
    periods: { label: string; counts: Record<string, number> }[];
  };
  milestones: {
    messages: { number: number; date: string; sender: string }[];
    busiest_month: { label: string; count: number };
    busiest_year: { label: string; count: number } | null;
  };
  deleted_messages: number | null;
}

export interface DateRange {
  full_start: string;
  full_end: string;
  years: { year: number; count: number }[];
  start: string | null;
  end: string | null;
}

/** word -> [total, [[senderIdx, count]], [[periodIdx, count]]] */
export interface WordIndex {
  granularity: 'day' | 'month';
  senders: string[];
  periods: string[];
  words: Record<string, [number, [number, number][], [number, number][]]>;
}

export interface Rally {
  messages: number;
  date: string;
  time: string;
  minutes: number;
  people: string[];
}
