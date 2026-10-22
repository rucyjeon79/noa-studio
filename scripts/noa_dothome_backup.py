"""Private backup preparation for a single host-bound release.

No live activation. Fails closed if backup directory is absent or a target changes.
"""
import hashlib, posixpath, stat
from noa_deploy_hosts import resolve_host
from noa_dothome_manifest import allowed
from noa_dothome_activate import digest_remote

def prepare_backups(profiles,host_id,plan,sftp,lock_held=False):
    host=resolve_host(profiles,host_id)
    if not lock_held or plan.get('host_id')!=host_id or plan.get('activation_allowed') is not False:
        raise ValueError('backup_not_authorized')
    changes=plan.get('changes')
    if not isinstance(changes,list) or len(changes)!=plan.get('change_count'):
        raise ValueError('invalid_plan')
    release=plan.get('release')
    if not isinstance(release,str) or len(release)!=40 or any(c not in '0123456789abcdef' for c in release):
        raise ValueError('invalid_release')
    directory=posixpath.join(host.private_root,'backups',release)
    st=sftp.lstat(directory)
    if not stat.S_ISDIR(st.st_mode):
        raise ValueError('unsafe_backup_directory')
    saved=[]
    for entry in changes:
        path=entry['path']
        if not allowed(path):raise ValueError('unsafe_backup_target')
        live=host.remote_root+'/'+path
        expected=entry['before_sha256']
        if digest_remote(sftp,live)!=expected:
            raise RuntimeError('backup_source_changed')
        if expected is None:
            saved.append({'path':path,'backup':None,'sha256':None})
            continue
        target=posixpath.join(directory,hashlib.sha256(path.encode()).hexdigest()+'.bak')
        try:sftp.lstat(target)
        except FileNotFoundError:pass
        else:raise ValueError('backup_already_exists')
        with sftp.open(live,'rb') as source, sftp.open(target,'xb') as out:
            while True:
                data=source.read(1024*1024)
                if not data:break
                out.write(data)
        if digest_remote(sftp,target)!=expected:
            raise RuntimeError('backup_verification_failed')
        saved.append({'path':path,'backup':target,'sha256':expected})
    return {'host_id':host_id,'release':release,'backups':saved,'verified':True,'activated':False}
