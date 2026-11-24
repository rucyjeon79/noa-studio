"""One-time fail-closed upload of the Busan OIDC host-bridge controller.

No arbitrary server root, shell execution, FTP fallback, or existing-file overwrite.
"""
import hashlib
import hmac
import os
from pathlib import Path
import socket
import stat
import uuid

import paramiko

from busan_readonly_check import ROOT, PORT, configuration, fingerprint

SOURCE = Path("deploy/busan/host-bridge/host-bridge.php")
TARGET = ROOT + "/busan-assistant/host-bridge.php"
PRIVATE = "/hosting/rucyjeon79/busan-assistant-private"


def _check_regular(sftp, path):
    if sftp.normalize(path) != path:
        raise RuntimeError("unexpected_server_mapping")
    attrs = sftp.lstat(path)
    if not stat.S_ISREG(attrs.st_mode):
        raise RuntimeError("unexpected_site_file")


def _check_directory(sftp, path):
    if sftp.normalize(path) != path:
        raise RuntimeError("unexpected_server_mapping")
    attrs = sftp.lstat(path)
    if not stat.S_ISDIR(attrs.st_mode):
        raise RuntimeError("unexpected_site_directory")


def install():
    host, user, password, trusted_key = configuration(os.environ)
    code = SOURCE.read_bytes()
    if not 1000 <= len(code) <= 160000 or b"bh_verified_claims" not in code:
        raise RuntimeError("bridge_source_invalid")
    with socket.create_connection((host, PORT), timeout=15) as sock:
        with paramiko.Transport(sock) as transport:
            transport.banner_timeout = 15
            transport.auth_timeout = 15
            transport.get_security_options().key_types = ("ssh-ed25519",)
            transport.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(transport.get_remote_server_key()), trusted_key):
                raise RuntimeError("host_key_mismatch")
            transport.auth_password(user, password, fallback=False)
            if not transport.is_authenticated():
                raise RuntimeError("not_authenticated")
            with paramiko.SFTPClient.from_transport(transport) as sftp:
                sftp.get_channel().settimeout(25)
                try:
                    _check_directory(sftp, ROOT)
                    _check_regular(sftp, ROOT + "/common.php")
                    _check_regular(sftp, ROOT + "/data/dbconfig.php")
                    _check_directory(sftp, ROOT + "/busan-assistant")
                    _check_directory(sftp, PRIVATE)
                except FileNotFoundError:
                    raise RuntimeError("actual_site_root_not_visible") from None
                try:
                    sftp.lstat(TARGET)
                    raise RuntimeError("endpoint_exists_manual_review_required")
                except FileNotFoundError:
                    pass
                temp = TARGET + "." + uuid.uuid4().hex + ".tmp"
                try:
                    with sftp.open(temp, "wx") as f:
                        f.write(code)
                    sftp.chmod(temp, 0o644)
                    with sftp.open(temp, "rb") as f:
                        actual = f.read(len(code) + 1)
                    if not hmac.compare_digest(hashlib.sha256(actual).digest(), hashlib.sha256(code).digest()):
                        raise RuntimeError("staged_bytes_mismatch")
                    sftp.rename(temp, TARGET)
                finally:
                    try:
                        sftp.remove(temp)
                    except (FileNotFoundError, OSError):
                        pass
                with sftp.open(TARGET, "rb") as f:
                    if f.read(len(code) + 1) != code:
                        raise RuntimeError("live_bytes_mismatch")
                print("BUSAN_HOST_BRIDGE_INSTALL verified=1 installed_files=1 existing_files_changed=0")


if __name__ == "__main__":
    try:
        install()
    except Exception as exc:
        safe_reason = str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__
        print("BUSAN_HOST_BRIDGE_INSTALL verified=0 installed_files=0 existing_files_changed=0 reason=" + safe_reason)
        raise SystemExit(2)
