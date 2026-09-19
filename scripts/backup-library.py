"""Capture a complete local library while holding its OS writer lock."""
import argparse
import fcntl
import hashlib
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


def digest(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(chunk)
    return result.hexdigest()


def checked_path(root, name):
    path = root / name
    if path.is_symlink() or not path.resolve().is_relative_to(root) or not path.is_file():
        raise ValueError('资料文件缺失或路径无效: ' + str(name))
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    parser.add_argument('destination')
    parser.add_argument('--lock-fd', type=int)
    parser.add_argument('--progress')
    args = parser.parse_args()
    root, dest = Path(args.directory).resolve(), Path(args.destination).resolve()
    # The online coordinator passes its own open description. Offline use must
    # acquire the same lock; a stale lock file alone never blocks recovery.
    lock = os.fdopen(os.dup(args.lock_fd), 'a+') if args.lock_fd is not None else (root / '.writer.lock').open('a+')
    with lock:
        if os.fstat(lock.fileno()).st_ino != (root / '.writer.lock').stat().st_ino:
            raise ValueError('Invalid library lock descriptor')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError('资料服务正在运行；请通过应用备份，或停止服务后离线备份') from error
        make_backup(root, dest, args.progress)


def make_backup(root, dest, progress_path):
    mode = json.loads((root / '.library-mode.json').read_text()).get('mode') if (root / '.library-mode.json').exists() else 'legacy'
    tmp = dest.with_suffix('.partial')
    captured = datetime.now(timezone.utc).isoformat()
    manifest = {'format': 'ielts-library-backup', 'version': 1, 'mode': mode,
                'capturedAt': captured, 'files': [], 'resources': [], 'references': [], 'progress': None}
    try:
        with tempfile.TemporaryDirectory(prefix='ielts-backup-') as scratch:
            snapshot = Path(scratch) / 'workbench.sqlite3'
            db = None
            if (root / 'workbench.sqlite3').exists():
                with sqlite3.connect(f'file:{root / "workbench.sqlite3"}?mode=ro', uri=True) as source:
                    with sqlite3.connect(snapshot) as target:
                        source.backup(target)
                db = sqlite3.connect(snapshot)
                db.row_factory = sqlite3.Row
                if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('数据库完整性检查失败')
                manifest['schemaVersions'] = [row[0] for row in db.execute('SELECT version FROM schema_migrations ORDER BY version')]
            try:
                with ZipFile(tmp, 'w', ZIP_DEFLATED, allowZip64=True) as archive:
                    def add(name, path=None, expected=None):
                        path = path or checked_path(root, name)
                        with path.open('rb') as stream:
                            checksum = digest(stream)
                        size = path.stat().st_size
                        if expected and (checksum != expected['checksum_sha256'] or size != expected['byte_size']):
                            raise ValueError('资料文件校验失败: ' + name)
                        archive.write(path, 'ielts-study-library/' + name)
                        with archive.open('ielts-study-library/' + name) as stream:
                            if digest(stream) != checksum:
                                raise ValueError('资料在备份过程中发生变化: ' + name)
                        manifest['files'].append({'path': name, 'size': size, 'sha256': checksum})

                    for name in ['README.md', 'manifest.json', '.library-mode.json']:
                        if (root / name).exists():
                            add(name)
                    if mode == 'sqlite':
                        if db is None:
                            raise ValueError('SQLite目录缺少数据库')
                        manifest['resources'] = [row[0] for row in db.execute('SELECT id FROM resources ORDER BY id')]
                        deleted = {row[0] for row in db.execute('SELECT resource_id FROM resource_tombstones')}

                        def reference(ref, origin):
                            if not ref:
                                return
                            kind, identifier = ref.get('kind', 'legacy'), ref.get('id', '')
                            status = 'preserved'
                            if kind == 'local-asset':
                                status = 'available' if identifier in manifest['resources'] else 'deleted' if identifier in deleted else 'missing'
                                if status == 'missing':
                                    raise ValueError('备份缺少本地来源: ' + identifier)
                            elif kind == 'legacy':
                                status = 'unresolved'
                            manifest['references'].append({'kind': kind, 'id': identifier, 'status': status, 'origin': origin})

                        rows = list(db.execute('SELECT * FROM resource_files ORDER BY resource_id,relative_path'))
                        with_file = {row['resource_id'] for row in rows}
                        if set(manifest['resources']) - with_file:
                            raise ValueError('资料缺少文件关系')
                        for row in rows:
                            name = row['relative_path']
                            add(name, expected=row)
                            if name.endswith('/practice.json'):
                                practice = json.loads(checked_path(root, name).read_text())
                                material = practice.get('material', {})
                                reference(material.get('resourceRef') or {'kind': 'legacy', 'id': material.get('id', '')}, name)
                                for url in [material.get('audioUrl'), practice.get('recordingUrl')]:
                                    if isinstance(url, str) and url.startswith('/api/library/items/'):
                                        reference({'kind': 'local-asset', 'id': url.split('/')[5]}, name)
                        if progress_path:
                            progress = json.loads(checked_path(root, progress_path).read_text())
                            for event in progress.get('activities', []):
                                reference(event.get('resourceRef') or {'kind': 'legacy', 'id': event.get('resourceId', '')}, 'activity:' + event['id'])
                            for card in progress.get('reviews', {}).get('cards', []):
                                reference(card.get('resourceRef') or {'kind': 'legacy', 'id': card.get('sourceId', '')}, 'review:' + card['id'])
                    else:
                        for kind in ['articles', 'vocabulary', 'audio', 'recordings']:
                            for folder in sorted((root / kind).iterdir()):
                                if not folder.is_dir() or folder.is_symlink():
                                    continue
                                meta = json.loads((folder / 'metadata.json').read_text())
                                add((folder / 'metadata.json').relative_to(root).as_posix())
                                add((folder / meta['filename']).relative_to(root).as_posix())
                        for path in sorted((root / 'progress').glob('*.json')):
                            if path.relative_to(root).as_posix() != progress_path:
                                add(path.relative_to(root).as_posix())
                    if progress_path:
                        add(progress_path)
                        manifest['progress'] = {'path': progress_path, 'capturedAt': captured}
                    if db is not None:
                        add('workbench.sqlite3', snapshot)
                    archive.writestr('ielts-study-library/backup-manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
            finally:
                if db is not None:
                    db.close()
        os.chmod(tmp, 0o600)
        tmp.replace(dest)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


if __name__ == '__main__':
    main()
