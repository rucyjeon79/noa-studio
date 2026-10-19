"""Read-only SSH authentication and remote root inspection for NOA STUDIO.

Requires a separately verified SHA256 SSH host-key fingerprint.
Never writes files or runs shell commands on the remote server.
"""
import base64
import hashlib
import os
import posixpath
import sys

import paramiko

def main():
    host = os.environ["NOA_SSH_HOST"].strip()
    user = os.environ["NOA_SSH_USER"].strip()
    password = os.environ["NOA_SSH_PASSWORD"]
    expected = os.environ["NOA_SSH_HOST_FINGERPRINT"].strip()
    root = os.environ["NOA_SSH_ROOT"].strip()
    if not all((host, user, password, expected, root)):
        raise RuntimeError("Missing SSH host, user, password, fingerprint, or root")
    if not expected.startswith("SHA256:") or len(expected) < 20:
        raise RuntimeError("Expected pinned SSH host fingerprint (SHA256:...)")
    if not root.startswith("/") or ".." in root.split("/"):
        raise RuntimeError("Invalid absolute SSH root path")

    transport = paramiko.Transport((host, 2022))
    try:
        transport.start_client(timeout=15)
        key = transport.get_remote_server_key()
        fingerprint = "SHA256:" + base64.b64encode(
            hashlib.sha256(key.asbytes()).digest()
        ).decode("ascii").rstrip("=")
        if fingerprint != expected:
            raise RuntimeError("SSH host fingerprint mismatch: connection refused")
        transport.auth_password(user, password)
        if not transport.is_authenticated():
            raise RuntimeError("SSH authentication failed")
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            actual = sftp.normalize(root)
            if not actual.endswith("/html"):
                raise RuntimeError("Remote root is not an /html directory")
            entries = sftp.listdir(actual)
            print("SSH authentication OK; remote root exists; entry count:", len(entries))
            print("GnuBoard common.php exists:", "common.php" in entries)
            print("NOA shell exists:", "noa2.php" in entries)
        finally:
            sftp.close()
    finally:
        transport.close()

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(type(exc).__name__ + ": " + str(exc), file=sys.stderr)
        sys.exit(1)
