'use client';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Headphones,
  Mic,
  PenLine,
  LayoutDashboard,
  Download,
  Upload,
  ArrowUpRight,
  Play,
  Pause,
  RotateCcw,
  Check,
  Plus,
  Target,
  Trash2,
  FolderOpen,
  Brain,
  BarChart3,
  Languages,
  PackageOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StudyLibrary from '@/components/study-library';
import PracticeWorkspace from '@/components/practice-workspace';
import ReviewWorkspace from '@/components/review-workspace';
import LevelAssessment from '@/components/level-assessment';
import LearningReport from '@/components/learning-report';
import ImportCenter from '@/components/import-center';
import GlobalSearch from '@/components/global-search';
import { DomLocalizer, localeNames, translate, type Locale } from '@/lib/i18n';
import {
  emptyProgress,
  parseProgress,
  dayKey,
  type Progress,
  type Skill,
  type ActivityInput,
} from '@/lib/progress';
const KEY = 'ielts-workbench-v1';
const subjects = [
  {
    id: 'listening',
    name: '听力',
    en: 'Listening',
    icon: Headphones,
    task: '精听一段录音',
    hint: '听一遍抓主旨，再逐句听写并核对原文。',
    minutes: 25,
  },
  {
    id: 'reading',
    name: '阅读',
    en: 'Reading',
    icon: BookOpen,
    task: '限时阅读与错题复盘',
    hint: '完成一篇阅读，标出定位词与同义替换。',
    minutes: 25,
  },
  {
    id: 'writing',
    name: '写作',
    en: 'Writing',
    icon: PenLine,
    task: '练习一个论证段落',
    hint: '用观点、解释和例子，写出一个完整段落。',
    minutes: 25,
  },
  {
    id: 'speaking',
    name: '口语',
    en: 'Speaking',
    icon: Mic,
    task: '练习一个口语话题',
    hint: '描述一次让你印象深刻的旅行，录音后复述。',
    minutes: 15,
  },
] as const;
export default function Home() {
  const [data, setData] = useState<Progress>(emptyProgress),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(''),
    [view, setView] = useState('today'),
    [libraryDirty, setLibraryDirty] = useState(false),
    [importDirty, setImportDirty] = useState(false),
    [practiceDirty, setPracticeDirty] = useState(false),
    [selected, setSelected] = useState<Skill>('listening'),
    [remaining, setRemaining] = useState(25 * 60),
    [running, setRunning] = useState(false),
    [note, setNote] = useState(''),
    [minutes, setMinutes] = useState(25),
    [score, setScore] = useState(''),
    [pending, setPending] = useState<Progress | null>(null),
    [storageBroken, setStorageBroken] = useState(false),
    [locale, setLocale] = useState<Locale>('ja'),
    [libraryTarget, setLibraryTarget] = useState<{
      id: string;
      kind: 'articles' | 'vocabulary' | 'audio' | 'recordings';
      token: number;
    } | null>(null),
    [today, setToday] = useState(dayKey());
  const file = useRef<HTMLInputElement>(null),
    deadline = useRef(0),
    rawSnapshot = useRef<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedLocale = localStorage.getItem('ielts-workbench-language');
        if (['ja', 'en', 'zh-CN', 'zh-TW'].includes(savedLocale || ''))
          setLocale(savedLocale as Locale);
        const raw = localStorage.getItem(KEY);
        rawSnapshot.current = raw;
        if (raw) setData(parseProgress(raw));
      } catch {
        setStorageBroken(true);
        setMessage(
          '本地进度暂时无法读取，已暂停保存。请先导出原始数据，再导入有效备份并选择替换。',
        );
      }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    const id = setInterval(() => setToday(dayKey()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const next = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        setMessage('本轮专注完成，点击「保存学习记录」记录成果。');
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);
  function save(next: Progress, recover = false) {
    if (storageBroken && !recover) {
      setMessage(
        '原始进度已保护。请先导出原始数据，再导入有效备份并选择替换。',
      );
      return false;
    }
    try {
      const current = localStorage.getItem(KEY);
      if (current !== rawSnapshot.current) {
        rawSnapshot.current = current;
        try {
          setData(current ? parseProgress(current) : emptyProgress);
        } catch {
          setStorageBroken(true);
        }
        setMessage(
          '另一页面已更新进度，已同步最新记录。请检查后重新保存本次操作。',
        );
        return false;
      }
      const serialized = JSON.stringify(next);
      parseProgress(serialized);
      localStorage.setItem(KEY, serialized);
      rawSnapshot.current = serialized;
      setStorageBroken(false);
      setData(next);
      return true;
    } catch {
      setMessage('保存失败：浏览器存储不可用或已满，请先导出现有进度。');
      return false;
    }
  }
  function updateProgress(transform: (current: Progress) => Progress) {
    let current = data;
    try {
      const raw = localStorage.getItem(KEY);
      current = raw ? parseProgress(raw) : emptyProgress;
    } catch {
      setStorageBroken(true);
      setMessage('当前进度无法读取，已停止本次保存。请先导出原始数据。');
      return false;
    }
    const next = transform(current);
    return next === current ? true : save(next);
  }
  function recordActivity(event: ActivityInput) {
    const now = new Date();
    return updateProgress((current) => ({
      ...current,
      activities: [
        {
          ...event,
          id: crypto.randomUUID(),
          date: dayKey(now),
          at: now.toISOString(),
          moduleId: event.moduleId || 'ielts',
          subjectId: event.subjectId || 'english',
        },
        ...current.activities,
      ].slice(0, 50000),
    }));
  }
  function navigate(next: string, replaceSurface = false) {
    if (
      view === 'practice' &&
      next !== 'practice' &&
      practiceDirty &&
      !window.confirm(translate(locale, '练习中有未保存内容或录音，确定离开？'))
    )
      return false;
    if (
      view === 'library' &&
      (next !== 'library' || replaceSurface) &&
      libraryDirty &&
      !window.confirm(
        translate(
          locale,
          '资料库有未保存内容或正在进行的操作。离开会放弃未保存的录音或文字，是否继续？',
        ),
      )
    )
      return false;
    if (
      view === 'import' &&
      next !== 'import' &&
      importDirty &&
      !window.confirm(translate(locale, '导入内容尚未保存，确定离开导入中心？'))
    )
      return false;
    setView(next);
    return true;
  }
  function choose(id: Skill) {
    setSelected(id);
    navigate('practice');
    setRunning(false);
    const m = subjects.find((s) => s.id === id)!.minutes;
    setRemaining(m * 60);
    setMinutes(m);
    setNote('');
    setScore('');
  }
  function record() {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      setMessage('学习时长请输入 1–1440 分钟。');
      return;
    }
    const n = score === '' ? null : Number(score);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 9 || (n * 2) % 1)) {
      setMessage('分数请输入 0–9，支持 0.5 分间隔。');
      return;
    }
    if (
      save({
        ...data,
        sessions: [
          {
            id: crypto.randomUUID(),
            date: today,
            skill: selected,
            minutes,
            score: n,
            note: note.trim(),
          },
          ...data.sessions,
        ],
      })
    ) {
      setMessage('学习记录已保存。今天又前进了一步。');
      setNote('');
      setScore('');
      setRunning(false);
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          storageBroken
            ? (rawSnapshot.current ?? JSON.stringify(data, null, 2))
            : JSON.stringify(data, null, 2),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-${storageBroken ? 'recovery-raw' : 'progress'}-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('进度备份已导出。');
  }
  async function importData(f?: File) {
    if (!f) return;
    try {
      if (f.size > 5 * 1024 * 1024) throw Error('文件不能超过 5 MB');
      setPending(parseProgress(await f.text()));
      setMessage('备份验证通过，请选择合并或替换。');
    } catch (e) {
      setMessage(
        `导入失败：${e instanceof Error ? e.message : '文件格式错误'}。原进度保持不变。`,
      );
    }
    if (file.current) file.current.value = '';
  }
  function acceptImport(replace: boolean) {
    if (!pending) return;
    const sessions = replace
      ? pending.sessions
      : [
          ...new Map(
            [...pending.sessions, ...data.sessions].map((s) => [s.id, s]),
          ).values(),
        ].sort((a, b) => b.date.localeCompare(a.date));
    const reviewCards = replace
      ? pending.reviews.cards
      : [
          ...new Map(
            [...pending.reviews.cards, ...data.reviews.cards]
              .sort((a, b) =>
                (a.lastReviewedDate || '').localeCompare(
                  b.lastReviewedDate || '',
                ),
              )
              .map((card) => [card.id, card]),
          ).values(),
        ];
    const reviewEvents = replace
      ? pending.reviews.events
      : [
          ...new Map(
            [...pending.reviews.events, ...data.reviews.events].map((event) => [
              event.id,
              event,
            ]),
          ).values(),
        ].sort((a, b) => b.date.localeCompare(a.date));
    const assessments = replace
      ? pending.assessments
      : [
          ...new Map(
            [...pending.assessments, ...data.assessments].map((assessment) => [
              assessment.id,
              assessment,
            ]),
          ).values(),
        ].sort((a, b) => b.date.localeCompare(a.date));
    assessments.splice(1000);
    const activities = replace
      ? pending.activities
      : [
          ...new Map(
            [...pending.activities, ...data.activities].map((event) => [
              event.id,
              event,
            ]),
          ).values(),
        ]
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 50000);
    if (
      save(
        {
          ...pending,
          profile: replace ? pending.profile : data.profile,
          sessions,
          reviews: { cards: reviewCards, events: reviewEvents },
          assessments,
          activities,
        },
        replace,
      )
    ) {
      setPending(null);
      setMessage('进度已导入并保存。');
    }
  }
  const active = subjects.find((s) => s.id === selected)!;
  const todaySessions = data.sessions.filter((s) => s.date === today),
    done = new Set(todaySessions.map((s) => s.skill)),
    total = data.sessions.reduce((a, s) => a + s.minutes, 0);
  const reviewsDue = data.reviews.cards.filter(
    (card) => card.dueDate <= today,
  ).length;
  const latestAssessment = data.assessments[0];
  const knownState = new Map<string, boolean>();
  for (const event of data.activities) {
    const key = event.resourceId.toLowerCase();
    if (
      !knownState.has(key) &&
      (event.kind === 'word-known' || event.kind === 'word-unknown')
    )
      knownState.set(key, event.kind === 'word-known');
  }
  const knownWords = [...knownState]
    .filter(([, known]) => known)
    .map(([word]) => word);
  const dateLocale = {
    ja: 'ja-JP',
    en: 'en-US',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
  }[locale];
  const days = new Set(data.sessions.map((s) => s.date)).size;
  const exam = data.profile.examDate
    ? Math.ceil(
        (new Date(data.profile.examDate + 'T00:00:00').getTime() -
          new Date(today + 'T00:00:00').getTime()) /
          86400000,
      )
    : null;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = dayKey(d);
    return {
      key,
      label: d.toLocaleDateString(dateLocale, { weekday: 'short' }),
      value: data.sessions
        .filter((s) => s.date === key)
        .reduce((a, s) => a + s.minutes, 0),
    };
  });
  if (!ready) return <main className="loading">正在读取学习进度…</main>;
  return (
    <>
      <DomLocalizer locale={locale} />
      <div className="shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => navigate('today')}>
            <BookOpen size={27} />
            <span>
              IELTS<span className="brand-small">学习工作台</span>
            </span>
          </button>
          <div className="nav-label">我的备考</div>
          <nav>
            {[
              { id: 'today', name: '今日学习', icon: LayoutDashboard },
              { id: 'practice', name: '练习中心', icon: PenLine },
              { id: 'import', name: '导入中心', icon: PackageOpen },
              { id: 'review', name: '复习', icon: Brain },
              { id: 'assessment', name: '能力摸底', icon: BarChart3 },
              { id: 'history', name: '学习记录', icon: BookOpen },
              { id: 'library', name: '我的资料库', icon: FolderOpen },
              { id: 'settings', name: '目标与备份', icon: Target },
            ].map((n) => (
              <button
                key={n.id}
                className={view === n.id ? 'nav active' : 'nav'}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                {n.name}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="status-dot" />
            个人学习空间
            <p>
              进度保存在当前浏览器
              <br />
              定期导出，留住每一步。
            </p>
            <button onClick={exportData}>
              <Download size={16} />
              导出学习进度
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span>
              我的工作台 <span className="slash">/</span>{' '}
              {view === 'today'
                ? '今日学习'
                : view === 'history'
                  ? '学习记录'
                  : view === 'library'
                    ? '我的资料库'
                    : view === 'review'
                      ? '复习'
                      : view === 'assessment'
                        ? '能力摸底'
                        : view === 'practice'
                          ? '练习中心'
                          : view === 'import'
                            ? '导入中心'
                            : '目标与备份'}
            </span>
            <div className="topbar-tools">
              <GlobalSearch
                progress={data}
                locale={locale}
                onNavigate={navigate}
                onOpenLibrary={(item) => {
                  if (!navigate('library', true)) return;
                  setLibraryTarget({ ...item, token: Date.now() });
                }}
              />
              <label className="language-select">
                <Languages size={16} />
                <select
                  aria-label="Language"
                  value={locale}
                  onChange={(event) => {
                    const next = event.target.value as Locale;
                    localStorage.setItem('ielts-workbench-language', next);
                    setLocale(next);
                  }}
                >
                  {Object.entries(localeNames).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="date">
                {new Date(today + 'T12:00:00').toLocaleDateString(dateLocale, {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </span>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <h1>
                  {view === 'today'
                    ? '把目标，变成每天的进步。'
                    : view === 'history'
                      ? '每一次练习，都有迹可循。'
                      : view === 'library'
                        ? '学过的内容，留在自己手里。'
                        : view === 'review'
                          ? '在快要忘记之前，再想起一次。'
                          : view === 'assessment'
                            ? '用几道题，找到现在的起点。'
                            : view === 'practice'
                              ? '在这里练习，把进步留下。'
                              : view === 'import'
                                ? '把散落的材料，整理成下一次练习。'
                                : '给下一阶段，定一个目标。'}
                </h1>
                <p>
                  {view === 'today'
                    ? '从一个小任务开始，今天的积累会被记住。'
                    : view === 'history'
                      ? '回看练习、分数和复盘，找到下一步的重点。'
                      : view === 'library'
                        ? '收藏文章和单词，保存音频，回听每一次口语练习。'
                        : view === 'review'
                          ? '按照你的记忆表现安排下一次复习，让积累真正留下来。'
                          : view === 'assessment'
                            ? '短时间完成基础摸底，结果只用于安排学习。'
                            : view === 'practice'
                              ? '原文、作答、音频和录音，都在同一张工作台。'
                              : view === 'import'
                                ? '链接、文件、题库和电子书，将从这里进入你的学习系统。'
                                : '按自己的节奏备考，随时备份与迁移学习进度。'}
                </p>
              </div>
              <Button
                onClick={() => {
                  if (view === 'import') {
                    navigate('practice');
                    return;
                  }
                  navigate('today');
                  setTimeout(
                    () =>
                      document
                        .getElementById('focus')
                        ?.scrollIntoView({ behavior: 'smooth' }),
                    0,
                  );
                }}
              >
                {view === 'import' ? <PenLine size={18} /> : <Plus size={18} />}
                {view === 'import' ? '开始练习' : '记录学习'}
              </Button>
            </div>
            {storageBroken && (
              <div className="notice">
                <span>进度保护已开启，普通保存已暂停。</span>
                <button onClick={exportData}>导出原始数据</button>
              </div>
            )}
            {message && (
              <output className="notice" aria-live="polite">
                {message}
                <button aria-label="关闭提示" onClick={() => setMessage('')}>
                  ×
                </button>
              </output>
            )}
            {pending && (
              <section className="import-panel">
                <h2>导入 {pending.sessions.length} 条学习记录</h2>
                <p>
                  合并会按记录编号去重并保留当前目标；替换会覆盖当前进度和目标。
                </p>
                <Button onClick={() => acceptImport(false)}>合并进度</Button>{' '}
                <Button variant="outline" onClick={() => acceptImport(true)}>
                  替换全部进度
                </Button>{' '}
                <Button variant="ghost" onClick={() => setPending(null)}>
                  取消
                </Button>
              </section>
            )}
            {view === 'today' && (
              <>
                <section className="overview">
                  <div className="goal">
                    <div>
                      <Target size={19} />
                      目标分数
                    </div>
                    <strong>
                      {data.profile.target.toFixed(1)}
                      <small> / 9.0</small>
                    </strong>
                    <button onClick={() => navigate('settings')}>
                      调整目标
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div>
                    <span>今日学习</span>
                    <strong>
                      {todaySessions.reduce((a, s) => a + s.minutes, 0)}
                      <small> 分钟</small>
                    </strong>
                    <p>每天一点，稳步向前</p>
                  </div>
                  <div>
                    <span>累计学习</span>
                    <strong>
                      {(total / 60).toFixed(1)}
                      <small> 小时</small>
                    </strong>
                    <p>已记录 {days} 个学习日</p>
                  </div>
                  <div>
                    <span>距离考试</span>
                    <strong>
                      {exam === null ? '—' : Math.max(0, exam)}
                      <small> 天</small>
                    </strong>
                    <button onClick={() => navigate('settings')}>
                      {exam === null
                        ? '设置考试日期'
                        : exam! < 0
                          ? '考试日期已过'
                          : '查看备考目标'}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </section>
                <div className="study-grid">
                  <section className="tasks">
                    <div className="section-title">
                      <h2>今日四项练习</h2>
                      <span>{done.size} / 4 已记录</span>
                    </div>
                    <div className="progress-track">
                      <div style={{ width: `${(done.size / 4) * 100}%` }} />
                    </div>
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => choose(s.id)}
                        className={`task ${selected === s.id ? 'selected' : ''}`}
                      >
                        <div className={`subject-icon ${s.id}`}>
                          <s.icon size={23} />
                        </div>
                        <div className="task-body">
                          <div>
                            <b>{s.name}</b>
                            <span>{s.en}</span>
                          </div>
                          <h3>{s.task}</h3>
                          <p>{s.hint}</p>
                        </div>
                        <div className="task-end">
                          <span>
                            {done.has(s.id) ? (
                              <>
                                <Check size={15} />
                                已记录
                              </>
                            ) : (
                              <>{s.minutes} 分钟</>
                            )}
                          </span>
                          <ArrowUpRight size={18} />
                        </div>
                      </button>
                    ))}
                    <section className="study-material">
                      <h3>{active.name} · 在工作台内开始</h3>
                      <p>
                        直接阅读、听音频、作答和录音。完成后，连同学习材料一起保存到电脑。
                      </p>
                      <Button onClick={() => navigate('practice')}>
                        进入{active.name}练习
                      </Button>
                      <p className="material-source">
                        内置内容为原创模拟练习；也可以导入公开网页或音频链接。
                      </p>
                    </section>
                  </section>
                  <section id="focus" className="focus">
                    <div className="section-title">
                      <h2>专注此刻</h2>
                      <span>
                        <active.icon size={16} />
                        {active.name}
                      </span>
                    </div>
                    <div
                      className="timer"
                      aria-label={`剩余 ${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒`}
                    >
                      {String(Math.floor(remaining / 60)).padStart(2, '0')}
                      <span>:</span>
                      {String(remaining % 60).padStart(2, '0')}
                    </div>
                    <p className="timer-caption">{active.task}</p>
                    <div className="timer-actions">
                      <Button
                        disabled={remaining === 0}
                        onClick={() => {
                          if (!running)
                            deadline.current = Date.now() + remaining * 1000;
                          setRunning(!running);
                        }}
                      >
                        {running ? <Pause size={17} /> : <Play size={17} />}{' '}
                        {running ? '暂停专注' : '开始专注'}
                      </Button>
                      <button
                        className="reset"
                        aria-label="重置计时"
                        onClick={() => {
                          setRunning(false);
                          setRemaining(active.minutes * 60);
                        }}
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                    <div className="record-form">
                      <div className="form-row">
                        <label>
                          学习时长（分钟）
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            value={minutes}
                            onChange={(e) => setMinutes(Number(e.target.value))}
                          />
                        </label>
                        <label>
                          练习分数（选填）
                          <input
                            placeholder="0–9"
                            type="number"
                            min="0"
                            max="9"
                            step="0.5"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                          />
                        </label>
                      </div>
                      <label>
                        这次学到了什么？
                        <textarea
                          maxLength={5000}
                          rows={3}
                          placeholder="记下新表达、错题原因，或下次想改进的地方…"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </label>
                      <Button className="save-record" onClick={record}>
                        <Check size={17} />
                        保存学习记录
                      </Button>
                    </div>
                  </section>
                </div>
                <button
                  className="assessment-callout"
                  onClick={() => navigate('assessment')}
                >
                  <span>
                    <BarChart3 size={22} /> 能力摸底
                  </span>
                  <strong>
                    {latestAssessment
                      ? `Band ${latestAssessment.estimatedBand.toFixed(1)}`
                      : '8 题快速估算当前基础'}
                  </strong>
                  <small>
                    {latestAssessment
                      ? `上次测试：${latestAssessment.date}`
                      : '约 10 分钟 · 非官方估算'}
                  </small>
                  <ArrowUpRight size={20} />
                </button>
                <button
                  className="review-callout"
                  onClick={() => navigate('review')}
                >
                  <span>
                    <Brain size={22} /> 今日复习
                  </span>
                  <strong>
                    {reviewsDue
                      ? `${reviewsDue} 张卡片待复习`
                      : '今天没有到期卡片'}
                  </strong>
                  <small>
                    {data.reviews.cards.length} 张卡片已进入复习计划
                  </small>
                  <ArrowUpRight size={20} />
                </button>
                <div className="bottom-grid">
                  <section className="weekly">
                    <div className="section-title">
                      <h2>最近 7 天</h2>
                      <span>学习时长 · 分钟</span>
                    </div>
                    <div className="bars">
                      {week.map((d) => (
                        <div key={d.key} className="bar-column">
                          <span>{d.value}</span>
                          <div className="bar-space">
                            <div
                              className={
                                d.key === today ? 'bar current' : 'bar'
                              }
                              style={{
                                height: `${d.value ? Math.max(4, (d.value / Math.max(60, ...week.map((w) => w.value))) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <span>{d.key === today ? '今天' : d.label}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="recent">
                    <div className="section-title">
                      <h2>最近的积累</h2>
                      <button onClick={() => navigate('history')}>
                        全部记录
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {data.sessions.length ? (
                      data.sessions.slice(0, 2).map((s) => (
                        <div className="recent-row" key={s.id}>
                          <span>
                            {subjects.find((x) => x.id === s.skill)?.name}
                          </span>
                          <div>
                            <b>{s.note || '完成一次练习'}</b>
                            <p>
                              {s.date} · {s.minutes} 分钟
                              {s.score !== null ? ` · ${s.score} 分` : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        <BookOpen size={25} />
                        <p>第一条学习记录，从今天开始。</p>
                        <span>完成练习后，保存你的学习成果。</span>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
            {view === 'history' && (
              <section className="history">
                <LearningReport progress={data} locale={locale} />
                <div className="section-title">
                  <h2>
                    学习记录 <span>（{data.sessions.length} 条）</span>
                  </h2>
                  <button onClick={exportData}>
                    <Download size={17} />
                    导出记录
                  </button>
                </div>
                {data.sessions.length ? (
                  data.sessions.map((s) => (
                    <article className="history-row" key={s.id}>
                      <div>
                        <b>{subjects.find((x) => x.id === s.skill)?.name}</b>
                        <span>
                          {s.date} · {s.minutes} 分钟
                          {s.score !== null ? ` · 练习 ${s.score} 分` : ''}
                        </span>
                        <p>{s.note || '完成一次练习'}</p>
                      </div>
                      <button
                        aria-label={`删除 ${s.date} 的${s.minutes}分钟记录`}
                        onClick={() => {
                          if (
                            window.confirm(
                              translate(locale, '删除这条学习记录？'),
                            )
                          )
                            save({
                              ...data,
                              sessions: data.sessions.filter(
                                (x) => x.id !== s.id,
                              ),
                            });
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty">
                    <BookOpen />
                    <p>还没有记录。完成第一项练习后，这里会留下你的进步。</p>
                    <Button onClick={() => navigate('today')}>
                      开始今日学习
                    </Button>
                  </div>
                )}
              </section>
            )}
            {view === 'practice' && (
              <PracticeWorkspace
                locale={locale}
                initialSkill={selected}
                onDirty={setPracticeDirty}
                onActivity={recordActivity}
                knownWords={knownWords}
                onOpenImport={() => navigate('import')}
                onComplete={(skill, minutes, note) =>
                  updateProgress((current) => ({
                    ...current,
                    sessions: [
                      {
                        id: crypto.randomUUID(),
                        date: dayKey(),
                        skill,
                        minutes,
                        score: null,
                        note,
                      },
                      ...current.sessions,
                    ],
                  }))
                }
              />
            )}
            {view === 'import' && (
              <ImportCenter
                locale={locale}
                onDirty={setImportDirty}
                onOpenPractice={() => navigate('practice')}
                onOpenLibrary={() => navigate('library')}
              />
            )}
            {view === 'review' && (
              <ReviewWorkspace progress={data} onUpdate={updateProgress} />
            )}
            {view === 'assessment' && (
              <LevelAssessment
                locale={locale}
                progress={data}
                onUpdate={updateProgress}
              />
            )}
            {view === 'library' && (
              <StudyLibrary
                key={libraryTarget?.token || 'library'}
                locale={locale}
                progress={storageBroken ? null : data}
                onDirty={setLibraryDirty}
                onActivity={recordActivity}
                initialItem={libraryTarget}
              />
            )}
            {view === 'settings' && (
              <div className="settings-grid">
                <section>
                  <h2>备考目标</h2>
                  <label>
                    目标总分
                    <select
                      value={data.profile.target}
                      onChange={(e) =>
                        save({
                          ...data,
                          profile: {
                            ...data.profile,
                            target: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {Array.from({ length: 19 }, (_, i) => i / 2).map((v) => (
                        <option key={v} value={v}>
                          {v.toFixed(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    考试日期
                    <input
                      type="date"
                      value={data.profile.examDate}
                      onChange={(e) =>
                        save({
                          ...data,
                          profile: {
                            ...data.profile,
                            examDate: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <p className="muted">
                    目标自动保存。练习分数由你记录，不代表官方成绩。
                  </p>
                </section>
                <section>
                  <h2>进度备份</h2>
                  <p>
                    学习记录和目标自动保存在当前浏览器。换设备或清理浏览器数据前，请先导出备份。
                  </p>
                  <div className="backup-actions">
                    <Button onClick={exportData}>
                      <Download size={17} />
                      导出 JSON 备份
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={17} />
                      导入进度
                    </Button>
                  </div>
                  <p className="muted">
                    支持本站导出的 JSON 文件，最大 5
                    MB。导入前可选择合并或替换。
                  </p>
                </section>
              </div>
            )}
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => importData(e.target.files?.[0])}
            />
            <footer>
              <span>
                <span className="status-dot" />
                本地自动保存
              </span>
              <button onClick={() => file.current?.click()}>
                <Upload size={14} />
                导入进度
              </button>
              <span>一步一步，走向你的目标。</span>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
