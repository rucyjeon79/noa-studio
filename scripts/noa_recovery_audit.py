"""Read-only production inventory. Never prints payloads, members or credentials."""
import base64
import hashlib
import json
import os
from pathlib import Path
import paramiko
import noa_sftp_deploy as deployment

def main():
    connection = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        connection.get_security_options().key_types = ('ssh-ed25519',)
        connection.start_client(timeout=20)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(connection.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('SSH host key mismatch')
        connection.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(connection)
        root = '/hosting/noastudio/html'
        if sftp.normalize(root) != root:
            raise RuntimeError('Unexpected production root')
        matches, different, missing = [], [], []
        for local, remote in deployment.FILES.items():
            path = Path(local)
            if not path.is_file():
                continue
            try:
                actual = deployment.digest(sftp, root + '/' + remote)
            except FileNotFoundError:
                missing.append(remote)
                continue
            (matches if actual == hashlib.sha256(path.read_bytes()).hexdigest() else different).append(remote)
        print(json.dumps({'files_matching_repository': matches, 'files_different_preserved': different, 'files_missing': missing}))
        # Hosting rejected PHP CLI execution and SSH database forwarding.
        # Do not bypass that policy or turn a private audit into a public endpoint.
        print(json.dumps({'database_read_only': {'verified':False,'reason':'hosting_disallows_cli_and_database_forwarding','continuation':'authenticated /noa-bridge/source-audit.php'}}))
        print('::warning::Database payload verification requires an authenticated administrator session; no database writes were attempted.')
    finally:
        connection.close()

if __name__ == '__main__':
    main()
