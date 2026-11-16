#!/usr/bin/env python3
"""N80 production recovery: bounded, read-only SFTP audit.

No remote writes, shell/SSH command, media download, process restart, or keys in output.
A separate authorization and verified Google Drive backup are required for any deploy.
"""
import base64
import hashlib
import json
import os
import stat
from pathlib import PurePosixPath

import paramiko

HOST_ROOT = "/hosting/noastudio/html"
HUB_ROOT = "/hosting/noastudio/noa-hub"
EXPECTED_FINGERPRINT = "SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU"
ALLOW = (
    "noa-bridge/session-shorts.php",
    "noa-bridge/session-shorts-prepare.php",
    "noa-bridge/session-shorts-control.php",
    "noa-bridge/session-agent.php",
    "noa-app/engine/ai-automation.php",
    "noa-gpt.php",
)
MAX_FILE = 256 * 1024
MAX_CONTROL = 32 * 1024


def checked_read(sftp, absolute, limit):
    path = PurePosixPath(absolute)
    if not str(path).startswith("/hosting/noastudio/") or ".." in path.parts:
        raise RuntimeError("unsafe_remote_path")
    try:
        info = sftp.lstat(absolute)
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(info.st_mode) or not 0 <= info.st_size <= limit:
        raise RuntimeError("unsafe_remote_file")
    with sftp.open(absolute, "rb") as handle:
        data = handle.read(limit + 1)
    if len(data) != info.st_size:
        raise RuntimeError("remote_length_changed")
    return data


def inspect(sftp):
    if sftp.normalize(HOST_ROOT) != HOST_ROOT:
        raise RuntimeError("host_root_identity_mismatch")
    files = {}
    for relative in ALLOW:
        raw = checked_read(sftp, HOST_ROOT + "/" + relative, MAX_FILE)
        files[relative] = (
            {"present": False} if raw is None else
            {"present": True, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
        )
    control = checked_read(sftp, HUB_ROOT + "/control.json", MAX_CONTROL)
    if control is None:
        runner = {"controlPresent": False, "safeStopVerified": False}
    else:
        state = json.loads(control)
        if not isinstance(state, dict):
            raise RuntimeError("invalid_control_format")
        runner = {
            "controlPresent": True,
            "stopLatched": state.get("stop") is True,
            "paused": state.get("paused") is True,
            "revision": state.get("revision") if type(state.get("revision")) is int else None,
            "safeStopVerified": state.get("stop") is True or state.get("paused") is True,
        }
    return {
        "ok": True,
        "mode": "read_only_sftp",
        "sshHostKeyPinned": True,
        "rootIdentityVerified": True,
        "files": files,
        "hubControl": runner,
        "productionWrites": 0,
        "processLaunches": 0,
        "databaseReads": 0,
        "mediaReads": 0,
        "secretsPrinted": False,
    }


def main():
    keys = ("NOA_SSH_HOST", "NOA_SSH_USER", "NOA_SSH_PASSWORD")
    if any(not os.getenv(k) for k in keys):
        raise RuntimeError("sftp_credential_configuration_missing")
    transport = paramiko.Transport((os.environ["NOA_SSH_HOST"], 2022))
    try:
        transport.get_security_options().key_types = ("ssh-ed25519",)
        transport.start_client(timeout=15)
        server_key = transport.get_remote_server_key()
        got = "SHA256:" + base64.b64encode(
            hashlib.sha256(server_key.asbytes()).digest()
        ).decode().rstrip("=")
        if got != EXPECTED_FINGERPRINT:
            raise RuntimeError("sftp_host_fingerprint_mismatch")
        # Authenticate only after the remote host identity has been checked.
        transport.auth_password(os.environ["NOA_SSH_USER"], os.environ["NOA_SSH_PASSWORD"])
        if not transport.is_authenticated():
            raise RuntimeError("sftp_authentication_failed")
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.get_channel().settimeout(35)
            result = inspect(sftp)
        finally:
            sftp.close()
    finally:
        transport.close()
    print("N80_SFTP_RECOVERY_READONLY=" + json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
