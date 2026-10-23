"""Verify Drive readback and isolated restore. Never removes hosting files."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

from noa_verify_private_backup import verify_dump


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify_files(source, readback):
    rows = json.loads((source / 'manifest.json').read_text())
    for row in rows:
        name = row['file']
        # Only the five enumerated SQL basenames can reach the local verifier.
        from noa_sql_backup_to_runner import FILES
        if name not in FILES:
            raise RuntimeError('unexpected_backup_name')
        sql = readback / name
        metadata = readback / row['metadata_file']
        if sql.stat().st_size != row['bytes'] or digest(sql) != row['sha256']:
            raise RuntimeError('drive_sql_sha256_mismatch:' + name)
        if digest(metadata) != row['metadata_sha256']:
            raise RuntimeError('drive_metadata_sha256_mismatch:' + name)
        meta = json.loads(metadata.read_text())
        if (meta.get('sha256'), meta.get('bytes'), meta.get('id')) != (row['sha256'], row['bytes'], name[:-4]):
            raise RuntimeError('drive_manifest_mismatch:' + name)
    return rows


def main():
    base = Path(os.environ['RUNNER_TEMP'])
    source = base / 'noa-db-backups'
    readback = base / 'noa-drive-readback'
    rows = verify_files(source, readback)
    listing = json.loads((base / 'noa-drive-listing.json').read_text())
    report = []
    for row in rows:
        matches = [item for item in listing if item.get('Name') == row['file'] and not item.get('IsDir')]
        if len(matches) != 1 or not matches[0].get('ID') or matches[0].get('Size') != row['bytes']:
            raise RuntimeError('drive_identity_missing_or_ambiguous:' + row['file'])
        # This client is hardwired to the disposable loopback MySQL service.
        # Do not inherit a production database endpoint or client defaults.
        env = dict(os.environ, MYSQL_PWD='noa-isolated-only')
        reset = subprocess.run([
            'mysql', '--no-defaults', '--host=127.0.0.1', '--user=root',
            '--execute=DROP DATABASE IF EXISTS noa_restore_verification; CREATE DATABASE noa_restore_verification CHARACTER SET utf8mb4;'
        ], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=30)
        if reset.returncode:
            raise RuntimeError('isolated_database_reset_failed')
        with tempfile.TemporaryDirectory(prefix='noa-drive-restore-', dir=base) as tmp:
            meta = json.loads((readback / row['metadata_file']).read_text())
            verify_dump(readback / row['file'], meta, tmp)
        report.append({**row, 'drive_file_id': matches[0]['ID'],
                       'drive_folder_id': '1N4ddmFbGpMEMGLB3zg4XJYBzLk3mHds2',
                       'drive_readback_sha256_verified': True,
                       'isolated_restore_verified': True,
                       'hosting_deleted': False})
    proof = {'files': report, 'reclaimed_bytes': 0,
             'deletion_blocked_until_runtime_reference_and_activity_checks': True}
    (base / 'noa-drive-restore-proof.json').write_text(json.dumps(proof, indent=2))
    print('DRIVE_READBACK_RESTORE_PROOF ' + json.dumps(proof))


if __name__ == '__main__':
    main()
