"""One-time, pinned transport for moving control into the existing N80 host."""
import base64
import hashlib
import json
import os
import paramiko


def connect():
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    transport.get_security_options().key_types = ('ssh-ed25519',)
    transport.start_client(timeout=20)
    fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
    if fingerprint != 'SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':
        transport.close()
        raise RuntimeError('host_key_mismatch')
    transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
    return transport


def probe():
    transport = connect()
    try:
        channel = transport.open_session(timeout=20)
        channel.settimeout(30)
        channel.exec_command('for tool in php php8.2 php82 php-cgi python3 python node crontab git java javac ffmpeg ffprobe bash; do command -v "$tool" || true; done; test -d /proc && echo proc_present; test -r /proc/self/status && echo proc_self_readable; crontab -l >/dev/null 2>&1; printf "cron_read_status=%s\\n" "$?"; ls -ld /usr/bin/php* /usr/local/bin/php* /hosting/noastudio/noa-ai-lab/host-runtime 2>/dev/null')
        output = channel.makefile('r').read(16384).decode(errors='replace')
        print('N80_HUB_HOST_CAPABILITIES', json.dumps({'output': output, 'exitCode': channel.recv_exit_status()}))
    finally:
        transport.close()


if __name__ == '__main__':
    probe()
