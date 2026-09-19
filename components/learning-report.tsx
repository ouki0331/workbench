'use client';
import {
  BarChart3,
  BookOpen,
  Clock3,
  Headphones,
  Mic,
  Languages,
} from 'lucide-react';
import { dayKey, type Progress } from '@/lib/progress';
import type { Locale } from '@/lib/i18n';
import { localAnalyticsProvider } from '@/lib/analytics';

export default function LearningReport({
  progress,
  locale,
}: {
  progress: Progress;
  locale: Locale;
}) {
  const report = localAnalyticsProvider.weekly(progress, dayKey());
  const dateLocale = {
    ja: 'ja-JP',
    en: 'en-US',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
  }[locale];
  const days = report.days.map((day) => ({
    ...day,
    label: new Date(day.key + 'T12:00:00').toLocaleDateString(dateLocale, {
      weekday: 'short',
    }),
    value: day.minutes,
  }));
  const peak = Math.max(1, ...days.map((day) => day.value));
  const wordHistory = report.wordHistory;
  const chartLabel = {
    ja: '最近7日間の学習時間（分）',
    en: 'Study minutes over the last 7 days',
    'zh-CN': '最近 7 天学习分钟数',
    'zh-TW': '最近 7 天學習分鐘數',
  }[locale];
  const weekSummary = {
    ja: `今週は${report.sessionCount}回練習 · ${report.reviews}枚復習`,
    en: `${report.sessionCount} practice sessions · ${report.reviews} cards reviewed this week`,
    'zh-CN': `本周完成 ${report.sessionCount} 次练习 · 复习 ${report.reviews} 张卡片`,
    'zh-TW': `本週完成 ${report.sessionCount} 次練習 · 複習 ${report.reviews} 張卡片`,
  }[locale];
  const minuteLabel = {
    ja: '分',
    en: 'min',
    'zh-CN': '分钟',
    'zh-TW': '分鐘',
  }[locale];
  const action = {
    'word-saved': '收藏',
    'word-viewed': '查看',
    'word-known': '标记认识',
    'word-unknown': '重新标记陌生',
  } as const;

  return (
    <section className="learning-report">
      <div className="section-title">
        <h2>
          <BarChart3 size={20} /> 本周学习报表
        </h2>
        <span>
          {report.from} — {report.to}
        </span>
      </div>
      <div className="report-metrics">
        <article>
          <Clock3 />
          <span>学习时间</span>
          <strong>
            {report.studyMinutes}
            <small> 分钟</small>
          </strong>
        </article>
        <article>
          <BookOpen />
          <span>阅读文章</span>
          <strong>
            {report.articles}
            <small> 篇</small>
          </strong>
        </article>
        <article>
          <Languages />
          <span>新增单词</span>
          <strong>
            {report.words}
            <small> 个</small>
          </strong>
        </article>
        <article>
          <Headphones />
          <span>实际听音</span>
          <strong>
            {report.listeningMinutes}
            <small> 分钟</small>
          </strong>
        </article>
        <article>
          <Mic />
          <span>口语录音</span>
          <strong>
            {report.recordingMinutes}
            <small> 分钟</small>
          </strong>
        </article>
        <article>
          <Languages />
          <span>认识单词</span>
          <strong>
            {report.knownWords}
            <small> 个</small>
          </strong>
        </article>
      </div>
      <div className="report-details">
        <div className="report-chart">
          <h3>最近 7 天</h3>
          <div className="report-bars" aria-label={chartLabel}>
            {days.map((day) => (
              <div
                key={day.key}
                title={`${day.key} · ${day.value} ${minuteLabel}`}
              >
                <b>{day.value}</b>
                <i
                  style={{
                    height: `${Math.max(4, (day.value / peak) * 100)}%`,
                  }}
                />
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          <p>{weekSummary}</p>
        </div>
        <div className="word-timeline">
          <h3>单词轨迹</h3>
          {wordHistory.length ? (
            wordHistory.map((event) => (
              <div key={event.id}>
                <b data-user-content>{event.label}</b>
                <span>
                  {action[event.kind as keyof typeof action]} · {event.date}
                </span>
              </div>
            ))
          ) : (
            <p>查看、收藏或标记单词后，日期会出现在这里。</p>
          )}
        </div>
      </div>
    </section>
  );
}
