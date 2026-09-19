'use client';
/* oxlint-disable jsx-a11y/media-has-caption -- Personal audio has no generated captions; the built-in listening transcript is provided beside its player. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Headphones,
  Mic,
  PenLine,
  Download,
  PackageOpen,
  Square,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  practiceMaterials,
  answerMatches,
  type Material,
} from '@/lib/practice-materials';
import type { Skill, ResourceRef } from '@/lib/progress';
import type { ActivityInput } from '@/lib/progress';
import { translate, type Locale } from '@/lib/i18n';
import {
  builtInVocabularyProvider,
  type VocabularyEntry,
} from '@/lib/learning-providers';
type LibraryItem = {
  id: string;
  resourceRef?: ResourceRef;
  kind: string;
  title: string;
  mime: string;
  source: string;
  skill: Skill;
  filename: string;
};
type CatalogItem = {
  id: string;
  title: string;
  topic: 'international-politics' | 'economy-finance';
  topicLabel: string;
  provider: string;
  description: string;
  url: string;
};
const usedKey = 'ielts-used-resources-v1';
const wallClock = () => Date.now();
const skills = [
  { id: 'listening' as const, name: '听力', icon: Headphones },
  { id: 'reading' as const, name: '阅读', icon: BookOpen },
  { id: 'writing' as const, name: '写作', icon: PenLine },
  { id: 'speaking' as const, name: '口语', icon: Mic },
];
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-IELTS-Local', '1');
  const r = await fetch(path, { ...options, headers });
  let data: unknown;
  try {
    data = await r.json();
  } catch {
    throw Error('本地保存服务未连接，请使用本机版工作台。');
  }
  if (!r.ok) throw Error((data as { error?: string }).error || '操作失败');
  return data as T;
}
const post = <T,>(path: string, data: unknown) =>
  api<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
export default function PracticeWorkspace({
  locale,
  initialSkill,
  onDirty,
  onComplete,
  onActivity,
  knownWords,
  onOpenImport,
}: {
  locale: Locale;
  initialSkill: Skill;
  onDirty: (dirty: boolean) => void;
  onComplete: (skill: Skill, minutes: number, note: string) => boolean;
  onActivity: (event: ActivityInput) => boolean;
  knownWords: string[];
  onOpenImport: () => void;
}) {
  const [material, setMaterial] = useState<Material>(() =>
      practiceMaterials.find((m) => m.skill === initialSkill)!,
    ),
    [answers, setAnswers] = useState<string[]>([]),
    [checked, setChecked] = useState(false),
    [response, setResponse] = useState(''),
    [notes, setNotes] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [audioLinks, setAudioLinks] = useState<string[]>([]),
    [saved, setSaved] = useState<LibraryItem[]>([]),
    [savedId, setSavedId] = useState(''),
    [word, setWord] = useState(''),
    [meaning, setMeaning] = useState(''),
    [recording, setRecording] = useState(false),
    [micPending, setMicPending] = useState(false),
    [voice, setVoice] = useState<{ blob: Blob; url: string } | null>(null),
    [recordingUrl, setRecordingUrl] = useState<string | null>(null),
    [archive, setArchive] = useState<LibraryItem | null>(null),
    [dirty, setDirty] = useState(false),
    [seconds, setSeconds] = useState(0),
    [topic, setTopic] = useState<'international-politics' | 'economy-finance'>(
      () =>
        practiceMaterials.find((entry) => entry.skill === initialSkill)
          ?.topic || 'international-politics',
    ),
    [catalog, setCatalog] = useState<CatalogItem[]>([]),
    [catalogChoice, setCatalogChoice] = useState(''),
    [catalogLoading, setCatalogLoading] = useState(false),
    [catalogStale, setCatalogStale] = useState(false),
    [usedResources, setUsedResources] = useState<string[]>([]),
    [speakingText, setSpeakingText] = useState(false),
    [previewWords, setPreviewWords] = useState<VocabularyEntry[]>([]),
    [vocabularyLoading, setVocabularyLoading] = useState(false);
  const operations = useRef<Record<string, { payload: string; id: string }>>(
    {},
  );
  const voiceOperation = useRef<{
    blob: Blob;
    title: string;
    id: string;
  } | null>(null);
  function operationId(key: string, payload: unknown) {
    const value = JSON.stringify(payload);
    if (operations.current[key]?.payload !== value)
      operations.current[key] = { payload: value, id: crypto.randomUUID() };
    return operations.current[key].id;
  }
  async function saveRequest<T>(path: string, data: Record<string, unknown>) {
    const result = await post<T>(path, {
      ...data,
      operationId: operationId(path, data),
    });
    delete operations.current[path];
    return result;
  }
  function materialRef(value: Material): ResourceRef {
    return (
      value.resourceRef ??
      (practiceMaterials.some((entry) => entry.id === value.id)
        ? { kind: 'builtin', id: value.id }
        : { kind: 'legacy', id: value.id })
    );
  }
  const alive = useRef(true),
    catalogRequest = useRef(0),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    start = useRef(0),
    recordStart = useRef(0),
    listeningStart = useRef(0),
    activity = useRef(onActivity),
    passage = useRef<HTMLDivElement>(null);
  const pending =
    dirty || busy || recording || micPending || !!voice || !!word || !!meaning;
  useEffect(() => {
    onDirty(pending);
    return () => onDirty(false);
  }, [pending, onDirty]);
  useEffect(() => {
    activity.current = onActivity;
  }, [onActivity]);
  useEffect(() => {
    alive.current = true;

    queueMicrotask(() => {
      try {
        const value = JSON.parse(localStorage.getItem(usedKey) || '[]');
        if (alive.current && Array.isArray(value))
          setUsedResources(value.filter((item) => typeof item === 'string'));
      } catch {}
    });

    void api<{ items: LibraryItem[] }>('/api/library/items')
      .then((r) => {
        if (alive.current)
          setSaved(
            r.items.filter((i) => ['articles', 'audio'].includes(i.kind)),
          );
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      catalogRequest.current += 1;
      window.speechSynthesis?.cancel();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const refreshCatalog = useCallback(
    async (force = false) => {
      const requestId = ++catalogRequest.current;
      if (!['listening', 'reading'].includes(material.skill)) {
        setCatalogLoading(false);
        return;
      }
      setCatalogLoading(true);
      try {
        const result = await api<{
          items: CatalogItem[];
          stale: boolean;
        }>(
          `/api/library/catalog?topic=${encodeURIComponent(topic)}${force ? '&refresh=1' : ''}`,
        );
        if (alive.current && requestId === catalogRequest.current) {
          setCatalog(result.items);
          setCatalogStale(result.stale);
        }
      } catch (error) {
        if (alive.current && requestId === catalogRequest.current)
          setMessage(
            error instanceof Error ? error.message : '资源目录读取失败',
          );
      } finally {
        if (alive.current && requestId === catalogRequest.current)
          setCatalogLoading(false);
      }
    },
    [material.skill, topic],
  );
  useEffect(() => {
    queueMicrotask(() => void refreshCatalog(false));
  }, [refreshCatalog]);
  useEffect(() => {
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setVocabularyLoading(true);
      void builtInVocabularyProvider
        .getVocabulary({
          text: material.body,
          topic: material.topic || topic,
          mode: material.skill === 'writing' ? 'writing' : 'preview',
          limit: material.skill === 'writing' ? 6 : 12,
        })
        .then((items) => current && setPreviewWords(items))
        .finally(() => current && setVocabularyLoading(false));
    });
    return () => {
      current = false;
    };
  }, [
    material.body,
    material.id,
    material.skill,
    material.source,
    material.title,
    material.topic,
    topic,
  ]);
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  useEffect(
    () => () => {
      if (voice) URL.revokeObjectURL(voice.url);
    },
    [voice],
  );
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const n = Math.floor((Date.now() - recordStart.current) / 1000);
      setSeconds(n);
      if (n >= 600 && recorder.current?.state === 'recording')
        recorder.current.stop();
    }, 500);
    return () => clearInterval(t);
  }, [recording]);
  function canSwitch() {
    if (busy || recording || micPending) {
      setMessage('请先结束当前操作。');
      return false;
    }
    return (
      !pending ||
      window.confirm(
        translate(locale, '切换材料会放弃未保存作答或录音，是否继续？'),
      )
    );
  }
  function load(m: Material) {
    handleListeningStop();
    window.speechSynthesis?.cancel();
    setSpeakingText(false);
    setMaterial(m);
    setAnswers([]);
    setChecked(false);
    setResponse('');
    setNotes('');
    setVoice(null);
    setRecordingUrl(null);
    setArchive(null);
    setAudioLinks([]);
    setDirty(false);
    setMessage('');
    setWord('');
    setMeaning('');
  }
  function switchSkill(skill: Skill) {
    if (!canSwitch()) return;
    const next =
      practiceMaterials.find((m) => m.skill === skill && m.topic === topic) ||
      practiceMaterials.find((m) => m.skill === skill)!;
    if (next.topic) setTopic(next.topic);
    load(next);
    setCatalogChoice(`built:${next.id}`);
  }
  async function importUrl(
    url: string,
    targetSkill: Skill = material.skill,
    suggestedTitle = '',
  ) {
    if (!canSwitch()) return;
    setBusy(true);
    setMessage('正在读取链接并保存到电脑…');
    try {
      const d = await saveRequest<{
        item: LibraryItem;
        content: string | null;
        audioLinks: string[];
        notice?: string;
      }>('/api/library/import-url', {
        url,
        skill: targetSkill,
        title: suggestedTitle,
      });
      const m: Material = {
        id: d.item.id,
        resourceRef: d.item.resourceRef ?? { kind: 'legacy', id: d.item.id },
        title: d.item.title,
        skill: d.item.kind === 'audio' ? 'listening' : targetSkill,
        source: d.item.source,
        label:
          targetSkill === 'listening'
            ? '公开文章 · 浏览器朗读 · 自主听力'
            : '从公开链接导入 · 自主练习 · 无自动出题',
        body: d.content || '请播放音频，在右侧记录听写、关键词和复盘。',
        questions: [],
        audioUrl:
          d.item.kind === 'audio'
            ? `/api/library/items/audio/${d.item.id}/file`
            : null,
      };
      load(m);
      activity.current({
        kind: 'article-opened',
        resourceId: d.item.source || d.item.id,
        resourceRef: d.item.resourceRef ?? { kind: 'legacy', id: d.item.id },
        label: d.item.title,
        seconds: 0,
      });
      setSaved((old) => [d.item, ...old]);
      setAudioLinks(d.audioLinks);
      setMessage(d.notice || '音频已保存，可以直接在这里播放。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '读取失败');
    } finally {
      setBusy(false);
    }
  }
  const builtInResources = useMemo(
    () =>
      practiceMaterials.filter(
        (entry) =>
          entry.skill === material.skill &&
          entry.topic === topic &&
          (!usedResources.includes(entry.id) || entry.id === material.id),
      ),
    [material.id, material.skill, topic, usedResources],
  );
  const onlineResources = useMemo(() => {
    if (!['listening', 'reading'].includes(material.skill)) return [];
    const savedSources = new Set(
      saved.map((item) => item.source).filter(Boolean),
    );
    return catalog.filter(
      (entry) =>
        entry.topic === topic &&
        !usedResources.includes(entry.url) &&
        !savedSources.has(entry.url),
    );
  }, [catalog, material.skill, saved, topic, usedResources]);
  async function openCatalogChoice() {
    if (!catalogChoice) return;
    const separator = catalogChoice.indexOf(':');
    const kind = catalogChoice.slice(0, separator),
      id = catalogChoice.slice(separator + 1);
    if (kind === 'built') {
      if (!canSwitch()) return;
      const next = practiceMaterials.find((entry) => entry.id === id);
      if (next) load(next);
      if (next)
        activity.current({
          kind: 'article-opened',
          resourceId: next.source || next.id,
          resourceRef: materialRef(next),
          label: next.title,
          seconds: 0,
        });
      return;
    }
    const entry = onlineResources.find((item) => item.id === id);
    if (entry) await importUrl(entry.url, material.skill, entry.title);
  }
  function handleListeningPlay() {
    if (!listeningStart.current) listeningStart.current = wallClock();
  }
  function handleListeningStop() {
    if (!listeningStart.current) return;
    const elapsed = Math.max(
      1,
      Math.round((wallClock() - listeningStart.current) / 1000),
    );
    listeningStart.current = 0;
    activity.current({
      kind: 'listening',
      resourceId: material.source || material.id,
      resourceRef: materialRef(material),
      label: material.title,
      seconds: elapsed,
    });
  }
  function toggleReading() {
    if (!('speechSynthesis' in window)) {
      setMessage('当前浏览器不支持文章朗读，请改用内置音频练习。');
      return;
    }
    if (speakingText) {
      window.speechSynthesis.cancel();
      setSpeakingText(false);
      handleListeningStop();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(material.body);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    utterance.onend = () => {
      handleListeningStop();
      if (alive.current) setSpeakingText(false);
    };
    utterance.onerror = () => {
      handleListeningStop();
      if (alive.current) setSpeakingText(false);
    };
    window.speechSynthesis.speak(utterance);
    handleListeningPlay();
    setSpeakingText(true);
  }
  async function attachAudio(url: string) {
    setBusy(true);
    try {
      const d = await saveRequest<{
        item: LibraryItem;
        content: string | null;
      }>('/api/library/import-url', {
        url,
        skill: 'listening',
        title: material.title.slice(0, 185) + ' · 配套音频',
      });
      if (d.item.kind !== 'audio')
        throw Error(
          '这个链接没有返回直接音频。正文已保存到资料库，请尝试其他音频链接。',
        );
      setMaterial((old) => ({
        ...old,
        skill: 'listening',
        audioUrl: `/api/library/items/audio/${d.item.id}/file`,
      }));
      setSaved((old) => [d.item, ...old]);
      setDirty(true);
      setMessage('配套音频已保存，当前文章与笔记仍保留，可直接播放。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '音频读取失败');
    } finally {
      setBusy(false);
    }
  }
  async function openSaved() {
    if (!savedId || !canSwitch()) return;
    setBusy(true);
    try {
      const item = saved.find((s) => s.id === savedId)!;
      const d = await api<{ content: string | null }>(
        `/api/library/items/${item.kind}/${item.id}`,
      );
      if (item.filename === 'practice.json' && d.content) {
        const attempt = JSON.parse(d.content);
        if (attempt.format !== 'ielts-practice' || !attempt.material)
          throw Error('此档案格式不能在练习中心打开');
        load(attempt.material);
        setAnswers(attempt.answers || []);
        setResponse(attempt.response || '');
        setNotes(attempt.notes || '');
        setRecordingUrl(attempt.recordingUrl || null);
        setMessage('已打开保存的练习档案，可继续练习并另存一次记录。');
      } else {
        if (item.mime === 'application/pdf')
          throw Error(
            'PDF 暂不支持正文提取，请使用文章链接、TXT 或 Markdown。',
          );
        load({
          id: item.id,
          resourceRef: item.resourceRef ?? { kind: 'legacy', id: item.id },
          title: item.title,
          skill: item.kind === 'audio' ? 'listening' : item.skill,
          label: '电脑资料库 · 自主练习',
          source: item.source,
          body: d.content || '请播放音频并在右侧记录听写和笔记。',
          questions: [],
          audioUrl:
            item.kind === 'audio'
              ? `/api/library/items/audio/${item.id}/file`
              : null,
        });
      }
      activity.current({
        kind: 'article-opened',
        resourceId: item.source || item.id,
        resourceRef: item.resourceRef ?? { kind: 'legacy', id: item.id },
        label: item.title,
        seconds: 0,
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '无法打开资料');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    start.current = Date.now();
  }, [material]);
  useEffect(() => {
    function selectWord() {
      if (busy) return;
      const selection = window.getSelection();
      if (
        selection?.anchorNode &&
        passage.current?.contains(selection.anchorNode)
      ) {
        const value = selection.toString().trim();
        if (value && value.length <= 120) setWord(value);
      }
    }
    document.addEventListener('selectionchange', selectWord);
    return () => document.removeEventListener('selectionchange', selectWord);
  }, [busy]);
  async function saveVocabulary(nextWord: string, nextMeaning: string) {
    if (!nextWord.trim()) return;
    setBusy(true);
    try {
      await saveRequest('/api/library/text', {
        kind: 'vocabulary',
        title: nextWord,
        meaning: nextMeaning.trim() || '待补充释义',
        example:
          material.body
            .split(/(?<=[.!?])\s+/)
            .find((s) => s.toLowerCase().includes(nextWord.toLowerCase()))
            ?.slice(0, 10000) || '',
        source: material.source,
        skill: material.skill,
      });
      activity.current({
        kind: 'word-saved',
        resourceId: nextWord.toLowerCase(),
        resourceRef: { kind: 'vocabulary', id: nextWord.toLowerCase() },
        label: nextWord,
        seconds: 0,
      });
      setMessage(`“${nextWord}”已存入单词库。`);
      setWord('');
      setMeaning('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '单词保存失败');
    } finally {
      setBusy(false);
    }
  }
  async function collectWord() {
    await saveVocabulary(word, meaning);
  }
  function pronounce(entry: VocabularyEntry) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(entry.word);
    utterance.lang = 'en-GB';
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
    activity.current({
      kind: 'word-viewed',
      resourceId: entry.word.toLowerCase(),
      resourceRef: { kind: 'vocabulary', id: entry.word.toLowerCase() },
      label: entry.word,
      seconds: 0,
    });
  }
  function markKnown(entry: VocabularyEntry, known: boolean) {
    activity.current({
      kind: known ? 'word-known' : 'word-unknown',
      resourceId: entry.word.toLowerCase(),
      resourceRef: { kind: 'vocabulary', id: entry.word.toLowerCase() },
      label: entry.word,
      seconds: 0,
    });
  }
  async function record() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMessage('浏览器不支持录音，可在资料库上传已有录音。');
      return;
    }
    setMicPending(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const mime = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      let size = 0;
      r.ondataavailable = (e) => {
        chunks.push(e.data);
        size += e.data.size;
        if (size > 90 * 1024 * 1024 && r.state === 'recording') r.stop();
      };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        stream.current = null;
        recorder.current = null;
        if (!alive.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        if (blob.size) {
          setVoice({ blob, url: URL.createObjectURL(blob) });
          setRecordingUrl(null);
          setDirty(true);
        } else setMessage('没有录到音频，请重试。');
      };
      r.onerror = () => {
        if (r.state === 'recording') r.stop();
        s.getTracks().forEach((t) => t.stop());
        if (alive.current) setMessage('录音中断，请试听已录制片段。');
      };
      recorder.current = r;
      r.start(1000);
      recordStart.current = Date.now();
      setSeconds(0);
      setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setMessage('无法开启麦克风，请检查浏览器权限或设备占用。');
    } finally {
      if (alive.current) setMicPending(false);
    }
  }
  async function savePractice() {
    setBusy(true);
    try {
      let recordingRef = recordingUrl;
      if (voice && !recordingRef) {
        const ext = voice.blob.type.includes('mp4')
          ? 'm4a'
          : voice.blob.type.includes('ogg')
            ? 'ogg'
            : 'webm';
        const params = new URLSearchParams({
          kind: 'recordings',
          title: material.title,
          name: 'practice.' + ext,
          skill: 'speaking',
        });
        if (
          voiceOperation.current?.blob !== voice.blob ||
          voiceOperation.current.title !== material.title
        )
          voiceOperation.current = {
            blob: voice.blob,
            title: material.title,
            id: crypto.randomUUID(),
          };
        params.set('operationId', voiceOperation.current.id);
        const result = await api<LibraryItem>('/api/library/upload?' + params, {
          method: 'POST',
          headers: { 'Content-Type': voice.blob.type },
          body: voice.blob,
        });
        recordingRef = `/api/library/items/recordings/${result.id}/file`;
        setRecordingUrl(recordingRef);
      }
      const result = await saveRequest<{ item: LibraryItem }>(
        '/api/library/practice',
        {
          material: { ...material, resourceRef: materialRef(material) },
          answers: material.questions.map((_, i) => answers[i] || ''),
          response,
          notes,
          recordingUrl: recordingRef,
        },
      );
      setArchive(result.item);
      setSaved((old) => [result.item, ...old]);
      if (voice && seconds > 0)
        activity.current({
          kind: 'recording',
          resourceId: result.item.id,
          resourceRef: result.item.resourceRef ?? {
            kind: 'legacy',
            id: result.item.id,
          },
          label: material.title,
          seconds,
        });
      setDirty(false);
      setVoice(null);
      voiceOperation.current = null;
      const used = Array.from(
        new Set([
          ...usedResources,
          material.id,
          ...(material.source ? [material.source] : []),
        ]),
      ).slice(-5000);
      setUsedResources(used);
      try {
        localStorage.setItem(usedKey, JSON.stringify(used));
      } catch {}
      const counted = onComplete(
        material.skill,
        Math.max(1, Math.ceil((wallClock() - start.current) / 60000)),
        `练习档案：${material.title}\n${notes}`.slice(0, 5000),
      );
      setMessage(
        counted
          ? '材料、作答、笔记和录音已保存，学习记录已更新。'
          : '练习档案已存入电脑；学习统计保存失败，请检查浏览器进度提示。',
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : '保存失败，作答仍保留在页面。',
      );
    } finally {
      setBusy(false);
    }
  }
  const words = response.trim() ? response.trim().split(/\s+/).length : 0,
    correct = material.questions.filter((q, i) =>
      answerMatches(answers[i] || '', q.answers),
    ).length;
  return (
    <fieldset
      className="practice-workspace"
      disabled={busy}
      aria-label="练习中心"
    >
      <div className="library-tabs">
        {skills.map((s) => (
          <button
            key={s.id}
            aria-pressed={material.skill === s.id}
            className={material.skill === s.id ? 'chosen' : ''}
            onClick={() => switchSkill(s.id)}
          >
            <s.icon size={18} />
            {translate(locale, `${s.name}练习`)}
          </button>
        ))}
      </div>
      <section className="practice-source">
        <div className="resource-browser">
          <label>
            推荐主题
            <select
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value as typeof topic);
                setCatalogChoice('');
              }}
            >
              <option value="international-politics">国际政治</option>
              <option value="economy-finance">经济金融</option>
            </select>
          </label>
          <label>
            更换练习资源
            <select
              value={catalogChoice}
              onChange={(event) => setCatalogChoice(event.target.value)}
            >
              <option value="">选择一份未练习的材料</option>
              {builtInResources.length > 0 && (
                <optgroup label={translate(locale, '原创练习')}>
                  {builtInResources.map((entry) => (
                    <option key={entry.id} value={`built:${entry.id}`}>
                      {entry.title}
                    </option>
                  ))}
                </optgroup>
              )}
              {onlineResources.length > 0 && (
                <optgroup label={translate(locale, '实时公开资源')}>
                  {onlineResources.map((entry) => (
                    <option key={entry.id} value={`online:${entry.id}`}>
                      {entry.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <Button
            disabled={!catalogChoice}
            onClick={() => void openCatalogChoice()}
          >
            在此练习
          </Button>
          {['listening', 'reading'].includes(material.skill) && (
            <Button
              variant="outline"
              disabled={catalogLoading}
              title="从允许使用的公开 API 更新本机缓存"
              onClick={() => void refreshCatalog(true)}
            >
              <RefreshCw size={16} className={catalogLoading ? 'spin' : ''} />
              {catalogLoading ? '查询中…' : '更新资源'}
            </Button>
          )}
        </div>
        <p className="resource-status">
          {catalogStale
            ? '当前显示缓存或内置资源；网络恢复后可以再次更新。'
            : '公开资源最多每 6 小时更新一次。完成并保存后，将不再出现在推荐列表。'}
        </p>
        <div className="saved-material-row">
          <label>
            打开电脑中保存的材料
            <select
              value={savedId}
              onChange={(e) => setSavedId(e.target.value)}
            >
              <option value="">选择资料或练习档案</option>
              {saved.map((s) => (
                <option data-user-content key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            disabled={busy || !savedId || recording || micPending}
            onClick={() => void openSaved()}
          >
            在此打开
          </Button>
          <Button
            variant="ghost"
            disabled={recording || micPending}
            onClick={onOpenImport}
          >
            <PackageOpen size={16} />
            导入新材料
          </Button>
        </div>
        <p>
          新的链接、文件、题库和电子书请前往导入中心；这里专注于选择材料并完成练习。
        </p>
      </section>
      {message && (
        <output className="notice" aria-live="polite">
          {message}
        </output>
      )}
      <div className="practice-grid">
        <section className="practice-passage">
          <h2 data-user-content>{material.title}</h2>
          <p className="practice-label">{material.label}</p>
          {material.skill !== 'speaking' && (
            <details className="vocabulary-preview">
              <summary>
                <span>
                  {material.skill === 'writing'
                    ? '本题建议词汇'
                    : '课前词汇预习'}
                </span>
                <small>
                  {vocabularyLoading
                    ? '正在分析…'
                    : locale === 'ja'
                      ? `${previewWords.length}語の重要語 · 初期状態では折りたたみ`
                      : locale === 'en'
                        ? `${previewWords.length} key words · collapsed by default`
                        : locale === 'zh-TW'
                          ? `${previewWords.length} 個重點詞 · 預設摺疊`
                          : `${previewWords.length} 个重点词 · 默认折叠`}
                </small>
              </summary>
              {previewWords.length ? (
                <div className="vocabulary-preview-grid">
                  {previewWords.map((entry) => {
                    const known = knownWords.includes(entry.word.toLowerCase()),
                      used = new RegExp(
                        `\\b${entry.word}(?:s|es)?\\b`,
                        'i',
                      ).test(response);
                    return (
                      <article
                        key={entry.word}
                        className={known ? 'known' : ''}
                      >
                        <div>
                          <button
                            className="word-sound"
                            aria-label={
                              locale === 'ja'
                                ? `${entry.word}を読み上げる`
                                : locale === 'en'
                                  ? `Pronounce ${entry.word}`
                                  : locale === 'zh-TW'
                                    ? `朗讀 ${entry.word}`
                                    : `朗读 ${entry.word}`
                            }
                            onClick={() => pronounce(entry)}
                          >
                            <Volume2 size={15} />
                            <b>{entry.word}</b>
                          </button>
                          <span>
                            {entry.ipa} · {entry.level}
                          </span>
                        </div>
                        <p>{entry.meanings[locale] || entry.definition}</p>
                        {material.skill === 'writing' && (
                          <em className={used ? 'used' : ''}>
                            {used ? '已写入回答' : '建议在回答中使用'}
                          </em>
                        )}
                        <footer>
                          <button
                            onClick={() =>
                              void saveVocabulary(
                                entry.word,
                                entry.meanings[locale] || entry.definition,
                              )
                            }
                          >
                            收藏
                          </button>
                          <button onClick={() => markKnown(entry, !known)}>
                            {known ? '还不熟悉' : '我认识'}
                          </button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="vocabulary-empty">
                  当前材料没有匹配到内置重点词；仍可在正文中选词收藏。
                </p>
              )}
            </details>
          )}
          {material.audioUrl && (
            <audio
              key={material.audioUrl}
              controls
              preload="metadata"
              src={material.audioUrl}
              aria-label={material.title}
              onPlay={handleListeningPlay}
              onPause={handleListeningStop}
              onEnded={handleListeningStop}
              onError={() =>
                setMessage('音频无法播放，请确认本地服务和文件可用。')
              }
            />
          )}
          {material.skill === 'listening' && !material.audioUrl && (
            <Button
              variant="outline"
              className="speech-player"
              onClick={toggleReading}
            >
              {speakingText ? <VolumeX size={17} /> : <Volume2 size={17} />}
              {speakingText ? '停止朗读' : '播放英文朗读'}
            </Button>
          )}
          <div ref={passage}>
            {material.skill === 'listening' && material.audioUrl ? (
              <details>
                <summary>显示听力原文</summary>
                <div className="practice-text">{material.body}</div>
              </details>
            ) : (
              <div className="practice-text">{material.body}</div>
            )}
          </div>
          {audioLinks.length > 0 && (
            <div className="page-audio">
              <h3>页面中找到的音频</h3>
              {audioLinks.map((url, i) => (
                <button
                  disabled={busy}
                  key={url}
                  onClick={() => void attachAudio(url)}
                >
                  读取并保存音频 {i + 1}
                </button>
              ))}
            </div>
          )}
          {material.source && (
            <p className="practice-citation">原始来源：{material.source}</p>
          )}
          <div className="collect-word">
            <h3>把新表达留在单词库</h3>
            <p>选中原文中的词语，或直接输入；例句会尽量取自当前材料。</p>
            <label>
              单词 / 短语
              <input
                maxLength={120}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="选中原文后自动填入"
              />
            </label>
            <label>
              释义（可稍后补充）
              <input
                maxLength={5000}
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="例如：把……考虑在内"
              />
            </label>
            <Button
              variant="outline"
              disabled={busy || recording || micPending || !word.trim()}
              onClick={() => void collectWord()}
            >
              收藏单词
            </Button>
          </div>
        </section>
        <section className="practice-answer">
          <h2>
            {material.questions.length
              ? '边练边检查'
              : material.skill === 'writing'
                ? '写下你的回答'
                : material.skill === 'speaking'
                  ? '开口练习'
                  : '记录这次练习'}
          </h2>
          {material.questions.map((q, i) => (
            <div key={material.id + '-' + i} className="practice-question">
              <label>
                {i + 1}. {q.prompt}
                {q.options ? (
                  <select
                    value={answers[i] || ''}
                    onChange={(e) => {
                      setAnswers((old) => {
                        const next = [...old];
                        next[i] = e.target.value;
                        return next;
                      });
                      setDirty(true);
                      setChecked(false);
                    }}
                  >
                    <option value="">{translate(locale, '选择答案')}</option>
                    {q.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={answers[i] || ''}
                    maxLength={5000}
                    onChange={(e) => {
                      setAnswers((old) => {
                        const next = [...old];
                        next[i] = e.target.value;
                        return next;
                      });
                      setDirty(true);
                      setChecked(false);
                    }}
                  />
                )}
              </label>
              {checked && (
                <p
                  className={
                    answerMatches(answers[i] || '', q.answers)
                      ? 'answer-correct'
                      : 'answer-review'
                  }
                >
                  {answerMatches(answers[i] || '', q.answers)
                    ? '回答正确'
                    : '参考答案：' + q.answers[0]}{' '}
                  · {q.explanation}
                </p>
              )}
            </div>
          ))}
          {material.questions.length > 0 && (
            <>
              <Button
                variant="outline"
                disabled={material.questions.some(
                  (_, i) => !answers[i]?.trim(),
                )}
                onClick={() => setChecked(true)}
              >
                <Check size={16} />
                检查答案
              </Button>
              {checked && (
                <p className="practice-score">
                  答对 {correct} / {material.questions.length} 题 ·
                  不换算为雅思分数
                </p>
              )}
            </>
          )}
          {material.skill === 'speaking' && (
            <div className="practice-voice">
              <p>在题目旁直接录音。单段最长 10 分钟，录音会随练习一起保存。</p>
              {recording ? (
                <>
                  <output>
                    正在录音 {Math.floor(seconds / 60)}:
                    {String(seconds % 60).padStart(2, '0')}
                  </output>
                  <Button onClick={() => recorder.current?.stop()}>
                    <Square size={16} />
                    停止并试听
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || micPending || !!voice}
                  onClick={() => void record()}
                >
                  <Mic size={16} />
                  {micPending ? '等待麦克风权限…' : '开始录音'}
                </Button>
              )}
              {(voice || recordingUrl) && (
                <audio
                  controls
                  src={voice?.url || recordingUrl!}
                  aria-label="本次口语录音"
                />
              )}
              {voice && (
                <a
                  href={voice.url}
                  download={`speaking.${voice.blob.type.includes('mp4') ? 'm4a' : voice.blob.type.includes('ogg') ? 'ogg' : 'webm'}`}
                >
                  下载录音副本
                </a>
              )}
            </div>
          )}
          {!material.questions.length && (
            <label className="practice-response">
              {material.skill === 'writing'
                ? `作文 · ${words} 词`
                : material.skill === 'speaking'
                  ? '回答要点 / 自己的转写'
                  : '听写 / 阅读摘录'}
              <textarea
                rows={material.skill === 'writing' ? 14 : 7}
                maxLength={50000}
                value={response}
                onChange={(e) => {
                  setResponse(e.target.value);
                  setDirty(true);
                }}
                placeholder={
                  material.skill === 'writing'
                    ? '直接在这里写作，保存时会连同题目一起存档。'
                    : '在这里记录要点、听写或摘录。'
                }
              />
            </label>
          )}
          {material.skill === 'writing' && (
            <div className="writing-review">
              <h3>写完后自查</h3>
              <p>
                是否回应两个观点并表达自己的立场？每段是否围绕一个主题？例子是否支持论点？检查时态、冠词和句子边界。
              </p>
              <span>此处不提供 AI 批改或官方分数。</span>
            </div>
          )}
          <label className="practice-response">
            复盘笔记
            <textarea
              rows={4}
              maxLength={20000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="这次的错题原因、关键表达、下次要改进的地方…"
            />
          </label>
          <Button
            className="save-practice"
            disabled={
              busy || recording || micPending || (!!archive && !dirty && !voice)
            }
            onClick={() => void savePractice()}
          >
            <Download size={17} />
            {busy
              ? '处理中…'
              : archive && !dirty && !voice
                ? '本次练习已保存'
                : '保存练习与材料'}
          </Button>
          {archive && (
            <a
              className="practice-archive"
              href={`/api/library/items/articles/${archive.id}/file?download=1`}
            >
              下载这次练习档案
            </a>
          )}
        </section>
      </div>
    </fieldset>
  );
}
