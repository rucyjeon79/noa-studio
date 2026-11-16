#!/usr/bin/env python3
"""One-file NOA Shorts SFTP release after independently verified Drive backup.

Preconditions:
- Exact production preimage and pinned candidate SHA-256
- Current original Google Drive snapshot verified by operator/connector
- Host key pinned, N80 owner stop/paused flags both latched
- No PHP execution on the host, no worker launch, no database/media mutations
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import stat

import paramiko

ROOT = "/hosting/noastudio/html"
HUB = "/hosting/noastudio/noa-hub"
REMOTE = ROOT + "/noa-bridge/session-shorts-prepare.php"
OLD = "0be99712546f55272c28ecef5c4605cf0acd06827b4874b6f33e00defa3e22a8"
NEW = "9e7ec422a608c37b4ccff8eb727d52001d28f34db7e21b8f1267395864d07596"
PIN = "SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU"
BACKUP = "13fIdULMeloXp-Gr46mnpgUHUg5Cm-yb6"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_regular(sftp, path, maximum=160000):
    info = sftp.lstat(path)
    if not stat.S_ISREG(info.st_mode) or info.st_size < 1 or info.st_size > maximum:
        raise RuntimeError("unknown_or_unsafe_operating_file")
    with sftp.open(path, "rb") as fh:
        data = fh.read(maximum + 1)
    if len(data) != info.st_size:
        raise RuntimeError("remote_file_size_changed")
    return data


def require_safety_stop(sftp):
    data = read_regular(sftp, HUB + "/control.json", 32768)
    control = json.loads(data)
    if not isinstance(control, dict) or control.get("stop") is not True or control.get("paused") is not True:
        raise RuntimeError("n80_owner_stop_not_latched")
    return control.get("revision")


def connect():
    env = ("NOA_SSH_HOST", "NOA_SSH_USER", "NOA_SSH_PASSWORD")
    if any(not os.environ.get(key) for key in env):
        raise RuntimeError("sftp_credentials_unavailable")
    conn = paramiko.Transport((os.environ["NOA_SSH_HOST"], 2022))
    conn.get_security_options().key_types = ("ssh-ed25519",)
    conn.start_client(timeout=15)
    pub = conn.get_remote_server_key()
    fp = "SHA256:" + base64.b64encode(hashlib.sha256(pub.asbytes()).digest()).decode().rstrip("=")
    if fp != PIN:
        conn.close()
        raise RuntimeError("sftp_host_key_mismatch")
    conn.auth_password(os.environ["NOA_SSH_USER"], os.environ["NOA_SSH_PASSWORD"])
    if not conn.is_authenticated():
        conn.close()
        raise RuntimeError("sftp_authentication_failed")
    return conn


def main():
    candidate = Path(os.environ["N80_SFTP_CANDIDATE"])
    if candidate.is_symlink() or not candidate.is_file():
        raise RuntimeError("candidate_missing")
    desired = candidate.read_bytes()
    if digest(desired) != NEW or len(desired) != 11393:
        raise RuntimeError("unapproved_short_source")
    # Backup must already exist and be read back from the user's Google Drive.
    if os.environ.get("N80_VERIFIED_DRIVE_FILE_ID") != BACKUP:
        raise RuntimeError("google_drive_backup_not_verified")
    conn = connect()
    stage = None
    try:
        sftp = paramiko.SFTPClient.from_transport(conn)
        try:
            sftp.get_channel().settimeout(35)
            if sftp.normalize(ROOT) != ROOT:
                raise RuntimeError("host_root_mismatch")
            rev = require_safety_stop(sftp)
            actual = read_regular(sftp, REMOTE)
            if digest(actual) == NEW:
                print("N80_SFTP_SHORTS_RELEASE=" + json.dumps({
                    "ok": True, "state": "already_installed",
                    "changedFiles": 0, "candidateSha256": NEW,
                    "n80StopLatched": True, "drivePreimageFileId": BACKUP,
                    "workerRestarts": 0, "databaseWrites": 0,
                }, sort_keys=True))
                return
            if digest(actual) != OLD or len(actual) != 9913:
                raise RuntimeError("operating_preimage_mismatch")
            stage = REMOTE + ".n80-release-" + secrets.token_hex(6) + ".tmp"
            with sftp.open(stage, "wx") as fh:
                fh.write(desired)
                fh.flush()
            sftp.chmod(stage, 0o644)
            if digest(read_regular(sftp, stage)) != NEW:
                raise RuntimeError("staged_readback_mismatch")
            if require_safety_stop(sftp) != rev:
                raise RuntimeError("n80_stop_state_changed")
            if digest(read_regular(sftp, REMOTE)) != OLD:
                raise RuntimeError("operating_source_changed")
            # The only remote write besides the staging temp is this one atomic file replace.
            sftp.posix_rename(stage, REMOTE)
            stage = None
            if digest(read_regular(sftp, REMOTE)) != NEW:
                raise RuntimeError("live_readback_mismatch")
            if require_safety_stop(sftp) != rev:
                raise RuntimeError("n80_stop_state_changed_after_release")
            print("N80_SFTP_SHORTS_RELEASE=" + json.dumps({
                "ok": True, "state": "deployed",
                "changedFiles": 1, "remotePath": "noa-bridge/session-shorts-prepare.php",
                "beforeSha256": OLD, "afterSha256": NEW,
                "readbackVerified": True, "drivePreimageFileId": BACKUP,
                "n80StopLatched": True, "n80ControlRevision": rev,
                "workerRestarts": 0, "databaseWrites": 0,
                "mediaWrites": 0,
            }, sort_keys=True))
        finally:
            if stage is not None:
                try:
                    sftp.remove(stage)
                except Exception:
                    pass
            sftp.close()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
