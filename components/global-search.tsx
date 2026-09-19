'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  FileAudio,
  FolderOpen,
  History,
  Library,
  LoaderCircle,
  Mic,
  PackageOpen,
  Search,
  Settings2,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Progress } from '@/lib/progress';
import { translate, type Locale } from '@/lib/i18n';

type LibraryResult = {
  id: string;
  kind: 'articles' | 'vocabulary' | 'audio' | 'recordings';
  title: string;
  source: string;
  skill: string;
  excerpt: string;
};
type SearchResult = {
  id: string;
  group: '页面' | '电脑资料' | '学习记录' | '复习内容';
  title: string;
  detail: string;
  icon: LucideIcon;
  run: () => void;
};

const pages = [
  ['today', '今日学习', '任务、专注计时与今日进度', Sparkles],
  ['practice', '练习中心', '听力、阅读、写作与口语', BookOpen],
  ['import', '导入中心', '网页、音频、题库与电子书', PackageOpen],
  ['review', '复习', '到期单词和错题卡', Library],
  ['assessment', '能力摸底', '快速估算当前基础', BarChart3],
  ['history', '学习记录', '周报、学习日期和笔记', History],
  ['library', '我的资料库', '文章、单词、音频与录音', FolderOpen],
  ['settings', '目标与备份', '考试日期、导入与导出', Settings2],
] as const;

function includes(value: string, query: string) {
  return value.normalize('NFKC').toLocaleLowerCase().includes(query);
}

export default function GlobalSearch({
  progress,
  locale,
  onNavigate,
  onOpenLibrary,
}: {
  progress: Progress;
  locale: Locale;
  onNavigate: (view: string) => void;
  onOpenLibrary: (item: { id: string; kind: LibraryResult['kind'] }) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [remote, setRemote] = useState<LibraryResult[]>([]),
    [loading, setLoading] = useState(false),
    [offline, setOffline] = useState(false),
    [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  function showSearch() {
    setSelected(0);
    setOpen(true);
  }

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSelected(0);
        setOpen((value) => !value);
      } else if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useEffect(() => {
    const value = query.trim();
    if (!open || value.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/library/search?q=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw Error('search unavailable');
        const data = (await response.json()) as { items: LibraryResult[] };
        setRemote(data.items);
        setOffline(false);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRemote([]);
          setOffline(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const results = useMemo(() => {
    const normalized = query.trim().normalize('NFKC').toLocaleLowerCase();
    const output: SearchResult[] = [];
    for (const [id, title, detail, icon] of pages) {
      if (!normalized || includes(`${title} ${detail}`, normalized))
        output.push({
          id: `page:${id}`,
          group: '页面',
          title,
          detail,
          icon,
          run: () => onNavigate(id),
        });
    }
    if (normalized) {
      for (const card of progress.reviews.cards.slice(0, 10000)) {
        if (!includes(`${card.front} ${card.back} ${card.context}`, normalized))
          continue;
        output.push({
          id: `review:${card.id}`,
          group: '复习内容',
          title: card.front,
          detail: card.context || card.back.slice(0, 110),
          icon: Library,
          run: () => onNavigate('review'),
        });
        if (output.length >= 40) break;
      }
      for (const session of progress.sessions.slice(0, 2000)) {
        if (
          !includes(
            `${session.date} ${session.skill} ${session.note}`,
            normalized,
          )
        )
          continue;
        output.push({
          id: `session:${session.id}`,
          group: '学习记录',
          title: session.note || `${session.skill} · ${session.minutes} 分钟`,
          detail: `${session.date} · ${session.skill} · ${session.minutes} 分钟`,
          icon: History,
          run: () => onNavigate('history'),
        });
        if (output.length >= 50) break;
      }
      const words = new Set<string>();
      for (const activity of progress.activities) {
        if (!activity.kind.startsWith('word-')) continue;
        const key = activity.resourceId.toLocaleLowerCase();
        if (words.has(key) || !includes(`${activity.label} ${key}`, normalized))
          continue;
        words.add(key);
        output.push({
          id: `word:${key}`,
          group: '复习内容',
          title: activity.label,
          detail: `${activity.date} · 单词学习轨迹`,
          icon: Library,
          run: () => onNavigate('history'),
        });
        if (words.size >= 15 || output.length >= 60) break;
      }
    }
    for (const item of remote) {
      const icon =
        item.kind === 'audio'
          ? FileAudio
          : item.kind === 'recordings'
            ? Mic
            : item.kind === 'vocabulary'
              ? Library
              : BookOpen;
      output.push({
        id: `library:${item.kind}:${item.id}`,
        group: '电脑资料',
        title: item.title,
        detail: item.excerpt || `${item.skill} · ${item.source}`,
        icon,
        run: () => onOpenLibrary({ id: item.id, kind: item.kind }),
      });
    }
    return output.slice(0, normalized ? 60 : 8);
  }, [onNavigate, onOpenLibrary, progress, query, remote]);

  function choose(result: SearchResult) {
    result.run();
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <button className="search-trigger" onClick={showSearch}>
        <Search size={16} />
        <span>搜索</span>
        <kbd>
          {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
            ? '⌘'
            : 'Ctrl'}{' '}
          K
        </kbd>
      </button>
      {open && (
        <div
          className="search-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <dialog
            open
            className="search-palette"
            aria-modal="true"
            aria-label="统一搜索"
          >
            <div className="search-input-row">
              {loading ? (
                <LoaderCircle className="spin" size={20} />
              ) : (
                <Search size={20} />
              )}
              <input
                ref={input}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(0);
                  if (event.target.value.trim().length < 2) {
                    setRemote([]);
                    setLoading(false);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelected((value) =>
                      Math.min(Math.max(0, results.length - 1), value + 1),
                    );
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelected((value) => Math.max(0, value - 1));
                  }
                  if (event.key === 'Enter' && results[selected]) {
                    event.preventDefault();
                    choose(results[selected]);
                  }
                }}
                placeholder={translate(
                  locale,
                  '搜索文章内容、单词、笔记、音频标题…',
                )}
                aria-label="搜索学习内容"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="search-results">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  className={selected === index ? 'selected' : ''}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => choose(result)}
                >
                  <result.icon size={18} />
                  <span>
                    <b>{result.title}</b>
                    <small>{result.detail}</small>
                  </span>
                  <em>{result.group}</em>
                </button>
              ))}
              {!results.length && !loading && (
                <div className="search-empty">
                  <Search size={24} />
                  <b>没有找到匹配内容</b>
                  <span>
                    {offline
                      ? '本机资料服务暂时未连接，仍可搜索学习记录。'
                      : '换一个更短的关键词试试。'}
                  </span>
                </div>
              )}
            </div>
            <footer className="search-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> 选择
              </span>
              <span>
                <kbd>↵</kbd> 打开
              </span>
              <span>音频正文需要转写后才能检索</span>
            </footer>
          </dialog>
        </div>
      )}
    </>
  );
}
