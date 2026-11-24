"""Deploy exactly one 부산지부 read-only endpoint, only when the real SFTP webroot is independently verified."""
from __future__ import annotations
import hashlib
import hmac
import os
from pathlib import Path
import socket
import stat
import uuid
import paramiko
from busan_readonly_check import ROOT, PORT, configuration, fingerprint

SOURCE = Path('deploy/busan/points/points-inventory.php')
TARGET = ROOT + '/busan-assistant/points-inventory.php'

def run():
    host, user, password, pinned = configuration(os.environ)
    content = SOURCE.read_bytes()
    if len(content) > 160000 or b'points.inventory.v1' not in content:
        raise RuntimeError('invalid_source')
    with socket.create_connection((host, PORT), timeout=15) as sock:
        with paramiko.Transport(sock) as transport:
            transport.banner_timeout = 15
            transport.auth_timeout = 15
            transport.get_security_options().key_types = ('ssh-ed25519',)
            transport.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(transport.get_remote_server_key()), pinned):
                raise RuntimeError('host_key_mismatch')
            transport.auth_password(user, password, fallback=False)
            if not transport.is_authenticated():
                raise RuntimeError('authentication_failed')
            with paramiko.SFTPClient.from_transport(transport) as sftp:
                sftp.get_channel().settimeout(25)
                # Never create nonexistent webroots or assume this is the live host.
                for directory in (ROOT, ROOT+'/busan-assistant'):
                    try:
                        info=sftp.lstat(directory)
                        if sftp.normalize(directory)!=directory or not stat.S_ISDIR(info.st_mode):
                            raise RuntimeError('unverified_site_directory')
                    except FileNotFoundError:
                        raise RuntimeError('site_root_not_visible') from None
                try:
                    sftp.lstat(TARGET)
                    raise RuntimeError('endpoint_already_exists_refuse_overwrite')
                except FileNotFoundError:
                    pass
                temp=TARGET+'.'+uuid.uuid4().hex+'.tmp'
                try:
                    with sftp.open(temp,'wx') as out:out.write(content)
                    sftp.chmod(temp,0o644)
                    with sftp.open(temp,'rb') as source:copied=source.read(len(content)+1)
                    if not hmac.compare_digest(hashlib.sha256(content).digest(),hashlib.sha256(copied).digest()):
                        raise RuntimeError('staging_hash_mismatch')
                    sftp.rename(temp,TARGET)
                finally:
                    try:sftp.remove(temp)
                    except (FileNotFoundError,OSError):pass
                with sftp.open(TARGET,'rb') as source:
                    if source.read(len(content)+1)!=content:raise RuntimeError('verification_failed')
                print('BUSAN_BRIDGE_INSTALL status=installed changes=one_new_endpoint')

if __name__=='__main__':
    try:run()
    except Exception as exc:
        reason=str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__
        print('BUSAN_BRIDGE_INSTALL status=blocked reason='+reason+' changes=0')
        raise SystemExit(2)
