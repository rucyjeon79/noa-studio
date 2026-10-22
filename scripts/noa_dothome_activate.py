"""Host-isolated guarded activation from a verified private SFTP stage.

This module never touches databases, upload queues or GnuBoard core.
"""
import hashlib, posixpath, stat
from noa_deploy_hosts import resolve_host
from noa_dothome_manifest import allowed

def digest_remote(sftp,path):
    try:
        st=sftp.lstat(path)
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(st.st_mode):
        raise ValueError('nonregular_target')
    h=hashlib.sha256()
    with sftp.open(path,'rb') as f:
        while True:
            chunk=f.read(1024*1024)
            if not chunk:break
            h.update(chunk)
    return h.hexdigest()

def activate_release(profiles,host_id,plan,staged,sftp,lock_held=False,backups=None):
    host=resolve_host(profiles,host_id)
    if not lock_held or plan.get('host_id')!=host_id or plan.get('activation_allowed') is not False or staged.get('host_id')!=host_id:
        raise ValueError('activation_not_authorized')
    if plan.get('change_count')!=len(plan.get('changes',[])):
        raise ValueError('invalid_plan')
    if staged.get('activated') is not False:
        raise ValueError('invalid_staged_state')
    if staged.get('release')!=plan.get('release') or not isinstance(plan.get('release'),str) or len(plan['release'])!=40 or any(c not in '0123456789abcdef' for c in plan['release']):
        raise ValueError('release_identity_mismatch')
    if not isinstance(staged.get('staged'),list):
        raise ValueError('invalid_staged_manifest')
    staged_by_path={entry['path']:entry for entry in staged.get('staged',[])}
    if len(staged_by_path)!=len(staged.get('staged',[])):
        raise ValueError('duplicate_staged_file')
    for item in plan['changes']:
        path=item['path']
        if not allowed(path) or path not in staged_by_path:
            raise ValueError('unsafe_activation_path')
        expected_stage=posixpath.join(host.private_root,'staging',plan['release'],hashlib.sha256(path.encode()).hexdigest()+'.stage')
        if staged_by_path[path].get('staged')!=expected_stage:
            raise ValueError('cross_host_staging_path')
        if staged_by_path[path]['sha256']!=item['after_sha256']:
            raise ValueError('staged_digest_mismatch')
        remote=host.remote_root+'/'+path
        if digest_remote(sftp,remote)!=item['before_sha256']:
            raise RuntimeError('concurrent_change_before_activation')
        if digest_remote(sftp,staged_by_path[path]['staged'])!=item['after_sha256']:
            raise RuntimeError('stage_changed')
    # Require an independently verified, host-bound backup for every changed file.
    if not isinstance(backups,dict) or backups.get('verified') is not True or backups.get('host_id')!=host_id or backups.get('release')!=plan.get('release'):
        raise RuntimeError('backup_and_rollback_transaction_required')
    records=backups.get('backups')
    if not isinstance(records,list) or len(records)!=len(plan['changes']):
        raise RuntimeError('backup_coverage_incomplete')
    by_path={entry['path']:entry for entry in records}
    if len(by_path)!=len(records) or set(by_path)!={item['path'] for item in plan['changes']}:
        raise RuntimeError('backup_coverage_incomplete')
    for item in plan['changes']:
        record=by_path[item['path']]
        if record.get('sha256')!=item['before_sha256']:
            raise RuntimeError('backup_digest_mismatch')
        backup=record.get('backup')
        if item['before_sha256'] is None:
            if backup is not None:raise RuntimeError('unexpected_backup')
        elif not isinstance(backup,str) or not backup.startswith(host.private_root+'/backups/'+plan['release']+'/') or digest_remote(sftp,backup)!=item['before_sha256']:
            raise RuntimeError('backup_verification_failed')
    # The host installer must explicitly authorize activation after owning a real lock.
    # Do not treat a caller-supplied lock_held boolean as sufficient authorization.
    raise RuntimeError('host_lock_and_atomic_transaction_required')

def activate_transaction(profiles,host_id,plan,staged,backups,sftp,*,lock=None):
    """Apply a prepared release only while owning its exclusive SFTP lock."""
    from noa_dothome_lock import HostLock
    if not isinstance(lock,HostLock) or lock.sftp is not sftp or lock.host.host_id!=host_id or not lock.owned or not lock.verify():
        raise RuntimeError('host_lock_not_verified')
    lock_proof=lock.verify
    try:
        activate_release(profiles,host_id,plan,staged,sftp,lock_held=True,backups=backups)
    except RuntimeError as error:
        if str(error)!='host_lock_and_atomic_transaction_required':
            raise
    from noa_dothome_rollback import rollback_release
    host=resolve_host(profiles,host_id)
    stage_map={x['path']:x for x in staged['staged']}
    installed=[]
    try:
        for entry in plan['changes']:
            if lock_proof() is not True:
                raise RuntimeError('host_lock_lost')
            name=entry['path']
            live=host.remote_root+'/'+name
            stage=stage_map[name]['staged']
            if digest_remote(sftp,live)!=entry['before_sha256']:
                raise RuntimeError('concurrent_change_before_activation')
            if digest_remote(sftp,stage)!=entry['after_sha256']:
                raise RuntimeError('stage_changed')
            # Atomic rename requires staged and target paths on the same filesystem.
            sftp.posix_rename(stage,live)
            installed.append(name)
            if digest_remote(sftp,live)!=entry['after_sha256']:
                raise RuntimeError('activation_hash_mismatch')
    except Exception as error:
        if installed:
            try:
                rollback_release(profiles,host_id,plan,backups,sftp,installed,lock_held=lock_proof() is True)
            except Exception as rollback_error:
                raise RuntimeError('activation_failed_rollback_incomplete') from rollback_error
        raise
    return {'host_id':host_id,'release':plan['release'],'installed':installed,'activated':True,'postflight_required':True}

