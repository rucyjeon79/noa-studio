"""Fail-closed, read-only SFTP gate for external N80 one-shot jobs.

The host's owner stop/pause latch is authoritative. Never run an off-host
generation, media or publishing step while the hosting safety stop is set.
No host shell, process launch, writes or provider requests happen here.
"""
import base64
import hashlib
import json
import os
import stat

ROOT = "/hosting/noastudio/noa-hub"
CONTROL = ROOT + "/control.json"
FINGERPRINT = "SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU"
LIMIT = 32768


def evaluate_control(raw):
    if not isinstance(raw, bytes) or not 2 <= len(raw) <= LIMIT:
        return False, "invalid_host_control"
    try:
        state = json.loads(raw)
    except (ValueError, UnicodeError):
        return False, "invalid_host_control"
    if not isinstance(state, dict):
        return False, "invalid_host_control"
    if state.get("stop") is not False or state.get("paused") is not False:
        return False, "owner_stop_or_pause_latched"
    if type(state.get("revision")) is not int or state["revision"] < 1:
        return False, "invalid_host_control_revision"
    return True, "owner_control_allows_work"


def sftp_control(sftp):
    if sftp.normalize(ROOT) != ROOT:
        raise ValueError("n80_private_root_changed")
    info = sftp.lstat(CONTROL)
    if not stat.S_ISREG(info.st_mode) or not 2 <= info.st_size <= LIMIT:
        raise ValueError("n80_control_is_not_regular")
    with sftp.open(CONTROL, "rb") as f:
        data = f.read(LIMIT + 1)
    if len(data) != info.st_size:
        raise ValueError("n80_control_changed_during_read")
    return evaluate_control(data)


def remote_gate(env):
    import paramiko
    for name in ("NOA_SSH_HOST", "NOA_SSH_USER", "NOA_SSH_PASSWORD"):
        if not env.get(name):
            return False, "sftp_configuration_missing"
    connection = paramiko.Transport((env["NOA_SSH_HOST"], 2022))
    try:
        connection.get_security_options().key_types = ("ssh-ed25519",)
        connection.start_client(timeout=15)
        fingerprint = "SHA256:" + base64.b64encode(
            hashlib.sha256(connection.get_remote_server_key().asbytes()).digest()
        ).decode().rstrip("=")
        if fingerprint != FINGERPRINT:
            return False, "sftp_host_fingerprint_mismatch"
        connection.auth_password(env["NOA_SSH_USER"], env["NOA_SSH_PASSWORD"])
        if not connection.is_authenticated():
            return False, "sftp_authentication_unverified"
        sftp = paramiko.SFTPClient.from_transport(connection)
        try:
            sftp.get_channel().settimeout(25)
            return sftp_control(sftp)
        finally:
            sftp.close()
    finally:
        connection.close()


def main():
    # A missing/unreadable control or any transport error means work is blocked.
    # Never send a known worker key or start a host process just to probe readiness.
    try:
        allowed, reason = remote_gate(os.environ)
    except Exception:
        allowed, reason = False, "host_control_unreachable"
    result = {"allowed": allowed, "reason": reason, "mode": "sftp_read_only",
              "hostProcessLaunches": 0, "hostWrites": 0, "externalProviderCalls": 0}
    print("N80_EXTERNAL_EXECUTION_GATE=" + json.dumps(result, sort_keys=True), flush=True)
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as fd:
            fd.write("allow=" + ("true" if allowed else "false") + "\n")
            fd.write("reason=" + reason + "\n")


if __name__ == "__main__":
    main()
