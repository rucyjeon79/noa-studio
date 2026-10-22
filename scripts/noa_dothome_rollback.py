"""Host-bound conditional rollback for an already verified deployment transaction."""
from noa_deploy_hosts import resolve_host
from noa_dothome_manifest import allowed
from noa_dothome_activate import digest_remote

def rollback_release(profiles,host_id,plan,backups,sftp,installed,lock_held=False):
    host=resolve_host(profiles,host_id)
    if not lock_held or plan.get('host_id')!=host_id or backups.get('host_id')!=host_id or backups.get('release')!=plan.get('release') or backups.get('verified') is not True:
        raise ValueError('rollback_not_authorized')
    originals={item['path']:item for item in backups.get('backups',[])}
    planned={item['path']:item for item in plan.get('changes',[])}
    if len(originals)!=len(backups.get('backups',[])) or len(planned)!=len(plan.get('changes',[])):
        raise ValueError('duplicate_rollback_target')
    restored=[]
    for path in reversed(installed):
        if path not in planned or path not in originals or not allowed(path):
            raise ValueError('unplanned_rollback_target')
        live=host.remote_root+'/'+path
        if digest_remote(sftp,live)!=planned[path]['after_sha256']:
            raise RuntimeError('rollback_concurrent_change')
        old=originals[path]
        if old['sha256'] is None:
            sftp.remove(live)
        else:
            backup=old['backup']
            if not isinstance(backup,str) or not backup.startswith(host.private_root+'/backups/'+plan['release']+'/') or digest_remote(sftp,backup)!=old['sha256']:
                raise RuntimeError('rollback_backup_corrupt')
            # Preserve immutable backup: write a separate recovery file and swap it.
            recovery=host.private_root+'/staging/'+plan['release']+'/'+__import__('hashlib').sha256((path+'-rollback').encode()).hexdigest()+'.restore'
            try:sftp.lstat(recovery)
            except FileNotFoundError:pass
            else:raise RuntimeError('rollback_temp_exists')
            with sftp.open(backup,'rb') as source,sftp.open(recovery,'xb') as dest:
                while True:
                    chunk=source.read(1024*1024)
                    if not chunk:break
                    dest.write(chunk)
            if digest_remote(sftp,recovery)!=old['sha256']:
                raise RuntimeError('rollback_copy_failed')
            sftp.posix_rename(recovery,live)
        if digest_remote(sftp,live)!=old['sha256']:
            raise RuntimeError('rollback_verify_failed')
        restored.append(path)
    return {'host_id':host_id,'restored':restored,'success':True}
