"""Build a verified, host-bound deployment receipt without writing production state."""
import hashlib,json,re
from noa_deploy_hosts import resolve_host

SHA40=re.compile(r'^[0-9a-f]{40}$')
SHA64=re.compile(r'^[0-9a-f]{64}$')

def make_receipt(profiles,host_id,transaction,postflight,verified_files,applied_at):
    host=resolve_host(profiles,host_id)
    release=transaction.get('release')
    if transaction.get('host_id')!=host_id or transaction.get('activated') is not True or transaction.get('postflight_required') is not True:
        raise ValueError('unverified_transaction')
    if not isinstance(release,str) or not SHA40.fullmatch(release):
        raise ValueError('invalid_release_id')
    if postflight.get('ok') is not True or not postflight.get('routes') or not all(x.get('ok') is True for x in postflight['routes']):
        raise ValueError('postflight_incomplete')
    if not isinstance(verified_files,dict) or set(verified_files)!=set(transaction.get('installed',[])):
        raise ValueError('file_verification_incomplete')
    if any(not isinstance(value,str) or not SHA64.fullmatch(value) for value in verified_files.values()):
        raise ValueError('invalid_file_digest')
    if not isinstance(applied_at,str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',applied_at):
        raise ValueError('invalid_timestamp')
    record={'schema':1,'host_id':host.host_id,'environment':host.environment,
            'release':release,'status':'verified','applied_at':applied_at,
            'files':dict(sorted(verified_files.items())),
            'checked_routes':[x['path'] for x in postflight['routes']]}
    canonical=json.dumps(record,sort_keys=True,separators=(',',':')).encode()
    return {'record':record,'receipt_sha256':hashlib.sha256(canonical).hexdigest(),
            'private_destination':host.state_file,'persisted':False}
