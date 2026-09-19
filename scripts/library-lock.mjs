import { openSync, closeSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// flock belongs to the open file description shared with Python. Keeping this
// descriptor open holds the OS lock; normal close and process death release it.
export function acquireLibraryLock(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const fd = openSync(resolve(directory, '.writer.lock'), 'a+', 0o600);
  const result = spawnSync(
    'python3',
    ['-c', 'import fcntl; fcntl.flock(3, fcntl.LOCK_EX | fcntl.LOCK_NB)'],
    { stdio: ['ignore', 'pipe', 'pipe', fd] },
  );
  if (result.error || result.status !== 0) {
    closeSync(fd);
    throw Error(
      result.error
        ? '无法启动 Python 目录锁'
        : '资料目录正由另一服务或备份占用，请先停止该服务',
    );
  }
  return { fd, close: () => closeSync(fd) };
}
export const lockDatabaseDirectory = (databasePath) =>
  acquireLibraryLock(dirname(resolve(databasePath)));
