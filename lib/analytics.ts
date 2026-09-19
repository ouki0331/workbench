import { dayKey, type ActivityEvent, type Progress } from './progress';

function addDays(date: string, days: number) {
  const value = new Date(date + 'T12:00:00');
  value.setDate(value.getDate() + days);
  return dayKey(value);
}

function roundedMinutes(seconds: number) {
  return seconds ? Math.max(1, Math.round(seconds / 60)) : 0;
}

export type WeeklyReport = {
  from: string;
  to: string;
  studyMinutes: number;
  articles: number;
  words: number;
  reviews: number;
  listeningMinutes: number;
  recordingMinutes: number;
  knownWords: number;
  sessionCount: number;
  days: { key: string; minutes: number }[];
  wordHistory: ActivityEvent[];
};

export interface AnalyticsProvider {
  id: string;
  weekly(progress: Progress, endDate: string): WeeklyReport;
}

export const localAnalyticsProvider: AnalyticsProvider = {
  id: 'local-events-v1',
  weekly(progress, endDate) {
    const from = addDays(endDate, -6),
      sessions = progress.sessions.filter(
        (session) => session.date >= from && session.date <= endDate,
      ),
      activities = progress.activities.filter(
        (event) => event.date >= from && event.date <= endDate,
      ),
      known = new Map<string, boolean>();
    for (const event of [...progress.activities].sort((a, b) =>
      a.at.localeCompare(b.at),
    )) {
      if (event.kind === 'word-known' || event.kind === 'word-unknown')
        known.set(event.resourceId.toLowerCase(), event.kind === 'word-known');
    }
    return {
      from,
      to: endDate,
      studyMinutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
      articles: new Set(
        activities
          .filter((event) => event.kind === 'article-opened')
          .map((event) => event.resourceId),
      ).size,
      words: new Set(
        activities
          .filter((event) => event.kind === 'word-saved')
          .map((event) => event.resourceId.toLowerCase()),
      ).size,
      reviews: progress.reviews.events.filter(
        (event) => event.date >= from && event.date <= endDate,
      ).length,
      listeningMinutes: roundedMinutes(
        activities
          .filter((event) => event.kind === 'listening')
          .reduce((sum, event) => sum + event.seconds, 0),
      ),
      recordingMinutes: roundedMinutes(
        activities
          .filter((event) => event.kind === 'recording')
          .reduce((sum, event) => sum + event.seconds, 0),
      ),
      knownWords: [...known.values()].filter(Boolean).length,
      sessionCount: sessions.length,
      days: Array.from({ length: 7 }, (_, index) => {
        const key = addDays(from, index);
        return {
          key,
          minutes: sessions
            .filter((session) => session.date === key)
            .reduce((sum, session) => sum + session.minutes, 0),
        };
      }),
      wordHistory: activities
        .filter((event) => event.kind.startsWith('word-'))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 12),
    };
  },
};
