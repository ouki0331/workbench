'use client';
/* oxlint-disable jsx-a11y/media-has-caption -- These are user-provided audio files and microphone recordings with no transcript. Do not invent captions. */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  BookOpen,
  Headphones,
  Mic,
  Download,
  Upload,
  Square,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActivityInput, Progress, ResourceRef } from '@/lib/progress';
import { translate, type Locale } from '@/lib/i18n';
type Kind = 'articles' | 'vocabulary' | 'audio' | 'recordings';
type Item = {
  id: string;
  resourceRef?: ResourceRef;
  kind: Kind;
  title: string;
  source: string;
  skill: string;
  createdAt: string;
  filename: string;
  mime: string;
  size: number;
  summary?: string;
  repairRequired?: boolean;
  updatedAt?: string;
  revision?: number;
  durationSeconds?: number | null;
  durationSource?: string | null;
  durationUpdatedAt?: string | null;
  titleSource?: string | null;
  metadataExtractStatus?: string | null;
  metadataExtractedAt?: string | null;
  metadataExtractError?: string | null;
  editableContent?: boolean;
  canExtract?: boolean;
};
type Tag = {
  id: string;
  groupId?: string;
  key: string;
  nameEn: string;
  nameJa: string;
  nameZhCn: string;
  nameZhTw: string;
  isActive: number;
  customColorToken?: string | null;
};
type Organization = {
  revision: number;
  remark: string;
  remarkUpdatedAt?: string | null;
  notes: Array<{
    id: string;
    title: string;
    bodyMarkdown: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>;
  groups: Array<{
    id: string;
    key: string;
    selectionMode: 'single' | 'multi';
    colorToken: string;
    tags: Tag[];
  }>;
  assignedTagIds: string[];
  places: Array<{
    id: string;
    kind: string;
    parentId?: string | null;
    code: string;
    isoAlpha2?: string | null;
    nameEn: string;
    nameJa: string;
    nameZhCn: string;
    nameZhTw: string;
  }>;
  assignedPlaceIds: string[];
  suggestions: Array<{
    tagId: string;
    groupId: string;
    evidence: string;
    confidence: number;
    acceptedAt?: string | null;
    nameEn: string;
    nameJa: string;
    nameZhCn: string;
    nameZhTw: string;
  }>;
};
type OrganizationDraft = {
  revision: number;
  remark: string;
  notes: Organization['notes'];
  tagIds: string[];
  placeIds: string[];
  customTags: Array<{ name: string; color: string }>;
};
type Detail = {
  item: Item;
  content: string | null;
  organization?: Organization;
};
type EditDraft = {
  title: string;
  summary: string;
  source: string;
  kind: Kind;
  skill: string;
  durationSeconds: string;
  content?: string;
};
const categories = [
  { id: 'articles' as const, name: '文章', icon: BookOpen },
  { id: 'vocabulary' as const, name: '单词', icon: BookOpen },
  { id: 'audio' as const, name: '练习音频', icon: Headphones },
  { id: 'recordings' as const, name: '我的录音', icon: Mic },
];
const maxFile = 90 * 1024 * 1024;
function sizeLabel(n: number) {
  return n < 1024 * 1024
    ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '尚未记录';
}
function sourceLabel(value?: string | null) {
  return (
    {
      manual: '手工填写',
      filename: '文件名',
      embedded: '文件内嵌信息',
      automatic: '自动提取',
    }[value || ''] || '未记录'
  );
}
function editDraft(detail: Detail): EditDraft {
  return {
    title: detail.item.title,
    summary: detail.item.summary || '',
    source: detail.item.source || '',
    kind: detail.item.kind,
    skill: detail.item.skill,
    durationSeconds:
      detail.item.durationSeconds === null ||
      detail.item.durationSeconds === undefined
        ? ''
        : String(detail.item.durationSeconds),
    ...(detail.item.editableContent ? { content: detail.content || '' } : {}),
  };
}
function organizationDraft(value: Organization): OrganizationDraft {
  return {
    revision: value.revision,
    remark: value.remark,
    notes: value.notes,
    tagIds: value.assignedTagIds,
    placeIds: value.assignedPlaceIds,
    customTags: [],
  };
}
function localizedName(
  value: Pick<Tag, 'nameEn' | 'nameJa' | 'nameZhCn' | 'nameZhTw'>,
  locale: Locale,
) {
  return locale === 'ja'
    ? value.nameJa
    : locale === 'zh-TW'
      ? value.nameZhTw
      : locale === 'en'
        ? value.nameEn
        : value.nameZhCn;
}
function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) return <p className="empty">暂无内容</p>;
  return (
    <div className="markdown-preview" data-user-content>
      {value.split(/\r?\n/).map((line, index) => {
        if (line.startsWith('### ')) return <h6 key={index}>{line.slice(4)}</h6>;
        if (line.startsWith('## ')) return <h5 key={index}>{line.slice(3)}</h5>;
        if (line.startsWith('# ')) return <h4 key={index}>{line.slice(2)}</h4>;
        if (/^[-*] /.test(line)) return <p key={index}>• {line.slice(2)}</p>;
        return <p key={index}>{line || '\u00a0'}</p>;
      })}
    </div>
  );
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-IELTS-Local', '1');
  const res = await fetch(url, { ...options, headers });
  let value;
  try {
    value = await res.json();
  } catch {
    throw Error('本地资料服务未启动，请运行 npm run start:local 后重试。');
  }
  if (!res.ok)
    throw Error((value as { error?: string }).error || '操作失败，请重试');
  return value as T;
}
export default function StudyLibrary({
  locale,
  progress,
  onDirty,
  onActivity,
  initialItem,
}: {
  locale: Locale;
  progress: Progress | null;
  onDirty: (dirty: boolean) => void;
  onActivity: (event: ActivityInput) => boolean;
  initialItem: { id: string; kind: Kind; token: number } | null;
}) {
  const [kind, setKind] = useState<Kind>('articles'),
    [items, setItems] = useState<Item[]>([]),
    [directory, setDirectory] = useState(''),
    [online, setOnline] = useState(false),
    [sqliteMode, setSqliteMode] = useState(false),
    [cloudMode, setCloudMode] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [title, setTitle] = useState(''),
    [content, setContent] = useState(''),
    [meaning, setMeaning] = useState(''),
    [example, setExample] = useState(''),
    [source, setSource] = useState(''),
    [skill, setSkill] = useState('reading'),
    [search, setSearch] = useState(''),
    [detail, setDetail] = useState<Detail | null>(null),
    [edit, setEdit] = useState<EditDraft | null>(null),
    [editInitial, setEditInitial] = useState(''),
    [organization, setOrganization] = useState<OrganizationDraft | null>(null),
    [organizationInitial, setOrganizationInitial] = useState(''),
    [organizationBusy, setOrganizationBusy] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [detailBusy, setDetailBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [requestingMic, setRequestingMic] = useState(false),
    [seconds, setSeconds] = useState(0),
    [recorded, setRecorded] = useState<{ blob: Blob; url: string } | null>(
      null,
    ),
    [backup, setBackup] = useState<{
      downloadUrl: string;
      path: string;
    } | null>(null);
  const fileOperation = useRef<{
    file: Blob;
    payload: string;
    id: string;
  } | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    file: Blob;
    name: string;
    isRecording: boolean;
  } | null>(null);
  const textOperation = useRef<{ payload: string; id: string } | null>(null),
    editOperation = useRef<{ payload: string; id: string } | null>(null),
    savingText = useRef(false),
    upload = useRef<HTMLInputElement>(null),
    recorder = useRef<MediaRecorder | null>(null),
    micStream = useRef<MediaStream | null>(null),
    alive = useRef(true),
    detailRequest = useRef<AbortController | null>(null),
    started = useRef(0);
  const editDirty = !!edit && JSON.stringify(edit) !== editInitial;
  const organizationDirty =
    !!organization && JSON.stringify(organization) !== organizationInitial;
  const dirty =
    busy ||
    editBusy ||
    recording ||
    requestingMic ||
    !!recorded ||
    !!pendingUpload ||
    !!title ||
    !!content ||
    !!meaning ||
    !!example ||
    !!source ||
    editDirty ||
    organizationDirty;
  function showDetail(result: Detail) {
    const draft = editDraft(result);
    setDetail(result);
    setEdit(draft);
    setEditInitial(JSON.stringify(draft));
    if (result.organization) {
      const nextOrganization = organizationDraft(result.organization);
      setOrganization(nextOrganization);
      setOrganizationInitial(JSON.stringify(nextOrganization));
    } else {
      setOrganization(null);
      setOrganizationInitial('');
    }
    editOperation.current = null;
  }
  async function openItem(item: Item) {
    if (editBusy) {
      setMessage('请先等待当前资料操作完成。');
      return;
    }
    if (
      (editDirty || organizationDirty) &&
      !window.confirm(translate(locale, '放弃尚未保存的资料修改？'))
    )
      return;
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetail(null);
    setDetailBusy(true);
    try {
      const result = await request<Detail>(
        `/api/library/items/${item.kind}/${item.id}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        showDetail(result);
        if (item.kind === 'vocabulary')
          onActivity({
            kind: 'word-viewed',
            resourceId: item.title.toLowerCase(),
            resourceRef: { kind: 'vocabulary', id: item.title.toLowerCase() },
            label: item.title,
            seconds: 0,
          });
        if (item.kind === 'articles')
          onActivity({
            kind: 'article-opened',
            resourceId: item.source || item.id,
            resourceRef: item.resourceRef ?? { kind: 'legacy', id: item.id },
            label: item.title,
            seconds: 0,
          });
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setMessage(e instanceof Error ? e.message : '无法打开资料');
    } finally {
      if (!controller.signal.aborted) setDetailBusy(false);
    }
  }
  async function refresh() {
    setLoading(true);
    try {
      const status = await request<{
        available: boolean;
        directory: string;
        mode?: string;
      }>('/api/library/status');
      if (!status.available) throw Error('本地资料服务不可用');
      const response = await request<{ items: Item[]; warnings: string[] }>(
        '/api/library/items',
      );
      setDirectory(status.directory);
      setSqliteMode(status.mode === 'sqlite');
      setCloudMode(status.mode === 'cloud');
      setItems(response.items);
      if (initialItem) {
        const target = response.items.find(
          (item) =>
            item.id === initialItem.id && item.kind === initialItem.kind,
        );
        if (target) {
          setKind(target.kind);
          setSearch('');
          void openItem(target);
        }
      }
      setOnline(true);
      if (response.warnings.length)
        setMessage(
          `有 ${response.warnings.length} 份资料无法读取，原文件仍保留在资料目录中。`,
        );
    } catch (e) {
      setOnline(false);
      setMessage(e instanceof Error ? e.message : '本地服务连接失败');
    } finally {
      setLoading(false);
    }
  }
  const refreshOnMount = useEffectEvent(refresh);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) void refreshOnMount();
    });
    return () => {
      alive.current = false;
      detailRequest.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      micStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useEffect(
    () => () => {
      if (recorded) URL.revokeObjectURL(recorded.url);
    },
    [recorded],
  );
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 600 && recorder.current?.state === 'recording') {
        recorder.current.stop();
        setMessage('已达到单次 10 分钟上限，请保存本段后继续录制。');
      }
    }, 500);
    return () => clearInterval(id);
  }, [recording]);
  function clearDraft() {
    textOperation.current = null;
    fileOperation.current = null;
    setPendingUpload(null);
    setTitle('');
    setContent('');
    setMeaning('');
    setExample('');
    setSource('');
  }
  function changeKind(next: Kind) {
    if (next === kind) return;
    if (recording || requestingMic || busy || editBusy || organizationBusy) {
      setMessage('请先完成当前操作再切换分类。');
      return;
    }
    if (
      dirty &&
      !window.confirm(
        translate(locale, '切换分类会放弃当前未保存内容，是否继续？'),
      )
    )
      return;
    clearDraft();
    setRecorded(null);
    setKind(next);
    setSkill(
      next === 'audio'
        ? 'listening'
        : next === 'recordings'
          ? 'speaking'
          : 'reading',
    );
    setDetail(null);
    setEdit(null);
    setEditInitial('');
    setOrganization(null);
    setOrganizationInitial('');
    detailRequest.current?.abort();
    setDetailBusy(false);
    setMessage('');
  }
  async function saveText() {
    if (savingText.current) return;
    savingText.current = true;
    const payload = JSON.stringify({
      kind,
      title,
      content,
      meaning,
      example,
      source,
      skill,
    });
    if (textOperation.current?.payload !== payload)
      textOperation.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const item = await request<Item>('/api/library/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...JSON.parse(payload),
          operationId: textOperation.current.id,
        }),
      });
      setItems((old) => [item, ...old.filter((entry) => entry.id !== item.id)]);
      if (kind === 'vocabulary')
        onActivity({
          kind: 'word-saved',
          resourceId: title.trim().toLowerCase(),
          resourceRef: { kind: 'vocabulary', id: title.trim().toLowerCase() },
          label: title.trim(),
          seconds: 0,
        });
      clearDraft();
      setMessage(cloudMode ? '已保存到云端资料库。' : '已保存到电脑资料目录。');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : '保存失败，内容仍保留在表单中。',
      );
    } finally {
      savingText.current = false;
      setBusy(false);
    }
  }
  async function saveFile(file: Blob, name: string, isRecording = false) {
    if (!file.size || file.size > maxFile) {
      setMessage('请选择非空文件，单个文件最大 90 MiB。');
      return;
    }
    if (busy) return;
    setPendingUpload({ file, name, isRecording });
    setBusy(true);
    try {
      const params = new URLSearchParams({
        kind: isRecording ? 'recordings' : kind,
        title: title.trim() || name,
        name,
        source,
        skill: isRecording ? 'speaking' : skill,
      });
      const payload = params.toString();
      if (
        fileOperation.current?.file !== file ||
        fileOperation.current?.payload !== payload
      )
        fileOperation.current = { file, payload, id: crypto.randomUUID() };
      params.set('operationId', fileOperation.current.id);
      const item = await request<Item>('/api/library/upload?' + params, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      setItems((old) => [item, ...old.filter((entry) => entry.id !== item.id)]);
      if (isRecording && seconds > 0)
        onActivity({
          kind: 'recording',
          resourceId: item.id,
          resourceRef: item.resourceRef ?? { kind: 'legacy', id: item.id },
          label: item.title,
          seconds,
        });
      clearDraft();
      if (isRecording) setRecorded(null);
      setMessage('文件已保存到电脑，可以在资料列表里打开。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
      if (upload.current) upload.current.value = '';
    }
  }
  async function startRecording() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMessage(
        '此浏览器不支持录音。请使用支持录音的浏览器打开 localhost，或上传已有录音。',
      );
      return;
    }
    setRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStream.current = stream;
      const type = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(
        stream,
        type ? { mimeType: type } : undefined,
      );
      const chunks: BlobPart[] = [];
      let bytes = 0;
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > 90 * 1024 * 1024 && r.state === 'recording') r.stop();
        }
      };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        micStream.current = null;
        recorder.current = null;
        if (!alive.current) return;
        const blob = new Blob(chunks, {
          type: r.mimeType || type || 'audio/webm',
        });
        setRecording(false);
        if (blob.size) setRecorded({ blob, url: URL.createObjectURL(blob) });
        else setMessage('没有录到音频，请检查麦克风后重试。');
      };
      r.onerror = () => {
        setMessage('录音中断，请检查并保存已录制的片段。');
        if (r.state === 'recording') r.stop();
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.current = r;
      r.start(1000);
      started.current = Date.now();
      setSeconds(0);
      setRecording(true);
      setMessage('正在录音，停止后可试听并保存。');
    } catch (e) {
      micStream.current?.getTracks().forEach((t) => t.stop());
      micStream.current = null;
      setMessage(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? '麦克风权限未开启。请在浏览器中允许麦克风，或上传已有录音。'
          : '无法启动麦克风，请检查设备是否被占用。',
      );
    } finally {
      if (alive.current) setRequestingMic(false);
    }
  }
  function recordingName() {
    const ext = recorded?.blob.type.includes('mp4')
      ? 'm4a'
      : recorded?.blob.type.includes('ogg')
        ? 'ogg'
        : 'webm';
    return `口语练习-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }
  async function makeBackup() {
    setBusy(true);
    setMessage('正在打包资料与当前学习进度，请稍候…');
    try {
      const result = await request<{ downloadUrl: string; path: string }>(
        '/api/library/backup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress }),
        },
      );
      setBackup(result);
      setMessage('备份已写入电脑的 backups 目录，可下载副本用于迁移。');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '备份失败，原资料不受影响。');
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit() {
    if (!detail || !edit || editBusy) return;
    const duration =
      edit.durationSeconds.trim() === ''
        ? null
        : Number(edit.durationSeconds.trim());
    if (duration !== null && (!Number.isFinite(duration) || duration < 0)) {
      setMessage('音频时长请输入大于或等于 0 的秒数，未知时可留空。');
      return;
    }
    const payload = JSON.stringify({
      revision: detail.item.revision,
      title: edit.title,
      summary: edit.summary,
      source: edit.source,
      kind: edit.kind,
      skill: edit.skill,
      durationSeconds: duration,
      ...(detail.item.editableContent ? { content: edit.content } : {}),
    });
    if (editOperation.current?.payload !== payload)
      editOperation.current = { payload, id: crypto.randomUUID() };
    setEditBusy(true);
    try {
      const result = await request<Detail>(
        `/api/library/items/${detail.item.kind}/${detail.item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...JSON.parse(payload),
            operationId: editOperation.current.id,
          }),
        },
      );
      setItems((old) =>
        old.map((entry) => (entry.id === result.item.id ? result.item : entry)),
      );
      setKind(result.item.kind);
      showDetail(result);
      setMessage('资料修改已保存，重新打开后仍会保留。');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : '保存失败，修改内容仍保留在表单中。',
      );
    } finally {
      setEditBusy(false);
    }
  }
  async function extractDetail() {
    if (!detail || editBusy) return;
    setEditBusy(true);
    try {
      const result = await request<Detail>(
        `/api/library/items/${detail.item.kind}/${detail.item.id}/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      setItems((old) =>
        old.map((entry) => (entry.id === result.item.id ? result.item : entry)),
      );
      showDetail(result);
      setMessage(
        result.item.metadataExtractStatus === 'failed'
          ? result.item.metadataExtractError ||
              '没有读到元数据，可继续手工填写。'
          : '已重新读取文件元数据；手工修改过的值保持不变。',
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : '重新提取失败，现有资料没有改变。',
      );
    } finally {
      setEditBusy(false);
    }
  }
  async function saveOrganization() {
    if (!detail || !organization || organizationBusy) return;
    setOrganizationBusy(true);
    try {
      const result = await request<{
        item: Item;
        organization: Organization;
      }>(
        `/api/library/items/${detail.item.kind}/${detail.item.id}/organization`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...organization,
            customTags: organization.customTags.filter((tag) =>
              tag.name.trim(),
            ),
          }),
        },
      );
      const next = organizationDraft(result.organization);
      setDetail({ ...detail, item: result.item, organization: result.organization });
      setOrganization(next);
      setOrganizationInitial(JSON.stringify(next));
      setItems((old) =>
        old.map((entry) => (entry.id === result.item.id ? result.item : entry)),
      );
      setMessage('备注、笔记和分类已保存。');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : '整理内容保存失败，当前输入仍保留。',
      );
    } finally {
      setOrganizationBusy(false);
    }
  }
  async function refreshSuggestions() {
    if (!detail || !detail.organization || organizationBusy) return;
    setOrganizationBusy(true);
    try {
      const result = await request<{
        suggestions: Organization['suggestions'];
      }>(
        `/api/library/items/${detail.item.kind}/${detail.item.id}/organization/suggestions`,
        { method: 'POST', body: '{}' },
      );
      setDetail({
        ...detail,
        organization: { ...detail.organization, suggestions: result.suggestions },
      });
      setMessage(
        result.suggestions.length
          ? '已根据现有资料字段生成建议；确认并保存后才会采用。'
          : '现有字段没有足够依据，未生成标签建议。',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '无法生成标签建议。');
    } finally {
      setOrganizationBusy(false);
    }
  }
  function toggleTag(group: Organization['groups'][number], tagId: string) {
    if (!organization) return;
    const selected = organization.tagIds.includes(tagId);
    const groupIds = new Set(group.tags.map((tag) => tag.id));
    setOrganization({
      ...organization,
      tagIds: selected
        ? organization.tagIds.filter((id) => id !== tagId)
        : group.selectionMode === 'single'
          ? [...organization.tagIds.filter((id) => !groupIds.has(id)), tagId]
          : [...organization.tagIds, tagId],
    });
  }
  const filtered = items.filter(
    (i) =>
      i.kind === kind &&
      `${i.title} ${i.summary || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  let word: { word: string; meaning: string; example: string } | null = null;
  if (detail?.item.kind === 'vocabulary' && detail.content) {
    try {
      word = JSON.parse(detail.content);
    } catch {
      /* Original remains downloadable. */
    }
  }
  const wordStatus = word
    ? progress?.activities.find(
        (event) =>
          event.resourceId.toLowerCase() === word.word.toLowerCase() &&
          (event.kind === 'word-known' || event.kind === 'word-unknown'),
      )
    : null;
  const wordKnown = wordStatus?.kind === 'word-known';
  return (
    <div className="library">
      <section className="library-location">
        <div>
          <h2>
            <FolderOpen size={20} />
            {cloudMode ? '我的云端资料库' : '我的电脑资料库'}
          </h2>
          <p>{directory || '正在连接资料库…'}</p>
          <span>
            {cloudMode
              ? '文本资料保存在私有云端存储，可在已授权设备重新打开。'
              : sqliteMode
              ? '文章、单词、音频与录音保存在当前资料目录；可打包备份并迁移。'
              : '原文和音频实际保存为文件；备份可整体迁移到其他存储位置。'}
          </span>
        </div>
        <div className="library-actions">
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} />
            重新连接
          </Button>
          {!cloudMode && (
            <Button
              disabled={!online || busy || recording || requestingMic}
              onClick={() => void makeBackup()}
            >
              <Download size={16} />
              {busy ? '处理中…' : '打包备份'}
            </Button>
          )}
        </div>
      </section>
      {message && (
        <output className="notice" aria-live="polite">
          {message}
        </output>
      )}
      {!online && !loading && (
        <div className="library-offline">
          <p>需要本地服务才能把资料写入电脑。请在项目目录运行：</p>
          <code>npm run start:local</code>
          <p>
            打开 http://localhost:3012 后再试。仅部署静态网页时，此功能不可用。
          </p>
        </div>
      )}
      {progress &&
        [...progress.activities, ...progress.reviews.cards].some(
          (entry) => !entry.resourceRef || entry.resourceRef.kind === 'legacy',
        ) && (
          <p className="library-help">
            部分旧学习记录的来源尚未确认，记录会保留在备份中。
            {sqliteMode && '来源可解析性见备份清单。'}
          </p>
        )}
      {backup && (
        <div className="library-backup">
          <a href={backup.downloadUrl} download>
            下载最新资料备份 ZIP <Download size={15} />
          </a>
          <span>{backup.path}</span>
          <p>
            包含全部已保存资料和本次学习进度快照；表单中未保存的内容不在备份内。恢复资料目录后，还需在「目标与备份」中导入包内的学习进度
            JSON。
          </p>
        </div>
      )}
      <div className="library-tabs" aria-label="资料分类">
        {categories.map((c) => (
          <button
            key={c.id}
            aria-pressed={kind === c.id}
            className={kind === c.id ? 'chosen' : ''}
            onClick={() => changeKind(c.id)}
          >
            <c.icon size={17} />
            {c.name}
            <span>{items.filter((i) => i.kind === c.id).length}</span>
          </button>
        ))}
      </div>
      <div className="library-grid">
        <section className="library-editor">
          <h2>
            {kind === 'articles'
              ? '保存练习文章'
              : kind === 'vocabulary'
                ? '收下一个新单词'
                : kind === 'audio'
                  ? '保存练习音频'
                  : '留下自己的声音'}
          </h2>
          <fieldset disabled={!online || busy || recording || requestingMic}>
            <label>
              {kind === 'vocabulary' ? '单词 / 短语' : '标题'}
              <input
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  kind === 'vocabulary'
                    ? '例如：take into account'
                    : '例如：城市交通 · 第一次练习'
                }
              />
            </label>
            <div className="form-row">
              <label>
                关联科目
                <select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                >
                  <option value="listening">听力</option>
                  <option value="reading">阅读</option>
                  <option value="writing">写作</option>
                  <option value="speaking">口语</option>
                </select>
              </label>
              <label>
                来源链接（选填）
                <input
                  type="url"
                  maxLength={2000}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
            {kind === 'articles' && (
              <>
                <label>
                  文章原文
                  <textarea
                    rows={8}
                    maxLength={1000000}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="把练习过的文章粘贴到这里。保存后可再次打开阅读。"
                  />
                </label>
                <Button
                  disabled={!title.trim() || !content.trim()}
                  onClick={() => void saveText()}
                >
                  保存文章
                </Button>
                <p className="library-help">
                  也可以上传 TXT、Markdown 或 PDF，保留原文件。
                </p>
              </>
            )}
            {kind === 'vocabulary' && (
              <>
                <label>
                  释义
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={meaning}
                    onChange={(e) => setMeaning(e.target.value)}
                    placeholder="记下中文释义或你自己的理解"
                  />
                </label>
                <label>
                  例句（选填）
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={example}
                    onChange={(e) => setExample(e.target.value)}
                    placeholder="记下文章中的例句，方便以后复习"
                  />
                </label>
                <Button
                  disabled={!title.trim() || !meaning.trim()}
                  onClick={() => void saveText()}
                >
                  保存单词
                </Button>
              </>
            )}
            {(kind === 'audio' || kind === 'recordings') && (
              <p className="library-help">
                支持 MP3、M4A、WAV、OGG、WebM、FLAC、AAC，单个文件最大 100
                MB。这里可以上传已有文件；也可在「练习中心」粘贴链接，直接读取并保存网页或音频。
              </p>
            )}
            {kind !== 'vocabulary' && (
              <Button variant="outline" onClick={() => upload.current?.click()}>
                <Upload size={17} />
                {kind === 'articles'
                  ? '上传文章文件'
                  : kind === 'recordings'
                    ? '上传已有录音'
                    : '上传练习音频'}
              </Button>
            )}
          </fieldset>
          {pendingUpload && !busy && !pendingUpload.isRecording && (
            <div className="library-help">
              <p>文件尚未保存：{pendingUpload.name}</p>
              <Button
                variant="outline"
                onClick={() =>
                  void saveFile(pendingUpload.file, pendingUpload.name)
                }
              >
                重试保存文件
              </Button>
            </div>
          )}
          <input
            hidden
            type="file"
            ref={upload}
            accept={
              kind === 'articles'
                ? '.txt,.md,.pdf'
                : '.mp3,.m4a,.mp4,.wav,.ogg,.webm,.flac,.aac'
            }
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void saveFile(f, f.name);
            }}
          />
          {kind === 'recordings' && (
            <div className="voice-recorder">
              <h3>直接录音</h3>
              <p>点击开始后才申请麦克风权限，单次最长 10 分钟。</p>
              {recording ? (
                <>
                  <output className="recording-time" aria-live="off">
                    正在录音 · {Math.floor(seconds / 60)}:
                    {String(seconds % 60).padStart(2, '0')}
                  </output>
                  <Button onClick={() => recorder.current?.stop()}>
                    <Square size={16} />
                    停止并试听
                  </Button>
                </>
              ) : (
                <Button
                  disabled={!online || busy || requestingMic || !!recorded}
                  onClick={() => void startRecording()}
                >
                  <Mic size={17} />
                  {requestingMic ? '等待麦克风权限…' : '开始录音'}
                </Button>
              )}
              {recorded && (
                <div className="recorded-preview">
                  <audio
                    controls
                    src={recorded.url}
                    aria-label="刚录制的口语音频"
                  />
                  <p>录音尚未保存 · {sizeLabel(recorded.blob.size)}</p>
                  <div className="library-actions">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void saveFile(recorded.blob, recordingName(), true)
                      }
                    >
                      保存录音到电脑
                    </Button>
                    <a href={recorded.url} download={recordingName()}>
                      下载录音副本
                    </a>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            translate(locale, '放弃这段尚未保存的录音？'),
                          )
                        )
                          setRecorded(null);
                      }}
                    >
                      重录
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="library-list">
          <div className="section-title">
            <h2>已保存的{categories.find((c) => c.id === kind)?.name}</h2>
            <span>{filtered.length} 份</span>
          </div>
          <label className="library-search">
            查找资料
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题、单词或释义"
            />
          </label>
          {loading ? (
            <p className="empty">正在读取电脑上的资料…</p>
          ) : filtered.length ? (
            filtered.map((i) => (
              <article className="library-item" key={i.id}>
                <button onClick={() => void openItem(i)}>
                  <strong>{i.title}</strong>
                  <span>
                    {i.summary ||
                      `${new Date(i.createdAt).toLocaleDateString('zh-CN')} · ${sizeLabel(i.size)}`}
                  </span>
                </button>
                {!i.repairRequired && (
                  <a
                    href={`/api/library/items/${i.kind}/${i.id}/file?download=1`}
                    aria-label={`下载 ${i.title}`}
                  >
                    <Download size={18} />
                  </a>
                )}
              </article>
            ))
          ) : (
            <div className="empty">
              <FolderOpen />
              <p>{search ? '没有找到匹配资料。' : '还没有保存这类资料。'}</p>
              <span>
                {search
                  ? '试试其他关键词。'
                  : '在左侧添加，保存后这里会出现你的学习材料。'}
              </span>
            </div>
          )}
          {detailBusy && <p className="library-help">正在打开资料…</p>}
          {detail && (
            <section className="library-detail">
              <div className="section-title">
                <h3 data-user-content>{detail.item.title}</h3>
                <button
                  onClick={() => {
                    if (
                      (editDirty || organizationDirty) &&
                      !window.confirm(
                        translate(locale, '放弃尚未保存的资料修改？'),
                      )
                    )
                      return;
                    setDetail(null);
                    setEdit(null);
                    setEditInitial('');
                    setOrganization(null);
                    setOrganizationInitial('');
                  }}
                >
                  收起
                </button>
              </div>
              {(sqliteMode || cloudMode) && edit ? (
                <fieldset disabled={editBusy || detail.item.repairRequired}>
                  <label>
                    标题
                    <input
                      maxLength={200}
                      value={edit.title}
                      onChange={(e) =>
                        setEdit({ ...edit, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    摘要
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={edit.summary}
                      onChange={(e) =>
                        setEdit({ ...edit, summary: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    来源链接（选填）
                    <input
                      type="url"
                      maxLength={2000}
                      value={edit.source}
                      onChange={(e) =>
                        setEdit({ ...edit, source: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      资料类型
                      <select
                        value={edit.kind}
                        onChange={(e) =>
                          setEdit({ ...edit, kind: e.target.value as Kind })
                        }
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      关联科目
                      <select
                        value={edit.skill}
                        onChange={(e) =>
                          setEdit({ ...edit, skill: e.target.value })
                        }
                      >
                        <option value="listening">听力</option>
                        <option value="reading">阅读</option>
                        <option value="writing">写作</option>
                        <option value="speaking">口语</option>
                        <option value="vocabulary">词汇</option>
                        <option value="grammar">语法</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    音频时长（秒，未知可留空）
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={edit.durationSeconds}
                      onChange={(e) =>
                        setEdit({ ...edit, durationSeconds: e.target.value })
                      }
                    />
                  </label>
                  {detail.item.editableContent && (
                    <label>
                      正文
                      <textarea
                        rows={10}
                        maxLength={1000000}
                        value={edit.content || ''}
                        onChange={(e) =>
                          setEdit({ ...edit, content: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <div className="library-actions">
                    <Button
                      disabled={
                        !editDirty ||
                        !edit.title.trim() ||
                        editBusy ||
                        organizationDirty
                      }
                      onClick={() => void saveEdit()}
                    >
                      {editBusy ? '处理中…' : '保存修改'}
                    </Button>
                    {detail.item.canExtract && (
                      <Button
                        variant="outline"
                        disabled={editBusy || editDirty || organizationDirty}
                        onClick={() => void extractDetail()}
                      >
                        <RefreshCw size={16} />
                        重新提取元数据
                      </Button>
                    )}
                  </div>
                  <p className="library-help">
                    标题来源：{sourceLabel(detail.item.titleSource)}；提取时间：
                    {dateLabel(detail.item.metadataExtractedAt)}
                    <br />
                    时长来源：{sourceLabel(detail.item.durationSource)}
                    ；时长更新时间：
                    {dateLabel(detail.item.durationUpdatedAt)}
                    <br />
                    资料更新时间：{dateLabel(detail.item.updatedAt)}
                  </p>
                  {detail.item.metadataExtractError && (
                    <output className="library-help">
                      元数据提取不完整：{detail.item.metadataExtractError}
                    </output>
                  )}
                </fieldset>
              ) : (
                <p className="library-help">
                  当前资料目录为兼容模式；切换到 SQLite 目录后可修改元数据。
                </p>
              )}
              {sqliteMode && organization && detail.organization && (
                <section className="resource-organization">
                  <h4>备注与笔记</h4>
                  <label>
                    资料备注（Markdown）
                    <textarea
                      rows={5}
                      maxLength={20000}
                      disabled={organizationBusy}
                      value={organization.remark}
                      onChange={(event) =>
                        setOrganization({
                          ...organization,
                          remark: event.target.value,
                        })
                      }
                    />
                  </label>
                  <small>
                    备注更新时间：
                    {dateLabel(detail.organization.remarkUpdatedAt)}
                  </small>
                  <MarkdownPreview value={organization.remark} />
                  <div className="section-title">
                    <h5>个人学习笔记</h5>
                    <Button
                      variant="outline"
                      disabled={
                        organizationBusy || organization.notes.length >= 20
                      }
                      onClick={() =>
                        setOrganization({
                          ...organization,
                          notes: [
                            ...organization.notes,
                            {
                              id: crypto.randomUUID(),
                              title: `笔记 ${organization.notes.length + 1}`,
                              bodyMarkdown: '',
                              sortOrder: organization.notes.length,
                              createdAt: '',
                              updatedAt: '',
                            },
                          ],
                        })
                      }
                    >
                      新建笔记
                    </Button>
                  </div>
                  {organization.notes.map((note, index) => (
                    <article className="resource-note" key={note.id}>
                      <label>
                        笔记标题
                        <input
                          maxLength={200}
                          disabled={organizationBusy}
                          value={note.title}
                          onChange={(event) =>
                            setOrganization({
                              ...organization,
                              notes: organization.notes.map((entry) =>
                                entry.id === note.id
                                  ? { ...entry, title: event.target.value }
                                  : entry,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Markdown 正文
                        <textarea
                          rows={5}
                          maxLength={100000}
                          disabled={organizationBusy}
                          value={note.bodyMarkdown}
                          onChange={(event) =>
                            setOrganization({
                              ...organization,
                              notes: organization.notes.map((entry) =>
                                entry.id === note.id
                                  ? {
                                      ...entry,
                                      bodyMarkdown: event.target.value,
                                    }
                                  : entry,
                              ),
                            })
                          }
                        />
                      </label>
                      <MarkdownPreview value={note.bodyMarkdown} />
                      <div className="library-actions">
                        <Button
                          variant="ghost"
                          disabled={organizationBusy || index === 0}
                          onClick={() => {
                            const notes = [...organization.notes];
                            [notes[index - 1], notes[index]] = [
                              notes[index],
                              notes[index - 1],
                            ];
                            setOrganization({ ...organization, notes });
                          }}
                        >
                          上移
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={
                            organizationBusy ||
                            index === organization.notes.length - 1
                          }
                          onClick={() => {
                            const notes = [...organization.notes];
                            [notes[index], notes[index + 1]] = [
                              notes[index + 1],
                              notes[index],
                            ];
                            setOrganization({ ...organization, notes });
                          }}
                        >
                          下移
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={organizationBusy}
                          onClick={() =>
                            setOrganization({
                              ...organization,
                              notes: organization.notes.filter(
                                (entry) => entry.id !== note.id,
                              ),
                            })
                          }
                        >
                          删除
                        </Button>
                        <small>修改：{dateLabel(note.updatedAt)}</small>
                      </div>
                    </article>
                  ))}

                  <h4>标签</h4>
                  {detail.organization.groups.map((group) => (
                    <fieldset className="tag-group" key={group.id}>
                      <legend>
                        {{
                          content_type: '内容类型',
                          skill: '技能',
                          topic: '主题',
                          genre: '体裁',
                          exam: '考试',
                          level: '难度',
                          user: '自定义',
                        }[group.key] || group.key}
                      </legend>
                      {group.tags.map((tag) => (
                        <label
                          className="tag-option"
                          data-color={tag.customColorToken || group.colorToken}
                          key={tag.id}
                        >
                          <input
                            type="checkbox"
                            checked={organization.tagIds.includes(tag.id)}
                            disabled={organizationBusy || !tag.isActive}
                            onChange={() => toggleTag(group, tag.id)}
                          />
                          {localizedName(tag, locale)}
                          {!tag.isActive && '（已停用，保留历史）'}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  <div className="custom-tag-editor">
                    <input
                      aria-label="新自定义标签名称"
                      maxLength={40}
                      placeholder="新自定义标签"
                      disabled={organizationBusy}
                      value={organization.customTags[0]?.name || ''}
                      onChange={(event) =>
                        setOrganization({
                          ...organization,
                          customTags: [
                            {
                              name: event.target.value,
                              color:
                                organization.customTags[0]?.color || 'charcoal',
                            },
                          ],
                        })
                      }
                    />
                    <select
                      aria-label="自定义标签颜色"
                      disabled={organizationBusy}
                      value={organization.customTags[0]?.color || 'charcoal'}
                      onChange={(event) =>
                        setOrganization({
                          ...organization,
                          customTags: [
                            {
                              name: organization.customTags[0]?.name || '',
                              color: event.target.value,
                            },
                          ],
                        })
                      }
                    >
                      <option value="sakura">Sakura</option>
                      <option value="navy">Navy</option>
                      <option value="olive">Olive</option>
                      <option value="charcoal">Charcoal</option>
                    </select>
                  </div>

                  <h4>内容涉及地区</h4>
                  <select
                    multiple
                    size={8}
                    aria-label="内容涉及地区"
                    disabled={organizationBusy}
                    value={organization.placeIds}
                    onChange={(event) =>
                      setOrganization({
                        ...organization,
                        placeIds: Array.from(event.target.selectedOptions).map(
                          (option) => option.value,
                        ),
                      })
                    }
                  >
                    {detail.organization.places.map((place) => (
                      <option key={place.id} value={place.id}>
                        {localizedName(place, locale)}
                        {place.isoAlpha2 ? ` · ${place.isoAlpha2}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="library-help">
                    可多选；选择区域不会自动添加该区域内的每个国家。
                  </p>

                  <div className="section-title">
                    <h4>标签建议</h4>
                    <Button
                      variant="outline"
                      disabled={organizationBusy}
                      onClick={() => void refreshSuggestions()}
                    >
                      根据现有字段生成建议
                    </Button>
                  </div>
                  {detail.organization.suggestions.length ? (
                    detail.organization.suggestions.map((suggestion) => (
                      <label className="suggestion" key={suggestion.tagId}>
                        <input
                          type="checkbox"
                          aria-label={`采用标签建议 ${localizedName(suggestion, locale)}`}
                          checked={organization.tagIds.includes(
                            suggestion.tagId,
                          )}
                          disabled={organizationBusy}
                          onChange={() => {
                            const group = detail.organization?.groups.find(
                              (entry) => entry.id === suggestion.groupId,
                            );
                            if (group) toggleTag(group, suggestion.tagId);
                          }}
                        />
                        <span>
                          <b>{localizedName(suggestion, locale)}</b>
                          <small>
                            依据：{suggestion.evidence}；可靠性：
                            {Math.round(suggestion.confidence * 100)}%
                          </small>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="library-help">
                      尚无建议。没有可靠依据时保持未知，不推断地区或考试等级。
                    </p>
                  )}
                  <Button
                    disabled={
                      !organizationDirty ||
                      organizationBusy ||
                      editDirty ||
                      organization.notes.some((note) => !note.title.trim())
                    }
                    onClick={() => void saveOrganization()}
                  >
                    {organizationBusy ? '保存中…' : '保存整理内容'}
                  </Button>
                </section>
              )}
              {detail.item.source && (
                <a
                  href={detail.item.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看来源
                </a>
              )}
              {detail.item.repairRequired && (
                <output>
                  原文件缺失，请从备份恢复到原位置后重新打开。目录记录仍保留。
                </output>
              )}
              {word ? (
                <>
                  <p>
                    <b>释义</b>
                    <br />
                    <span data-user-content>{word.meaning}</span>
                  </p>
                  {word.example && (
                    <p>
                      <b>例句</b>
                      <br />
                      <span data-user-content>{word.example}</span>
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      onActivity({
                        kind: wordKnown ? 'word-unknown' : 'word-known',
                        resourceId: word.word.toLowerCase(),
                        resourceRef: {
                          kind: 'vocabulary',
                          id: word.word.toLowerCase(),
                        },
                        label: word.word,
                        seconds: 0,
                      })
                    }
                  >
                    {wordKnown ? '还不熟悉' : '我认识'}
                  </Button>
                </>
              ) : detail.content !== null ? (
                <div className="saved-article" data-user-content>
                  {detail.content}
                </div>
              ) : detail.item.kind === 'audio' ||
                detail.item.kind === 'recordings' ? (
                <audio
                  key={detail.item.id}
                  controls
                  preload="metadata"
                  src={`/api/library/items/${detail.item.kind}/${detail.item.id}/file`}
                  aria-label={detail.item.title}
                  onError={() =>
                    setMessage(
                      '此浏览器无法播放该文件。可下载原文件，用电脑播放器打开。',
                    )
                  }
                />
              ) : (
                <p>文档已保留原文件，请下载后阅读。</p>
              )}
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
