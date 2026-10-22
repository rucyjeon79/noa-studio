"""Safely stage an approved host-bound release using an existing SFTP connection.

Staging only. No live file activation or DB changes.
"""
import hashlib, posixpath, stat
from noa_deploy_hosts import resolve_host
from noa_dothome_manifest import allowed

def stage_release(profiles, host_id, manifest, payloads, sftp):
    host=resolve_host(profiles,host_id)
    if manifest.get('schema')!=1 or manifest.get('host_id')!=host_id or manifest.get('activate') is not False:
        raise ValueError('invalid_host_manifest')
    release=manifest.get('release')
    if not isinstance(release,str) or len(release)!=40 or any(c not in '0123456789abcdef' for c in release):
        raise ValueError('invalid_release_id')
    files=manifest.get('files')
    if not isinstance(files,list) or not files:
        raise ValueError('invalid_file_list')
    if set(payloads)!=set(x.get('path') for x in files):
        raise ValueError('payload_manifest_mismatch')
    verified=[]
    for item in files:
        name=item['path']
        if not allowed(name) or not isinstance(payloads[name],bytes):
            raise ValueError('unsafe_payload')
        data=payloads[name]
        if len(data)!=item.get('bytes') or hashlib.sha256(data).hexdigest()!=item.get('sha256'):
            raise ValueError('payload_hash_mismatch')
        verified.append((name,data))
    stage_root=posixpath.join(host.private_root,'staging',release)
    # Existing private directory must be provisioned by host administrator.
    # Never create directories, change live files, or follow a staged symlink.
    st=sftp.lstat(stage_root)
    if not stat.S_ISDIR(st.st_mode):
        raise ValueError('unsafe_staging_directory')
    results=[]
    for name,data in verified:
        # Flat SHA-derived names avoid directory traversal and per-file mkdir.
        remote=posixpath.join(stage_root,hashlib.sha256(name.encode()).hexdigest()+'.stage')
        try:
            sftp.lstat(remote)
        except FileNotFoundError:
            pass
        else:
            raise ValueError('staging_target_exists')
        with sftp.open(remote,'xb') as out:
            out.write(data)
        info=sftp.lstat(remote)
        if not stat.S_ISREG(info.st_mode) or info.st_size!=len(data):
            raise RuntimeError('staging_verification_failed')
        with sftp.open(remote,'rb') as source:
            if hashlib.sha256(source.read()).digest()!=hashlib.sha256(data).digest():
                raise RuntimeError('staging_verification_failed')
        results.append({'path':name,'staged':remote,'sha256':hashlib.sha256(data).hexdigest()})
    return {'host_id':host_id,'release':release,'staged':results,'activated':False}
