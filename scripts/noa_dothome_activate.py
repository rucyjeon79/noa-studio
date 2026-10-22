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

def activate_release(profiles,host_id,plan,staged,sftp,lock_held=False):
    host=resolve_host(profiles,host_id)
    if not lock_held or plan.get('host_id')!=host_id or plan.get('activation_allowed') is not False or staged.get('host_id')!=host_id:
        raise ValueError('activation_not_authorized')
    if plan.get('change_count')!=len(plan.get('changes',[])):
        raise ValueError('invalid_plan')
    if staged.get('activated') is not False:
        raise ValueError('invalid_staged_state')
    staged_by_path={entry['path']:entry for entry in staged.get('staged',[])}
    if len(staged_by_path)!=len(staged.get('staged',[])):
        raise ValueError('duplicate_staged_file')
    for item in plan['changes']:
        path=item['path']
        if not allowed(path) or path not in staged_by_path:
            raise ValueError('unsafe_activation_path')
        if staged_by_path[path]['sha256']!=item['after_sha256']:
            raise ValueError('staged_digest_mismatch')
        remote=host.remote_root+'/'+path
        if digest_remote(sftp,remote)!=item['before_sha256']:
            raise RuntimeError('concurrent_change_before_activation')
        if digest_remote(sftp,staged_by_path[path]['staged'])!=item['after_sha256']:
            raise RuntimeError('stage_changed')
    # Activation is intentionally blocked until verified private backup
    # and rollback transaction are wired to this exact host lock.
    raise RuntimeError('backup_and_rollback_transaction_required')
