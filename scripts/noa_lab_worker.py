"""Verify NOA worker connection without resuming host intermediate publication."""
import os
import base64
import hashlib
import json
import stat


def publication_preflight(state):
    if not isinstance(state, dict):
        raise RuntimeError('invalid_ai_runtime_state')
    jobs = state.get('jobs', {})
    # PHP json_encode emits [] for its empty associative jobs store.
    if jobs == []:
        jobs = {}
    if not isinstance(jobs, dict):
        raise RuntimeError('invalid_ai_runtime_state')
    pending = sum(str(job.get('state', '')).startswith('queued_') for job in jobs.values())
    active_states = {'analyzing', 'rendering', 'uploading', 'collecting_metrics',
                     'creating_text', 'mastering_audio'}
    active = sum(job.get('state') in active_states for job in jobs.values())
    return {'runtime': 'ai_lab', 'connectionVerified': True, 'queued': pending,
            'active': active, 'processingEnabled': False,
            'state': 'blocked_publication_policy' if pending or active else 'idle',
            'reason': 'runner_only_final_publication_required' if pending or active else 'no_queued_work',
            'jobsModified': 0, 'hostTemporaryFiles': 0}


def main():
    import paramiko
    required = ['NOA_SSH_HOST', 'NOA_SSH_USER', 'NOA_SSH_PASSWORD', 'NOA_SSH_HOST_FINGERPRINT']
    if any(not os.getenv(key) for key in required):
        raise RuntimeError('missing_noa_worker_connection')
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(
            transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.get_channel().settimeout(30)
            path = '/hosting/noastudio/noa-ai-lab/state.json'
            attrs = sftp.lstat(path)
            if not stat.S_ISREG(attrs.st_mode) or attrs.st_size > 16777216:
                raise RuntimeError('unsafe_ai_runtime_state')
            with sftp.open(path, 'rb') as handle:
                state = json.loads(handle.read())
        finally:
            sftp.close()
    finally:
        transport.close()
    result = publication_preflight(state)
    print('N80_AI_WORKER_PREFLIGHT', json.dumps(result))
    if result['state'] != 'idle':
        raise RuntimeError('ai_work_preserved_runner_only_final_publication_required')


if __name__ == '__main__':
    main()
