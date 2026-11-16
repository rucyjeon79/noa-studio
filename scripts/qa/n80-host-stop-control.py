#!/usr/bin/env python3
"""Emergency authorized N80 scheduler-stop latch via pinned SFTP.
Requires independently verified encrypted Google Drive preimage, SHA CAS,
installed runner stop-flag compatibility, and source revision 392.
Only modifies /hosting/noastudio/noa-hub/control.json.
Never modifies source.json, release history, users, DB, audio or PHP files.
"""
import base64, hashlib, json, os, secrets, stat, time
import paramiko

PIN='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
ROOT='/hosting/noastudio/noa-hub'
TARGET=ROOT+'/control.json'
EXPECTED_PREIMAGE='31b578ca4f7e1c2a297f7991481a9ae844e543f2c97c3512a9bbe0197d380e06'
EXPECTED_RUNNER='946e0d84a6b14dbb72ecf1cc75b936d1a98623df78a764be285e5d3b2ed032ed'
EXPECTED_CONTROL_REV=16
EXPECTED_SOURCE_REV=392
BACKUP_DRIVE_ID='1Z8g8c--FHvlloTqn0kKvuWOgJYvLFUk6'
if os.environ.get('N80_PREIMAGE_DRIVE_ID')!=BACKUP_DRIVE_ID:
 raise RuntimeError('google_drive_preimage_not_confirmed')
sha=lambda b:hashlib.sha256(b).hexdigest()
transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
temp=None
try:
 transport.get_security_options().key_types=('ssh-ed25519',)
 transport.start_client(timeout=20)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!=PIN:raise RuntimeError('host_identity_mismatch')
 transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
 s=paramiko.SFTPClient.from_transport(transport)
 s.get_channel().settimeout(30)
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('host_runtime_root_mismatch')
 def read(path,limit=65536):
  st=s.lstat(path)
  if not stat.S_ISREG(st.st_mode) or st.st_size>limit:raise RuntimeError('unsafe_regular_file')
  with s.open(path,'rb') as file:raw=file.read(limit+1)
  if len(raw)>limit or len(raw)!=st.st_size:raise RuntimeError('file_read_incomplete')
  return raw
 runner=read(ROOT+'/runtime/runner.mjs',200000)
 if sha(runner)!=EXPECTED_RUNNER or b"read('control.json').stop===true" not in runner:
  raise RuntimeError('runtime_stop_semantics_unverified')
 source=json.loads(read(ROOT+'/source.json'))
 if source.get('revision')!=EXPECTED_SOURCE_REV:raise RuntimeError('source_revision_changed')
 original=read(TARGET)
 if sha(original)!=EXPECTED_PREIMAGE:raise RuntimeError('source_control_preimage_changed')
 control=json.loads(original)
 if sorted(control)!=['activeOperations','migrations','paused','revision','stop']:
  raise RuntimeError('control_schema_changed')
 if control.get('revision')!=EXPECTED_CONTROL_REV or control.get('paused') is not False or control.get('stop') is not False:
  raise RuntimeError('already_stopped_or_unexpected_control_revision')
 if not isinstance(control.get('activeOperations'),list) or not isinstance(control.get('migrations'),dict):
  raise RuntimeError('invalid_nested_control_types')
 # Do not erase the operation list or migration history. This is a reversible stop latch.
 control['stop']=True
 control['paused']=True
 control['revision']=EXPECTED_CONTROL_REV+1
 output=json.dumps(control,ensure_ascii=False,separators=(',',':')).encode('utf8')
 if json.loads(output).get('migrations')!=json.loads(original).get('migrations'):
  raise RuntimeError('migration_history_changed')
 temp=TARGET+'.n80-stop-'+secrets.token_hex(8)+'.tmp'
 with s.open(temp,'wx') as f:
  f.write(output)
  f.flush()
 s.chmod(temp,0o600)
 if read(temp)!=output:raise RuntimeError('staged_content_verification_failed')
 if sha(read(TARGET))!=EXPECTED_PREIMAGE:raise RuntimeError('control_changed_during_staging')
 # Never fall back to non-atomic truncate; production is shared with the runner.
 try:
  s.posix_rename(temp,TARGET)
  temp=None
 except (OSError,IOError):
  raise RuntimeError('atomic_replace_not_supported_no_control_write')
 final=read(TARGET)
 if final!=output or json.loads(final).get('stop') is not True or json.loads(final).get('paused') is not True:
  raise RuntimeError('readback_mismatch_check_host')
 time.sleep(12)
 try:
  lock=s.lstat(ROOT+'/runner.lock')
  still_locked=stat.S_ISDIR(lock.st_mode)
 except OSError:still_locked=False
 report={'status':'stop_latch_saved','backupDriveId':BACKUP_DRIVE_ID,
  'controlBeforeSha256':EXPECTED_PREIMAGE,'controlAfterSha256':sha(final),
  'controlRevisionBefore':EXPECTED_CONTROL_REV,'controlRevisionAfter':control['revision'],
  'stop':True,'paused':True,'globalSourceRevisionUnchanged':source['revision'],
  'activeOperationCountPreserved':len(control['activeOperations']),
  'runnerLockPresentAfter12Sec':still_locked,'verifiedProcessExit':not still_locked,
  'hostWrites':['control.json ONLY'],'restorationRequiresOwnerApproval':True}
 print('N80_SAFE_STOP_RESULT='+json.dumps(report,separators=(',',':')))
finally:
 if temp is not None:
  try:s.remove(temp)
  except Exception:pass
 transport.close()
