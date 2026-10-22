"""Read-only SFTP inventory for one explicitly selected DotHome host."""
import hashlib, stat
from noa_deploy_hosts import resolve_host
from noa_dothome_manifest import allowed

def inspect_targets(profiles,selected_id,paths,sftp):
    host=resolve_host(profiles,selected_id)
    if not isinstance(paths,list) or len(paths)!=len(set(paths)):
        raise ValueError('invalid_target_list')
    observed={}
    for path in paths:
        if not isinstance(path,str) or not allowed(path):
            raise ValueError('unsafe_target')
        remote=host.remote_root+'/'+path
        try:
            info=sftp.lstat(remote)
        except FileNotFoundError:
            observed[path]=None
            continue
        if not stat.S_ISREG(info.st_mode):
            raise ValueError('nonregular_remote_target')
        digest=hashlib.sha256()
        with sftp.open(remote,'rb') as source:
            while True:
                chunk=source.read(1024*1024)
                if not chunk: break
                digest.update(chunk)
        observed[path]=digest.hexdigest()
    return observed
