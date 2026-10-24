"""Rebuild the exact Drive-verified policy from its existing runner observation."""
import hashlib,json,os
from pathlib import Path
root=Path(os.environ['NOA_POLICY_ARTIFACT'])
paths=list(root.rglob('hourly.json'))
if len(paths)!=1:raise RuntimeError('policy_artifact_ambiguous')
policy=json.loads(paths[0].read_text())['verification']['policy']
digest=hashlib.sha256(json.dumps(policy['values'],ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()).hexdigest()
record={'table':'noa_popularity_settings','id':1,'policy':policy,'policySha256':digest,'sourceRun':40085464057,'sourceArtifact':12556464389,'restoreScope':'policy values and revision, no catalog/member/queue mutation'}
raw=(json.dumps(record,ensure_ascii=False,indent=2)+'\n').encode()
if hashlib.sha256(raw).hexdigest()!='34fcff78ce9aee66461bd89fe9bcb63ddf75365a26ba3f6169ec897b58cdb73b':raise RuntimeError('drive_verified_policy_backup_mismatch')
Path(os.environ['NOA_POLICY_BACKUP_FILE']).write_bytes(raw)
print('DRIVE_VERIFIED_POLICY_RECONSTRUCTED_FOR_ISOLATED_SQL_RESTORE')
