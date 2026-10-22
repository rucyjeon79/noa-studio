"""Single-host deployment preparation pipeline; no live activation.

Reuses host selection, SFTP inventory, diff planner, stage, private backups,
and exclusive host lock. A failed stage/backup never mutates live files.
"""
from noa_deploy_hosts import resolve_host
from noa_dothome_lock import HostLock
from noa_dothome_preflight import inspect_and_plan
from noa_dothome_stage import stage_release
from noa_dothome_backup import prepare_backups

def prepare_release(profiles, host_id, manifest, payloads, sftp):
    host=resolve_host(profiles,host_id)
    if manifest.get('host_id')!=host.host_id or manifest.get('activate') is not False:
        raise ValueError('host_release_mismatch')
    if not isinstance(manifest.get('files'),list) or not manifest['files']:
        raise ValueError('empty_release')
    with HostLock(profiles,host_id,sftp) as lock:
        plan=inspect_and_plan(profiles,host_id,manifest,sftp)
        if not lock.verify():
            raise RuntimeError('host_lock_lost')
        # Only stage changed files, preserving manifest ordering and identity.
        changed={x['path'] for x in plan['changes']}
        if not changed:
            return {'host_id':host_id,'release':manifest['release'],'change_count':0,'ready_for_activation':False,'status':'no_changes'}
        staged_manifest=dict(manifest)
        staged_manifest['files']=[x for x in manifest['files'] if x['path'] in changed]
        staged_payloads={path:payloads[path] for path in changed}
        stage=stage_release(profiles,host_id,staged_manifest,staged_payloads,sftp)
        if not lock.verify():
            raise RuntimeError('host_lock_lost')
        backup=prepare_backups(profiles,host_id,plan,sftp,lock_held=True)
        if not lock.verify():
            raise RuntimeError('host_lock_lost')
        return {
            'host_id':host_id,'release':manifest['release'],
            'change_count':plan['change_count'],
            'staged_count':len(stage['staged']),
            'backup_count':len(backup['backups']),
            'backups_verified':backup['verified'],
            'ready_for_activation':False,
            'status':'prepared_only'
        }
