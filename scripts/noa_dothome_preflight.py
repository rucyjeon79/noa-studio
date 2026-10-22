"""Host-specific read-only planning using the existing SFTP connection."""
from noa_deploy_hosts import resolve_host
from noa_deploy_plan import plan_release
from noa_dothome_inventory import inspect_targets

def inspect_and_plan(profiles, selected_id, manifest, sftp):
    host=resolve_host(profiles,selected_id)
    if manifest.get('host_id')!=host.host_id:
        raise ValueError('release_host_mismatch')
    paths=[entry['path'] for entry in manifest['files']]
    observed=inspect_targets(profiles,selected_id,paths,sftp)
    result=plan_release(profiles,selected_id,manifest,observed)
    result['observed_file_count']=len(observed)
    result['mode']='read_only'
    return result
