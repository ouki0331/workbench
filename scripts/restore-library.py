"""Verify and restore a SQLite backup into a new offline directory (no overwrite)."""
import argparse
import json
import shutil
import sqlite3
import tempfile
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from importlib.util import spec_from_file_location, module_from_spec

spec = spec_from_file_location('backup', Path(__file__).with_name('backup-library.py'))
backup = module_from_spec(spec)
spec.loader.exec_module(backup)


def restore(archive_path, destination):
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('恢复目录必须是一个尚不存在的新目录；不会覆盖已有资料')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.ielts-restore-', dir=destination.parent) as temp:
        staging = Path(temp) / 'library'
        staging.mkdir(mode=0o700)
        with ZipFile(archive_path) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise ValueError('ZIP包含重复路径')
            for entry in archive.infolist():
                parts = PurePosixPath(entry.filename).parts
                if not parts or parts[0] != 'ielts-study-library' or '..' in parts or '\\' in entry.filename or entry.filename.startswith('/') or ((entry.external_attr >> 16) & 0o170000) == 0o120000:
                    raise ValueError('ZIP路径无效')
            manifest = json.loads(archive.read('ielts-study-library/backup-manifest.json'))
            if manifest.get('format') != 'ielts-library-backup' or manifest.get('version') != 1 or manifest.get('mode') != 'sqlite':
                raise ValueError('只支持已验证的SQLite资料备份')
            expected = {'ielts-study-library/' + row['path'] for row in manifest['files']}
            if len(expected) != len(manifest['files']) or set(names) != expected | {'ielts-study-library/backup-manifest.json'}:
                raise ValueError('ZIP内容与备份清单不一致')
            for row in manifest['files']:
                path = staging / row['path']
                if not path.resolve().is_relative_to(staging):
                    raise ValueError('备份清单路径无效')
                path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with archive.open('ielts-study-library/' + row['path']) as source, path.open('wb') as target:
                    shutil.copyfileobj(source, target)
                path.chmod(0o600)
                with path.open('rb') as stream:
                    if backup.digest(stream) != row['sha256'] or path.stat().st_size != row['size']:
                        raise ValueError('备份文件校验失败: ' + row['path'])
            with sqlite3.connect(staging / 'workbench.sqlite3') as db:
                if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('数据库完整性检查失败')
                resources = [row[0] for row in db.execute('SELECT id FROM resources ORDER BY id')]
                if resources != manifest['resources']:
                    raise ValueError('资料清单与数据库不一致')
                for relative_path, size, checksum in db.execute('SELECT relative_path,byte_size,checksum_sha256 FROM resource_files'):
                    path = backup.checked_path(staging, relative_path)
                    with path.open('rb') as stream:
                        if path.stat().st_size != size or backup.digest(stream) != checksum:
                            raise ValueError('资料关系校验失败')
            if json.loads((staging / '.library-mode.json').read_text()).get('mode') != 'sqlite':
                raise ValueError('目录模式标记不匹配')
            (staging / 'backup-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
            staging.rename(destination)
            return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('destination')
    args = parser.parse_args()
    manifest = restore(args.archive, args.destination)
    print(json.dumps({'directory': str(Path(args.destination).resolve()), 'progress': manifest['progress'], 'resources': len(manifest['resources'])}))
