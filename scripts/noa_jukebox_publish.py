"""Publish completed runner media without replacing an existing edition.

Only the staging file created by this invocation may be cleaned up. The final
file is activated after a complete SFTP readback; PHP independently validates
it again before publishing SQL references.
"""
import hashlib
from pathlib import Path, PurePosixPath
import re
import secrets
import stat

PREFIXES = ('/hosting/noastudio/noa-jukebox-private/media/',
            '/hosting/noastudio/html/noa-jukebox/')


def remote_digest(sftp, path, expected_bytes):
    info = sftp.lstat(path)
    if not stat.S_ISREG(info.st_mode) or info.st_size != expected_bytes:
        raise ValueError('media_size_or_type_changed')
    digest = hashlib.sha256()
    total = 0
    with sftp.open(path, 'rb') as stream:
        if hasattr(stream, 'prefetch'):
            stream.prefetch(file_size=expected_bytes, max_concurrent_requests=16)
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > expected_bytes:
                raise ValueError('media_grew_during_verification')
            digest.update(chunk)
    if total != expected_bytes:
        raise ValueError('media_truncated_during_verification')
    return digest.hexdigest()


def publish_final(sftp, local, target, expected_sha256, mode=0o600, owner='worker'):
    local = Path(local)
    if (not any(target.startswith(prefix) for prefix in PREFIXES)
            or '..' in PurePosixPath(target).parts
            or not re.fullmatch('[a-f0-9]{64}', expected_sha256)
            or not re.fullmatch('[a-zA-Z0-9_-]{1,80}', str(owner))):
        raise ValueError('invalid_media_publication')
    parent = str(PurePosixPath(target).parent)
    if sftp.normalize(parent) != parent:
        raise ValueError('unsafe_media_directory')
    size = local.stat().st_size
    if not size:
        raise ValueError('empty_completed_media')

    def existing_matches():
        try:
            sftp.lstat(target)
        except FileNotFoundError:
            return False
        if remote_digest(sftp, target, size) != expected_sha256:
            raise ValueError('existing_media_preserved')
        return True

    if existing_matches():
        return {'created': False, 'readback_verified': True}
    stage = target + '.stage-' + str(owner) + '-' + secrets.token_hex(12)
    created = False
    try:
        with sftp.open(stage, 'wx') as output:
            created = True
            if hasattr(output, 'set_pipelined'):
                output.set_pipelined(True)
            with local.open('rb') as source:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
            output.flush()
        sftp.chmod(stage, mode)
        if remote_digest(sftp, stage, size) != expected_sha256:
            raise ValueError('completed_media_upload_hash_mismatch')
        if existing_matches():
            return {'created': False, 'readback_verified': True}
        # Standard SFTP rename refuses an existing destination. Do not use
        # posix_rename, which would replace a concurrent worker's final file.
        sftp.rename(stage, target)
        created = False
        if remote_digest(sftp, target, size) != expected_sha256:
            raise ValueError('completed_media_activation_hash_mismatch')
        return {'created': True, 'readback_verified': True}
    finally:
        if created:
            try:
                sftp.remove(stage)
            except FileNotFoundError:
                pass
