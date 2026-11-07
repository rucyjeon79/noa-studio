"""Run the existing N80 MUVY/media queues with runner-only intermediate processing."""
import json


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
            'active': active, 'processingEnabled': True,
            'state': 'ready' if pending or active else 'idle',
            'reason': 'runner_final_publication' if pending or active else 'no_queued_work',
            'jobsModified': 0, 'hostTemporaryFiles': 0}


def main():
    import subprocess
    from noa_n80_ai_worker import worker_key
    # The existing queue, leases, flags, cost limits and approval rules remain authoritative.
    key=worker_key().decode()
    for entry in ('lab/muvy.mjs','lab/worker.mjs'):
        subprocess.run(['node',entry],input=json.dumps({'key':key}),text=True,check=True)

if __name__ == '__main__':
    main()
