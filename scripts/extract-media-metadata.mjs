import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname } from 'node:path';
const run = promisify(execFile);

// Optional local metadata reader. A missing executable or unreadable file never
// rejects the user's upload; the catalog records failure and permits correction.
export async function extractMediaMetadata(
  path,
  executable = process.env.IELTS_FFPROBE_PATH || 'ffprobe',
) {
  if (!['.mp3', '.m4a', '.wav', '.webm'].includes(extname(path).toLowerCase()))
    return {
      status: 'not_run',
      title: null,
      durationSeconds: null,
      error: null,
      raw: null,
    };
  try {
    const { stdout } = await run(
      executable,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:format_tags=title,artist,album,date:stream=codec_name,duration',
        '-of',
        'json',
        path,
      ],
      { timeout: 10000, maxBuffer: 1024 * 1024 },
    );
    const raw = JSON.parse(stdout);
    const duration = Number(raw.format?.duration);
    const durationSeconds =
      Number.isFinite(duration) && duration >= 0 ? duration : null;
    const title =
      typeof raw.format?.tags?.title === 'string' &&
      raw.format.tags.title.trim()
        ? raw.format.tags.title.trim().slice(0, 200)
        : null;
    return {
      status: durationSeconds === null ? 'partial' : 'success',
      title,
      durationSeconds,
      raw,
      error: durationSeconds === null ? '未识别到时长，可以手工填写。' : null,
    };
  } catch (error) {
    return {
      status: 'failed',
      title: null,
      durationSeconds: null,
      raw: null,
      error:
        error.code === 'ENOENT'
          ? '未安装 ffprobe，可以手工填写元数据。'
          : '未能读取音频元数据，可以手工修正。',
    };
  }
}
