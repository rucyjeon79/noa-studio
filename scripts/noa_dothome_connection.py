"""DotHome read-only connection verification for one explicitly selected host.

Uses the existing NOA Paramiko SSH/SFTP transport. No file writes.
"""
import base64, hashlib, os, stat
import paramiko
from noa_deploy_hosts import resolve_host

def check_connection(profiles,host_id,*,address,username,password,expected_fingerprint,port=2022):
    host=resolve_host(profiles,host_id)
    if not address or not username or not password or not expected_fingerprint.startswith('SHA256:'):
        raise ValueError('missing_host_connection_configuration')
    if port!=2022:raise ValueError('unapproved_sftp_port')
    transport=paramiko.Transport((address,port))
    try:
        transport.start_client(timeout=20)
        actual='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if actual!=expected_fingerprint:raise RuntimeError('host_key_mismatch')
        transport.auth_password(username,password)
        sftp=paramiko.SFTPClient.from_transport(transport)
        try:
            info=sftp.lstat(host.remote_root)
            if not stat.S_ISDIR(info.st_mode):raise RuntimeError('invalid_web_root')
            if sftp.normalize(host.remote_root)!=host.remote_root:raise RuntimeError('web_root_mismatch')
            return {'host_id':host_id,'connected':True,'remote_root':host.remote_root,'read_only':True}
        finally:sftp.close()
    finally:transport.close()

def check_from_environment(profiles,host_id):
    prefix='NOA_HOST_'+host_id.upper().replace('-','_')+'_'
    keys=('ADDRESS','USERNAME','PASSWORD','FINGERPRINT')
    values=[os.environ.get(prefix+key,'') for key in keys]
    return check_connection(profiles,host_id,address=values[0],username=values[1],password=values[2],expected_fingerprint=values[3])
