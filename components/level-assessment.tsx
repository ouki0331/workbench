'use client';
/* oxlint-disable jsx-a11y/media-has-caption -- The listening task tests comprehension; showing captions would reveal answers. */
import { useState } from 'react';
import { BarChart3, Check, Headphones, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dayKey, type Progress } from '@/lib/progress';
import type { Locale } from '@/lib/i18n';
import { estimateBand } from '@/lib/assessment';

const copy = {
  ja: {
    intro: '8問・約10分',
    title: '現在の基礎レベルを確認',
    body: 'リスニング、リーディング、語彙・文法を短く確認します。結果は学習計画の目安です。',
    start: 'テストを始める',
    listening: 'リスニング',
    reading: 'リーディング',
    language: '語彙・文法',
    listen:
      '音声を聞いて、最も適切な答えを選んでください。必要ならもう一度再生できます。',
    choose: '回答を選択',
    submit: '結果を見る',
    missing: '8問すべてに回答してください。',
    result: '推定基礎レベル',
    correct: '正解',
    caveat:
      '短い非公式テストの推定です。IELTS公式スコアではなく、WritingとSpeakingの採点も含みません。',
    adviceLow: 'まずは基本語彙と短い音声・文章の理解を重点的に練習しましょう。',
    adviceMid:
      '基礎はできています。時間を測った練習と間違いの復習を増やしましょう。',
    adviceHigh:
      '良い基礎があります。本番形式の練習とWriting・Speakingのフィードバックへ進みましょう。',
    again: 'もう一度受ける',
    saved: '結果は学習進捗に保存されました。',
    previous: '前回',
    band: 'Band',
  },
  en: {
    intro: '8 questions · about 10 minutes',
    title: 'Check your current foundation',
    body: 'A short check of listening, reading, vocabulary and grammar. Use the result as a planning guide.',
    start: 'Start the test',
    listening: 'Listening',
    reading: 'Reading',
    language: 'Vocabulary & grammar',
    listen:
      'Listen and choose the best answer. You may replay the audio if needed.',
    choose: 'Choose an answer',
    submit: 'See my result',
    missing: 'Please answer all 8 questions.',
    result: 'Estimated foundation level',
    correct: 'correct',
    caveat:
      'This is a short, unofficial estimate. It is not an official IELTS score and does not grade Writing or Speaking.',
    adviceLow:
      'Focus first on core vocabulary and understanding short recordings and texts.',
    adviceMid:
      'Your foundation is developing. Add timed practice and review your mistakes regularly.',
    adviceHigh:
      'You have a solid foundation. Move toward full test practice and feedback on Writing and Speaking.',
    again: 'Take it again',
    saved: 'The result was saved with your study progress.',
    previous: 'Previous',
    band: 'Band',
  },
  'zh-CN': {
    intro: '8 题 · 约 10 分钟',
    title: '测一测当前基础水平',
    body: '快速检查听力、阅读、词汇和语法，结果用于安排学习，不会冒充官方成绩。',
    start: '开始摸底',
    listening: '听力',
    reading: '阅读',
    language: '词汇与语法',
    listen: '听音频并选择最佳答案，需要时可以重复播放。',
    choose: '选择答案',
    submit: '查看结果',
    missing: '请完成全部 8 道题。',
    result: '基础能力估算',
    correct: '答对',
    caveat:
      '这是简短的非官方估算，不是 IELTS 官方成绩，也不包含写作和口语评分。',
    adviceLow: '先重点积累基础词汇，并练习理解短音频和短文章。',
    adviceMid: '基础正在形成，可以增加限时练习，并规律复习错题。',
    adviceHigh: '基础比较扎实，可以转向完整套题，并获取写作和口语反馈。',
    again: '重新测试',
    saved: '结果已保存到学习进度。',
    previous: '上次',
    band: 'Band',
  },
  'zh-TW': {
    intro: '8 題 · 約 10 分鐘',
    title: '測一測目前基礎程度',
    body: '快速檢查聽力、閱讀、詞彙和文法，結果用於安排學習，不會冒充官方成績。',
    start: '開始摸底',
    listening: '聽力',
    reading: '閱讀',
    language: '詞彙與文法',
    listen: '聽音訊並選擇最佳答案，需要時可以重複播放。',
    choose: '選擇答案',
    submit: '查看結果',
    missing: '請完成全部 8 道題。',
    result: '基礎能力估算',
    correct: '答對',
    caveat:
      '這是簡短的非官方估算，不是 IELTS 官方成績，也不包含寫作和口說評分。',
    adviceLow: '先重點累積基礎詞彙，並練習理解短音訊和短文章。',
    adviceMid: '基礎正在形成，可以增加限時練習，並規律複習錯題。',
    adviceHigh: '基礎比較扎實，可以轉向完整套題，並取得寫作和口說回饋。',
    again: '重新測試',
    saved: '結果已儲存到學習進度。',
    previous: '上次',
    band: 'Band',
  },
} as const;

const passage = `At a small language school, students used to receive all feedback at the end of each course. The school later introduced short weekly meetings with teachers. Students said the new system helped them notice problems earlier and set clearer goals. Teachers initially worried that the meetings would take too much time, but most found that later written feedback became quicker because students already understood their main areas for improvement. The school has not removed end-of-course reports; instead, the two forms of feedback now serve different purposes.`;

const questions = [
  {
    section: 'listening',
    prompt: 'How many weeks does the photography course last?',
    options: ['Three', 'Four', 'Five', 'Six'],
    answer: 1,
  },
  {
    section: 'listening',
    prompt: 'What is the total course fee?',
    options: ['£45', '£55', '£65', '£75'],
    answer: 2,
  },
  {
    section: 'listening',
    prompt: 'Where will the walking group meet this week?',
    options: [
      'Outside the library',
      'At the park’s north entrance',
      'At the community garden',
      'Inside the centre',
    ],
    answer: 1,
  },
  {
    section: 'reading',
    prompt: 'Why were weekly meetings introduced?',
    options: [
      'To replace written reports',
      'To identify problems earlier',
      'To shorten every course',
      'To assess teachers',
    ],
    answer: 1,
  },
  {
    section: 'reading',
    prompt: 'Teachers found that the meetings made later written feedback…',
    options: [
      'less detailed',
      'unnecessary',
      'faster to prepare',
      'more difficult',
    ],
    answer: 2,
  },
  {
    section: 'reading',
    prompt: 'End-of-course reports are no longer used.',
    options: ['True', 'False', 'Not Given', 'Only for new students'],
    answer: 1,
  },
  {
    section: 'language',
    prompt: 'Choose the best sentence.',
    options: [
      'She has studied English since two years.',
      'She studies English for two years ago.',
      'She has been studying English for two years.',
      'She is study English since two years.',
    ],
    answer: 2,
  },
  {
    section: 'language',
    prompt: '“The evidence was compelling” means the evidence was…',
    options: [
      'difficult to find',
      'strong and convincing',
      'old and incomplete',
      'easy to ignore',
    ],
    answer: 1,
  },
] as const;

export default function LevelAssessment({
  locale,
  progress,
  onUpdate,
}: {
  locale: Locale;
  progress: Progress;
  onUpdate: (transform: (current: Progress) => Progress) => boolean;
}) {
  const c = copy[locale];
  const [started, setStarted] = useState(false),
    [answers, setAnswers] = useState<number[]>(Array(8).fill(-1)),
    [result, setResult] = useState<{ correct: number; band: number } | null>(
      null,
    ),
    [message, setMessage] = useState('');
  const latest = progress.assessments[0];

  function submit() {
    if (answers.some((answer) => answer < 0)) {
      setMessage(c.missing);
      return;
    }
    const correct = answers.reduce(
      (sum, answer, index) => sum + Number(answer === questions[index].answer),
      0,
    );
    const band = estimateBand(correct);
    const assessment = {
      id: crypto.randomUUID(),
      date: dayKey(),
      correct,
      total: 8 as const,
      estimatedBand: band,
      answers: [...answers],
    };
    if (
      !onUpdate((current) => ({
        ...current,
        assessments: [assessment, ...current.assessments].slice(0, 1000),
      }))
    )
      return;
    setResult({ correct, band });
    setMessage(c.saved);
  }

  function reset() {
    setAnswers(Array(8).fill(-1));
    setResult(null);
    setMessage('');
    setStarted(true);
  }

  if (!started && !result)
    return (
      <section className="assessment-intro">
        <BarChart3 size={34} />
        <div>
          <span>{c.intro}</span>
          <h2>{c.title}</h2>
          <p>{c.body}</p>
          {latest && (
            <small>
              {c.previous}: {c.band} {latest.estimatedBand.toFixed(1)} ·{' '}
              {latest.date}
            </small>
          )}
        </div>
        <Button onClick={() => setStarted(true)}>{c.start}</Button>
      </section>
    );

  if (result) {
    const advice =
      result.band < 5
        ? c.adviceLow
        : result.band < 6.5
          ? c.adviceMid
          : c.adviceHigh;
    return (
      <section className="assessment-result">
        <Check size={32} />
        <p>{c.result}</p>
        <strong>
          {c.band} {result.band.toFixed(1)}
        </strong>
        <span>
          {result.correct} / 8 {c.correct}
        </span>
        <h2>{advice}</h2>
        <p>{c.caveat}</p>
        {message && <output>{message}</output>}
        <Button variant="outline" onClick={reset}>
          <RotateCcw size={17} />
          {c.again}
        </Button>
      </section>
    );
  }

  return (
    <section className="assessment-test">
      <header>
        <div>
          <span>{c.intro}</span>
          <h2>{c.title}</h2>
        </div>
        <b>{answers.filter((answer) => answer >= 0).length} / 8</b>
      </header>
      <div className="assessment-audio">
        <Headphones size={20} />
        <div>
          <h3>{c.listening}</h3>
          <p>{c.listen}</p>
          <audio controls src="/practice/community-centre.wav" />
        </div>
      </div>
      <div className="assessment-passage">
        <h3>{c.reading}</h3>
        <p>{passage}</p>
      </div>
      <div className="assessment-questions">
        {questions.map((question, index) => (
          <fieldset key={question.prompt}>
            <legend>
              <small>{copy[locale][question.section]}</small>
              {index + 1}. {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => (
              <label key={option}>
                <input
                  type="radio"
                  name={`assessment-${index}`}
                  checked={answers[index] === optionIndex}
                  onChange={() =>
                    setAnswers((old) =>
                      old.map((value, i) =>
                        i === index ? optionIndex : value,
                      ),
                    )
                  }
                />{' '}
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {message && (
        <output className="assessment-error" aria-live="polite">
          {message}
        </output>
      )}
      <Button className="assessment-submit" onClick={submit}>
        {c.submit}
      </Button>
    </section>
  );
}
