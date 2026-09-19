export type ResourceRef = {
  kind: 'local-asset' | 'builtin' | 'external' | 'vocabulary' | 'legacy';
  id: string;
};
export type Skill = 'listening' | 'reading' | 'writing' | 'speaking';
export type Session = {
  id: string;
  date: string;
  skill: Skill;
  minutes: number;
  score: number | null;
  note: string;
};
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type ReviewCard = {
  id: string;
  sourceId: string;
  resourceRef?: ResourceRef;
  sourceKind: 'vocabulary' | 'practice';
  front: string;
  back: string;
  context: string;
  createdDate: string;
  dueDate: string;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  lastReviewedDate: string | null;
};
export type ReviewEvent = {
  id: string;
  cardId: string;
  date: string;
  rating: ReviewRating;
  intervalDays: number;
};
export type ReviewState = { cards: ReviewCard[]; events: ReviewEvent[] };
export type Assessment = {
  id: string;
  date: string;
  correct: number;
  total: 8;
  estimatedBand: number;
  answers: number[];
};
export type ActivityKind =
  | 'article-opened'
  | 'word-saved'
  | 'word-viewed'
  | 'word-known'
  | 'word-unknown'
  | 'listening'
  | 'recording';
export type ActivityEvent = {
  id: string;
  date: string;
  at: string;
  moduleId: string;
  subjectId: string;
  kind: ActivityKind;
  resourceId: string;
  resourceRef?: ResourceRef;
  label: string;
  seconds: number;
};
export type ActivityInput = Omit<
  ActivityEvent,
  'id' | 'date' | 'at' | 'moduleId' | 'subjectId'
> & {
  moduleId?: string;
  subjectId?: string;
};
export type Progress = {
  version: 1;
  profile: { target: number; examDate: string };
  sessions: Session[];
  reviews: ReviewState;
  assessments: Assessment[];
  activities: ActivityEvent[];
};
export const emptyProgress: Progress = {
  version: 1,
  profile: { target: 7, examDate: '' },
  sessions: [],
  reviews: { cards: [], events: [] },
  assessments: [],
  activities: [],
};
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function validDate(v: unknown) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T12:00:00');
  return !isNaN(d.getTime()) && dayKey(d) === v;
}
function band(v: unknown) {
  return (
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 9 &&
    (v * 2) % 1 === 0
  );
}
export function validResourceRef(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const ref = value as ResourceRef;
  return (
    ['local-asset', 'builtin', 'external', 'vocabulary', 'legacy'].includes(
      ref.kind,
    ) &&
    typeof ref.id === 'string' &&
    (ref.kind === 'legacy' || ref.id.length > 0) &&
    ref.id.length <= 2000
  );
}
export function parseProgress(raw: string): Progress {
  const d = JSON.parse(raw);
  const reviews = d?.reviews ?? { cards: [], events: [] };
  const assessments = d?.assessments ?? [];
  const activities = d?.activities ?? [];
  if (
    !d ||
    d.version !== 1 ||
    !d.profile ||
    !band(d.profile.target) ||
    (d.profile.examDate !== '' && !validDate(d.profile.examDate)) ||
    !Array.isArray(d.sessions) ||
    d.sessions.length > 20000 ||
    !reviews ||
    !Array.isArray(reviews.cards) ||
    !Array.isArray(reviews.events) ||
    reviews.cards.length > 10000 ||
    reviews.events.length > 50000 ||
    !Array.isArray(assessments) ||
    assessments.length > 1000 ||
    !Array.isArray(activities) ||
    activities.length > 50000
  )
    throw Error('备份格式或版本不受支持');
  const ids = new Set<string>();
  for (const s of d.sessions) {
    if (
      !s ||
      typeof s.id !== 'string' ||
      !s.id ||
      s.id.length > 100 ||
      ids.has(s.id) ||
      !validDate(s.date) ||
      !['listening', 'reading', 'writing', 'speaking'].includes(s.skill) ||
      typeof s.minutes !== 'number' ||
      !Number.isFinite(s.minutes) ||
      s.minutes < 1 ||
      s.minutes > 1440 ||
      (s.score !== null && !band(s.score)) ||
      typeof s.note !== 'string' ||
      s.note.length > 5000
    )
      throw Error('备份包含无效或重复的学习记录');
    ids.add(s.id);
  }
  const cardIds = new Set<string>();
  for (const c of reviews.cards) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      !c.id ||
      c.id.length > 200 ||
      cardIds.has(c.id) ||
      !validResourceRef(c.resourceRef) ||
      typeof c.sourceId !== 'string' ||
      c.sourceId.length > 200 ||
      !['vocabulary', 'practice'].includes(c.sourceKind) ||
      typeof c.front !== 'string' ||
      !c.front.trim() ||
      c.front.length > 2000 ||
      typeof c.back !== 'string' ||
      !c.back.trim() ||
      c.back.length > 20000 ||
      typeof c.context !== 'string' ||
      c.context.length > 5000 ||
      !validDate(c.createdDate) ||
      !validDate(c.dueDate) ||
      !Number.isInteger(c.intervalDays) ||
      c.intervalDays < 0 ||
      c.intervalDays > 36500 ||
      typeof c.ease !== 'number' ||
      !Number.isFinite(c.ease) ||
      c.ease < 1.3 ||
      c.ease > 3 ||
      !Number.isInteger(c.repetitions) ||
      c.repetitions < 0 ||
      c.repetitions > 100000 ||
      !Number.isInteger(c.lapses) ||
      c.lapses < 0 ||
      c.lapses > 100000 ||
      (c.lastReviewedDate !== null && !validDate(c.lastReviewedDate))
    )
      throw Error('备份包含无效或重复的复习卡');
    cardIds.add(c.id);
  }
  const eventIds = new Set<string>();
  for (const e of reviews.events) {
    if (
      !e ||
      typeof e.id !== 'string' ||
      !e.id ||
      e.id.length > 200 ||
      eventIds.has(e.id) ||
      typeof e.cardId !== 'string' ||
      e.cardId.length > 200 ||
      !validDate(e.date) ||
      !['again', 'hard', 'good', 'easy'].includes(e.rating) ||
      !Number.isInteger(e.intervalDays) ||
      e.intervalDays < 0 ||
      e.intervalDays > 36500
    )
      throw Error('备份包含无效或重复的复习记录');
    eventIds.add(e.id);
  }
  const assessmentIds = new Set<string>();
  for (const a of assessments) {
    if (
      !a ||
      typeof a.id !== 'string' ||
      !a.id ||
      a.id.length > 100 ||
      assessmentIds.has(a.id) ||
      !validDate(a.date) ||
      !Number.isInteger(a.correct) ||
      a.correct < 0 ||
      a.correct > 8 ||
      a.total !== 8 ||
      !band(a.estimatedBand) ||
      a.estimatedBand < 3 ||
      a.estimatedBand > 8 ||
      !Array.isArray(a.answers) ||
      a.answers.length !== 8 ||
      a.answers.some(
        (answer: unknown) =>
          typeof answer !== 'number' ||
          !Number.isInteger(answer) ||
          answer < -1 ||
          answer > 3,
      )
    )
      throw Error('备份包含无效或重复的摸底测试');
    assessmentIds.add(a.id);
  }
  const activityIds = new Set<string>();
  for (const event of activities) {
    if (
      !event ||
      typeof event.id !== 'string' ||
      !event.id ||
      event.id.length > 100 ||
      activityIds.has(event.id) ||
      !validDate(event.date) ||
      typeof event.at !== 'string' ||
      !Number.isFinite(Date.parse(event.at)) ||
      (event.moduleId !== undefined &&
        (typeof event.moduleId !== 'string' || event.moduleId.length > 100)) ||
      (event.subjectId !== undefined &&
        (typeof event.subjectId !== 'string' ||
          event.subjectId.length > 100)) ||
      ![
        'article-opened',
        'word-saved',
        'word-viewed',
        'word-known',
        'word-unknown',
        'listening',
        'recording',
      ].includes(event.kind) ||
      !validResourceRef(event.resourceRef) ||
      typeof event.resourceId !== 'string' ||
      event.resourceId.length > 500 ||
      typeof event.label !== 'string' ||
      event.label.length > 500 ||
      !Number.isInteger(event.seconds) ||
      event.seconds < 0 ||
      event.seconds > 86400
    )
      throw Error('备份包含无效或重复的学习活动');
    activityIds.add(event.id);
  }
  return {
    version: 1,
    profile: { target: d.profile.target, examDate: d.profile.examDate },
    sessions: d.sessions.map((s: Session) => ({
      id: s.id,
      date: s.date,
      skill: s.skill,
      minutes: s.minutes,
      score: s.score,
      note: s.note,
    })),
    reviews: {
      cards: reviews.cards.map((c: ReviewCard) => ({
        ...c,
        resourceRef: c.resourceRef ?? { kind: 'legacy', id: c.sourceId },
      })),
      events: reviews.events.map((e: ReviewEvent) => ({ ...e })),
    },
    assessments: assessments.map((a: Assessment) => ({
      ...a,
      answers: [...a.answers],
    })),
    activities: activities.map((event: ActivityEvent) => ({
      ...event,
      resourceRef: event.resourceRef ?? {
        kind:
          event.kind.startsWith('word-') && event.resourceId
            ? 'vocabulary'
            : 'legacy',
        id: event.resourceId,
      },
      moduleId: event.moduleId || 'ielts',
      subjectId: event.subjectId || 'general',
    })),
  };
}
