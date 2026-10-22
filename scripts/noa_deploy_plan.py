"""Pure release planning for DotHome host-first deployment.

Only compares allowlisted manifest entries against supplied observed hashes.
No network, file writes or deployment operations.
"""
import re
from noa_deploy_hosts import resolve_host

DIGEST=re.compile(r'^[a-f0-9]{64}$')

def plan_release(profiles,selected_id,manifest,observed):
    host=resolve_host(profiles,selected_id)
    if manifest.get('schema')!=1 or manifest.get('activate') is not False:
        raise ValueError('invalid_manifest_contract')
    if manifest.get('host_id')!=host.host_id:
        raise ValueError('release_host_mismatch')
    if not isinstance(manifest.get('files'),list):
        raise ValueError('invalid_file_list')
    changes=[]
    seen=set()
    for item in manifest['files']:
        name=item.get('path')
        digest=item.get('sha256')
        if not isinstance(name,str) or not isinstance(digest,str) or not DIGEST.fullmatch(digest):
            raise ValueError('invalid_file_entry')
        if name in seen:
            raise ValueError('duplicate_target')
        seen.add(name)
        old=observed.get(name)
        if old is not None and (not isinstance(old,str) or not DIGEST.fullmatch(old)):
            raise ValueError('invalid_server_hash')
        if old!=digest:
            changes.append({'path':name,'before_sha256':old,'after_sha256':digest})
    return {'host_id':host.host_id,'environment':host.environment,'changes':changes,'change_count':len(changes),'requires_backup':bool(changes),'activation_allowed':False}
