"""Verify live file hashes and public routes, then persist a host-private receipt.

This function does not activate files. It runs only after a separate guarded
activation and while the same host's SFTP lock remains owned.
"""
from datetime import datetime, timezone
from noa_deploy_hosts import resolve_host
from noa_dothome_lock import HostLock
from noa_dothome_activate import digest_remote
from noa_dothome_postflight import verify_public_routes
from noa_dothome_receipt import make_receipt
from noa_dothome_status_store import persist_receipt

def finalize_release(profiles,host_id,transaction,plan,sftp,lock,origin,paths,expected_previous_sha256=None,opener=None):
    host=resolve_host(profiles,host_id)
    if not isinstance(lock,HostLock) or lock.sftp is not sftp or lock.host.host_id!=host_id or not lock.verify():
        raise RuntimeError('finalize_lock_not_owned')
    if transaction.get('host_id')!=host_id or plan.get('host_id')!=host_id or transaction.get('release')!=plan.get('release'):
        raise ValueError('finalize_release_mismatch')
    if transaction.get('activated') is not True or transaction.get('postflight_required') is not True:
        raise ValueError('unverified_activation')
    expected={item['path']:item['after_sha256'] for item in plan.get('changes',[])}
    if set(expected)!=set(transaction.get('installed',[])):
        raise ValueError('incomplete_activation')
    verified={}
    for name,digest in expected.items():
        actual=digest_remote(sftp,host.remote_root+'/'+name)
        if actual!=digest:raise RuntimeError('live_file_hash_mismatch')
        verified[name]=actual
    result=verify_public_routes(origin,paths,opener=opener)
    if not result['ok']:raise RuntimeError('postflight_failed')
    if not lock.verify():raise RuntimeError('finalize_lock_lost')
    receipt=make_receipt(profiles,host_id,transaction,result,verified,datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
    return persist_receipt(profiles,host_id,receipt,sftp,lock,expected_previous_sha256)
