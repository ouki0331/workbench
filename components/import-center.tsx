'use client';
import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  ArrowRight,
  BookMarked,
  Check,
  FileQuestion,
  FileUp,
  Headphones,
  Link2,
  LoaderCircle,
  PackageOpen,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Skill } from '@/lib/progress';
import type { Locale } from '@/lib/i18n';

type ImportedItem = {
  id: string;
  kind: string;
  title: string;
  source: string;
};

async function importPublicUrl(data: {
  url: string;
  title: string;
  skill: Skill;
  operationId: string;
}) {
  const response = await fetch('/api/library/import-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-IELTS-Local': '1',
    },
    body: JSON.stringify(data),
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw Error('本地资料服务未连接，请运行本机版工作台。');
  }
  if (!response.ok)
    throw Error((result as { error?: string }).error || '链接读取失败');
  return result as { item: ImportedItem; notice?: string };
}

const sources = [
  {
    id: 'url',
    name: '网页与音频链接',
    note: '现在可用',
    icon: Link2,
    active: true,
  },
  {
    id: 'file',
    name: '文档与音频文件',
    note: '资料库已支持',
    icon: FileUp,
    active: false,
  },
  {
    id: 'questions',
    name: 'JSON / CSV 题库',
    note: '下一阶段',
    icon: FileQuestion,
    active: false,
  },
  {
    id: 'ebook',
    name: 'EPUB 电子书',
    note: '规划中',
    icon: BookMarked,
    active: false,
  },
] as const;

export default function ImportCenter({
  locale: _locale,
  onDirty,
  onOpenPractice,
  onOpenLibrary,
}: {
  locale: Locale;
  onDirty: (dirty: boolean) => void;
  onOpenPractice: () => void;
  onOpenLibrary: () => void;
}) {
  const [url, setUrl] = useState(''),
    [title, setTitle] = useState(''),
    [skill, setSkill] = useState<Skill>('reading'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [result, setResult] = useState<ImportedItem | null>(null);
  const operation = useRef<{ payload: string; id: string } | null>(null);
  const dirty = busy || !!url || !!title;

  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (busy) return;
    const payload = JSON.stringify({
      url: url.trim(),
      title: title.trim(),
      skill,
    });
    if (operation.current?.payload !== payload)
      operation.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    setMessage('正在读取并整理材料…');
    setResult(null);
    try {
      const imported = await importPublicUrl({
        operationId: operation.current.id,
        url: url.trim(),
        title: title.trim(),
        skill,
      });
      operation.current = null;
      setResult(imported.item);
      setUrl('');
      setTitle('');
      setMessage(imported.notice || '材料已整理并保存到电脑。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-center">
      <section className="import-desk">
        <div className="import-source-list" aria-label="导入来源">
          <div className="import-source-heading">
            <PackageOpen size={19} />
            <span>选择来源</span>
          </div>
          {sources.map((source) => (
            <button
              key={source.id}
              className={source.active ? 'active' : ''}
              disabled={!source.active}
              title={
                source.active ? source.name : `${source.name} · ${source.note}`
              }
            >
              <source.icon size={20} />
              <span>
                <b>{source.name}</b>
                <small>{source.note}</small>
              </span>
              {source.active && <Check size={16} />}
            </button>
          ))}
          <button className="library-shortcut" onClick={onOpenLibrary}>
            <FileUp size={20} />
            <span>
              <b>已有本地文件？</b>
              <small>前往资料库上传</small>
            </span>
            <ArrowRight size={16} />
          </button>
        </div>

        <form className="import-form" onSubmit={submit}>
          <div className="import-form-heading">
            <div>
              <h2>从一个链接开始整理</h2>
              <p>粘贴公开网页或直接音频地址，正文和原文件会保存到电脑。</p>
            </div>
            <span className="local-badge">
              <ShieldCheck size={15} /> 本机保存
            </span>
          </div>
          <label className="import-url-field">
            公开 HTTPS 链接
            <span>
              <Link2 size={18} />
              <input
                required
                type="url"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.org/article"
              />
            </span>
          </label>
          <div className="import-form-row">
            <label>
              用于练习
              <select
                value={skill}
                onChange={(event) => setSkill(event.target.value as Skill)}
              >
                <option value="reading">阅读</option>
                <option value="listening">听力</option>
                <option value="writing">写作素材</option>
                <option value="speaking">口语素材</option>
              </select>
            </label>
            <label>
              自定义标题（选填）
              <input
                value={title}
                maxLength={180}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="留空则使用网页标题"
              />
            </label>
          </div>
          <div className="import-submit-row">
            <Button type="submit" disabled={busy || !url.trim()}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <PackageOpen size={17} />
              )}
              {busy ? '正在整理…' : '读取并保存'}
            </Button>
            <p>需要登录、付费或动态加载的网站可能无法读取。</p>
          </div>
          {message && (
            <output
              className={result ? 'import-result success' : 'import-result'}
              aria-live="polite"
            >
              {result ? <Check size={18} /> : <Link2 size={18} />}
              <span>
                <b>{result?.title || message}</b>
                {result && <small>{message}</small>}
              </span>
              {result && (
                <button type="button" onClick={onOpenPractice}>
                  去练习 <ArrowRight size={15} />
                </button>
              )}
            </output>
          )}
        </form>
      </section>

      <section className="import-roadmap">
        <div>
          <h2>一次导入，进入完整学习流程</h2>
          <p>材料经过整理后，可以在练习、复习、统计和资料库中重复使用。</p>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <b>读取来源</b>
              <small>检查链接类型与可访问性</small>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <b>整理内容</b>
              <small>提取正文、音频和来源信息</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <b>保存到电脑</b>
              <small>随时从练习页重新打开</small>
            </div>
          </li>
        </ol>
        <div className="format-note">
          <Headphones size={18} />
          <p>
            <b>电子书听力方案</b>
            <br />
            EPUB 导入后优先使用原有音频；没有音频时可用浏览器朗读。
          </p>
        </div>
      </section>
    </div>
  );
}
