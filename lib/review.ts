import { dayKey, type ReviewCard, type ReviewRating } from './progress';

function addDays(date: string, days: number) {
  const value = new Date(date + 'T12:00:00');
  value.setDate(value.getDate() + days);
  return dayKey(value);
}

export function scheduleReview(
  card: ReviewCard,
  rating: ReviewRating,
  date: string,
): ReviewCard {
  let interval = card.intervalDays;
  let ease = card.ease;
  const repetitions = card.repetitions + 1;
  let lapses = card.lapses;

  if (rating === 'again') {
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
    lapses += 1;
  } else if (rating === 'hard') {
    interval =
      card.repetitions === 0
        ? 1
        : Math.max(1, Math.round(Math.max(1, interval) * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === 'good') {
    interval =
      card.repetitions === 0
        ? 1
        : card.repetitions === 1
          ? 3
          : Math.max(4, Math.round(interval * ease));
  } else {
    interval =
      card.repetitions === 0
        ? 4
        : Math.max(6, Math.round(Math.max(1, interval) * (ease + 0.15)));
    ease = Math.min(3, ease + 0.15);
  }

  return {
    ...card,
    dueDate: addDays(date, interval),
    intervalDays: interval,
    ease: Number(ease.toFixed(2)),
    repetitions,
    lapses,
    lastReviewedDate: date,
  };
}

export function dueLabel(card: ReviewCard, rating: ReviewRating) {
  const next = scheduleReview(card, rating, '2026-01-01').intervalDays;
  if (next === 0) return '今天再看';
  if (next === 1) return '1 天';
  if (next < 30) return `${next} 天`;
  if (next < 365) return `${Math.round(next / 30)} 个月`;
  return `${(next / 365).toFixed(1)} 年`;
}
