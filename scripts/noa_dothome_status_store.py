"""Persist a verified release receipt to a host-private status file.

Requires an owned HostLock and refuses concurrent status changes.
No public-web-root writes or arbitrary target paths.
"""
import hashlib, json, posixpath, stat
from noa_deploy_hosts import resolve_host
from noa_dothome_lock import HostLock

def _read_status(sftp, path):
    try:
        info=sftp.lstat(path)
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(info.st_mode) or info.st_size>65536:
        raise ValueError('unsafe_status_file')
    with sftp.open(path,'rb') as f:
        return f.read(65537)

def persist_receipt(profiles,host_id,receipt,sftp,lock,expected_previous_sha256=None):
    host=resolve_host(profiles,host_id)
    if not isinstance(lock,HostLock) or lock.host.host_id!=host_id or lock.sftp is not sftp or not lock.verify():
        raise RuntimeError('status_lock_not_owned')
    if receipt.get('private_destination')!=host.state_file or receipt.get('persisted') is not False:
        raise ValueError('receipt_destination_mismatch')
    record=receipt.get('record')
    if not isinstance(record,dict) or record.get('host_id')!=host_id or record.get('status')!='verified':
        raise ValueError('invalid_receipt')
    canonical=json.dumps(record,sort_keys=True,separators=(',',':')).encode()
    if hashlib.sha256(canonical).hexdigest()!=receipt.get('receipt_sha256'):
        raise ValueError('receipt_hash_mismatch')
    if expected_previous_sha256 is not None and (not isinstance(expected_previous_sha256,str) or len(expected_previous_sha256)!=64):
        raise ValueError('invalid_expected_status_hash')
    target=host.state_file
    previous=_read_status(sftp,target)
    previous_hash=hashlib.sha256(previous).hexdigest() if previous is not None else None
    if previous_hash!=expected_previous_sha256:
        raise RuntimeError('concurrent_status_change')
    data=json.dumps(record,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()+b'\n'
    if len(data)>65536:raise ValueError('status_too_large')
    temp=posixpath.join(host.private_root,'.receipt-'+record['release']+'.tmp')
    try:
        sftp.lstat(temp)
    except FileNotFoundError:
        pass
    else:
        raise RuntimeError('status_temp_exists')
    with sftp.open(temp,'xb') as f:
        f.write(data)
    try:
        if not lock.verify() or _read_status(sftp,target)!=previous:
            raise RuntimeError('status_changed_before_commit')
        if _read_status(sftp,temp)!=data:
            raise RuntimeError('status_temp_verify_failed')
        sftp.posix_rename(temp,target)
    except Exception:
        try:
            if _read_status(sftp,temp)==data:sftp.remove(temp)
        except Exception:
            pass
        raise
    if _read_status(sftp,target)!=data:
        raise RuntimeError('status_postcommit_verify_failed')
    return {'host_id':host_id,'release':record['release'],'persisted':True,'status_sha256':hashlib.sha256(data).hexdigest()}
