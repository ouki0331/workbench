'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  CalendarDays,
  Check,
  Eye,
  Flame,
  Library,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dayKey,
  type Progress,
  type ResourceRef,
  type ReviewCard,
  type ReviewRating,
} from '@/lib/progress';
import { dueLabel, scheduleReview } from '@/lib/review';

type Item = {
  id: string;
  resourceRef?: ResourceRef;
  kind: string;
  title: string;
  filename: string;
  summary?: string;
};
type Detail = { item: Item; content: string | null };
type PracticeArchive = {
  material?: {
    title?: string;
    questions?: Array<{
      prompt?: string;
      answers?: string[];
      explanation?: string;
    }>;
  };
};

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { 'X-IELTS-Local': '1' },
    signal,
  });
  const value = await response.json().catch(() => null);
  if (!response.ok || !value)
    throw Error('本地资料服务未启动，请先启动工作台。');
  return value as T;
}

function parseVocabulary(content: string | null) {
  if (!content) return null;
  try {
    const value = JSON.parse(content) as { meaning?: string; example?: string };
    return {
      meaning: value.meaning?.trim() || '待补充释义',
      example: value.example?.trim() || '',
    };
  } catch {
    return null;
  }
}

function createCard(
  id: string,
  sourceId: string,
  sourceKind: ReviewCard['sourceKind'],
  front: string,
  back: string,
  context: string,
  today: string,
  resourceRef: ResourceRef,
): ReviewCard {
  return {
    id,
    sourceId,
    resourceRef,
    sourceKind,
    front: front.slice(0, 2000),
    back: back.slice(0, 20000),
    context: context.slice(0, 5000),
    createdDate: today,
    dueDate: today,
    intervalDays: 0,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
    lastReviewedDate: null,
  };
}

export default function ReviewWorkspace({
  progress,
  onUpdate,
}: {
  progress: Progress;
  onUpdate: (transform: (current: Progress) => Progress) => boolean;
}) {
  const today = dayKey();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [queue, setQueue] = useState<ReviewCard[] | null>(null),
    [revealed, setRevealed] = useState(false),
    [answered, setAnswered] = useState(0);
  const initialSync = useRef(false);
  const alive = useRef(true);
  const syncAbort = useRef<AbortController | null>(null);

  const due = useMemo(
    () =>
      progress.reviews.cards
        .filter((card) => card.dueDate <= today)
        .sort(
          (a, b) =>
            a.dueDate.localeCompare(b.dueDate) || a.repetitions - b.repetitions,
        ),
    [progress.reviews.cards, today],
  );
  const newCount = due.filter((card) => card.repetitions === 0).length;
  const mastered = progress.reviews.cards.filter(
    (card) => card.intervalDays >= 21,
  ).length;
  const recentEvents = progress.reviews.events.filter((event) => {
    const start = new Date(today + 'T12:00:00');
    start.setDate(start.getDate() - 13);
    return event.date >= dayKey(start);
  });
  const recall = recentEvents.length
    ? Math.round(
        (recentEvents.filter((event) => event.rating !== 'again').length /
          recentEvents.length) *
          100,
      )
    : 0;
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today + 'T12:00:00');
    date.setDate(date.getDate() - 13 + index);
    const key = dayKey(date);
    return {
      key,
      label: date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
      }),
      count: recentEvents.filter((event) => event.date === key).length,
    };
  });
  const activeDays = new Set(
    progress.reviews.events.map((event) => event.date),
  );
  let streak = 0;
  const cursor = new Date(today + 'T12:00:00');
  if (!activeDays.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const syncLibrary = useCallback(
    async (showResult = true) => {
      setBusy(true);
      const controller = new AbortController();
      syncAbort.current?.abort();
      syncAbort.current = controller;
      try {
        const listing = await request<{ items: Item[] }>(
          '/api/library/items',
          controller.signal,
        );
        const sources = listing.items.filter(
          (item) =>
            item.kind === 'vocabulary' || item.filename === 'practice.json',
        );
        const details = await Promise.all(
          sources.map((item) =>
            request<Detail>(
              `/api/library/items/${item.kind}/${item.id}`,
              controller.signal,
            ),
          ),
        );
        const incoming: ReviewCard[] = [];
        for (const detail of details) {
          if (detail.item.kind === 'vocabulary') {
            const word = parseVocabulary(detail.content);
            if (word)
              incoming.push(
                createCard(
                  `vocabulary:${detail.item.id}`,
                  detail.item.id,
                  'vocabulary',
                  detail.item.title,
                  word.meaning,
                  word.example,
                  today,
                  detail.item.resourceRef ?? {
                    kind: 'legacy',
                    id: detail.item.id,
                  },
                ),
              );
            continue;
          }
          try {
            const archive = JSON.parse(detail.content || '') as PracticeArchive;
            archive.material?.questions?.forEach((question, index) => {
              const front = question.prompt?.trim();
              const answers = question.answers?.filter(Boolean);
              if (front && answers?.length)
                incoming.push(
                  createCard(
                    `practice:${detail.item.id}:${index}`,
                    detail.item.id,
                    'practice',
                    front,
                    answers.join(' / '),
                    question.explanation?.trim() ||
                      archive.material?.title ||
                      '',
                    today,
                    detail.item.resourceRef ?? {
                      kind: 'legacy',
                      id: detail.item.id,
                    },
                  ),
                );
            });
          } catch {
            // A malformed archive remains untouched in the library and is skipped.
          }
        }
        let added = 0;
        if (!alive.current) return;
        const saved = onUpdate((current) => {
          const old = new Map(
            current.reviews.cards.map((card) => [card.id, card]),
          );
          const merged = incoming.map((card) => {
            const existing = old.get(card.id);
            if (!existing) {
              added += 1;
              return card;
            }
            old.delete(card.id);
            return {
              ...existing,
              resourceRef: card.resourceRef,
              front: card.front,
              back: card.back,
              context: card.context,
            };
          });
          merged.push(...old.values());
          if (JSON.stringify(merged) === JSON.stringify(current.reviews.cards))
            return current;
          return {
            ...current,
            reviews: { ...current.reviews, cards: merged },
          };
        });
        if (!saved)
          throw Error('复习卡未能写入浏览器进度，请先导出备份后重试。');
        if (showResult)
          setMessage(
            added
              ? `已加入 ${added} 张新复习卡。`
              : '资料库已同步，没有发现新卡片。',
          );
      } catch (error) {
        if (
          alive.current &&
          !(error instanceof DOMException && error.name === 'AbortError')
        )
          setMessage(
            error instanceof Error ? error.message : '同步失败，请重试。',
          );
      } finally {
        if (syncAbort.current === controller) syncAbort.current = null;
        if (alive.current) setBusy(false);
      }
    },
    [onUpdate, today],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      syncAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (initialSync.current) return;
    initialSync.current = true;
    queueMicrotask(() => void syncLibrary(false));
  }, [syncLibrary]);

  function startReview() {
    setQueue(due);
    setRevealed(false);
    setAnswered(0);
    setMessage(
      due.length ? '' : '今天没有到期卡片，可以先去收藏单词或完成练习。',
    );
  }

  function rate(rating: ReviewRating) {
    const card = queue?.[0];
    if (!card) return;
    const updated = scheduleReview(card, rating, today);
    const event = {
      id: crypto.randomUUID(),
      cardId: card.id,
      date: today,
      rating,
      intervalDays: updated.intervalDays,
    } as const;
    if (
      !onUpdate((currentProgress) => ({
        ...currentProgress,
        reviews: {
          cards: currentProgress.reviews.cards.map((item) =>
            item.id === card.id ? updated : item,
          ),
          events: [event, ...currentProgress.reviews.events].slice(0, 50000),
        },
      }))
    )
      return;
    const rest = queue.slice(1);
    if (rating === 'again') rest.push(updated);
    setQueue(rest);
    setRevealed(false);
    setAnswered((value) => value + 1);
  }

  const current = queue?.[0];
  if (queue) {
    return (
      <section className="review-session" aria-label="复习卡片">
        <div className="review-session-head">
          <button onClick={() => setQueue(null)}>退出复习</button>
          <span>
            本轮已完成 {answered} 次 · 队列剩余 {queue.length}
          </span>
        </div>
        {current ? (
          <article className="review-card">
            <p className="review-source">
              {current.sourceKind === 'vocabulary' ? '单词卡' : '错题卡'}
            </p>
            <h2 data-user-content>{current.front}</h2>
            {!revealed ? (
              <Button
                className="review-reveal"
                onClick={() => setRevealed(true)}
              >
                <Eye size={18} />
                显示答案
              </Button>
            ) : (
              <>
                <div className="review-answer">
                  <strong data-user-content>{current.back}</strong>
                  {current.context && (
                    <p data-user-content>{current.context}</p>
                  )}
                </div>
                <div className="review-ratings" aria-label="记忆程度">
                  {(
                    [
                      ['again', '忘记'],
                      ['hard', '困难'],
                      ['good', '记得'],
                      ['easy', '熟练'],
                    ] as const
                  ).map(([rating, label]) => (
                    <button
                      key={rating}
                      className={rating}
                      onClick={() => rate(rating)}
                    >
                      <b>{label}</b>
                      <span>{dueLabel(current, rating)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </article>
        ) : (
          <div className="review-finished">
            <Check size={34} />
            <h2>今天的复习完成了</h2>
            <p>本轮完成 {answered} 次回忆，新的复习日期已经保存。</p>
            <Button onClick={() => setQueue(null)}>查看复习统计</Button>
          </div>
        )}
      </section>
    );
  }

  const maxTrend = Math.max(1, ...trend.map((day) => day.count));
  return (
    <div className="review-workspace">
      <section className="review-overview">
        <div className="review-today">
          <Brain size={28} />
          <div>
            <span>今天待复习</span>
            <strong>{due.length}</strong>
            <p>
              {newCount} 张新卡 · {Math.max(0, due.length - newCount)} 张到期
            </p>
          </div>
          <Button onClick={startReview} disabled={busy || !due.length}>
            {due.length ? '开始复习' : '今日已完成'}
          </Button>
        </div>
        <dl className="review-metrics">
          <div>
            <CalendarDays size={19} />
            <dt>全部卡片</dt>
            <dd>{progress.reviews.cards.length}</dd>
          </div>
          <div>
            <Check size={19} />
            <dt>已掌握</dt>
            <dd>{mastered}</dd>
          </div>
          <div>
            <Flame size={19} />
            <dt>连续复习</dt>
            <dd>
              {streak}
              <small> 天</small>
            </dd>
          </div>
          <div>
            <RefreshCw size={19} />
            <dt>近 14 天记住率</dt>
            <dd>{recentEvents.length ? `${recall}%` : '—'}</dd>
          </div>
        </dl>
      </section>

      {message && (
        <output className="notice" aria-live="polite">
          {message}
        </output>
      )}

      <div className="review-lower">
        <section className="review-trend">
          <div className="section-title">
            <h2>14 天复习曲线</h2>
            <span>{recentEvents.length} 次回忆</span>
          </div>
          <div className="review-bars" aria-label="最近十四天复习次数">
            {trend.map((day, index) => (
              <div
                className="review-bar-day"
                key={day.key}
                title={`${day.label}：${day.count} 次`}
              >
                <span>{day.count || ''}</span>
                <div>
                  <i style={{ height: `${(day.count / maxTrend) * 100}%` }} />
                </div>
                <small>
                  {index % 3 === 1 || index === 13 ? day.label : ''}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="review-deck">
          <Library size={25} />
          <h2>复习材料自动整理</h2>
          <p>
            资料库里的单词，以及已保存练习中的客观题，会自动成为复习卡。原文件不会被修改。
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void syncLibrary()}
          >
            <RefreshCw size={17} className={busy ? 'spin' : ''} />
            {busy ? '正在同步…' : '同步资料库'}
          </Button>
        </section>
      </div>
      {!progress.reviews.cards.length && !busy && (
        <section className="review-empty">
          <Brain size={30} />
          <h2>先收集第一张复习卡</h2>
          <p>
            在练习文章里选中单词并收藏，或者保存一次带客观题的练习，然后回来同步。
          </p>
        </section>
      )}
    </div>
  );
}
