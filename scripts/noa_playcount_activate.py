"""Enable one backed-up setting with authenticated revision/source CAS; no media changes."""
import base64,hashlib,hmac,json,os,secrets,stat,sys,time,urllib.request
from pathlib import Path
import paramiko
from n80_live_observer import NoRedirect

URL='https://noastudio.ai.kr/noa-bridge/playcount-policy.php'
STATE=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-playcount-activation.json'
SOURCES=['noa-app/jukebox/stream.php','noa-app/jukebox/stream-popularity.php','noa-playcount.js','noa-music.php']
def compact(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def digest(v):return hashlib.sha256(compact(dict(sorted(v.items())))).hexdigest()
def verified_receipt(receipt):
    if (receipt.get('readbackVerified')is not True
            or receipt.get('backupSha256')!='34fcff78ce9aee66461bd89fe9bcb63ddf75365a26ba3f6169ec897b58cdb73b'
            or type(receipt.get('revision'))is not int or receipt['revision']!=1
            or not isinstance(receipt.get('policySha256'),str)or len(receipt['policySha256'])!=64
            or any(c not in '0123456789abcdef' for c in receipt['policySha256'])
            or not isinstance(receipt.get('driveId'),str)or not receipt['driveId']):raise RuntimeError('policy_recovery_not_verified')
def call(key,body):
    raw=compact(body);ts=str(int(time.time()));nonce=secrets.token_hex(16)
    sig=hmac.new(key,('N80-PLAYCOUNT-POLICY-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
    req=urllib.request.Request(URL,data=raw,headers={'Content-Type':'application/json','X-N80-Timestamp':ts,'X-N80-Nonce':nonce,'X-N80-Signature':sig})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=40)as response:
            data=response.read(16385);actual=response.headers.get('X-N80-Signature','')
    except OSError:raise RuntimeError('playcount_policy_request_failed')from None
    expected=hmac.new(key,('N80-PLAYCOUNT-POLICY-RESPONSE-1\n'+nonce+'\n'+hashlib.sha256(data).hexdigest()).encode(),hashlib.sha256).hexdigest()
    if len(data)>16384 or not hmac.compare_digest(actual,expected):raise RuntimeError('policy_response_signature_failed')
    result=json.loads(data)
    if result.get('ok')is not True or result.get('nonce')!=nonce:raise RuntimeError('policy_response_binding_failed')
    out=result['result']
    if out['policySha256']!=digest(out['policy']):raise RuntimeError('policy_response_hash_failed')
    return out
def unchanged_rollback():
    if not STATE.exists():return None
    record=json.loads(STATE.read_text())
    if record.get('changed')is False:
        if record.get('readbackVerified')is not True:raise RuntimeError('unchanged_activation_not_verified')
        result=record|{'rollbackSkipped':True,'changed':False}
        print('NOA_PLAYCOUNT_POLICY_VERIFIED '+json.dumps(result))
        return result
    return None
def activate(key,receipt,sources,rollback=False):
    verified_receipt(receipt)
    if rollback:
        skipped=unchanged_rollback()
        if skipped is not None:return skipped
    before=call(key,{'action':'inspect'})
    if before['sources']!=sources or before['policySha256']!=digest(before['policy'])or before.get('changed')is not False:raise RuntimeError('unverified_playcount_sources')
    if rollback:
        record=json.loads(STATE.read_text())
        if before['revision']!=record['afterRevision']or before['policySha256']!=record['afterPolicySha256']:raise RuntimeError('concurrent_policy_preserved')
        enabled=False
    elif before['policy'].get('playbackIntegrationEnabled')is True:
        baseline=before['policy']|{'playbackIntegrationEnabled':False}
        if (type(before['revision'])is not int or before['revision']<=receipt['revision']
                or digest(baseline)!=receipt['policySha256']):raise RuntimeError('unbacked_policy_change_preserved')
        after=call(key,{'action':'inspect'})
        if (after['revision']!=before['revision']or after['policy']!=before['policy']
                or after['policySha256']!=before['policySha256']or after['sources']!=sources
                or after.get('changed')is not False):raise RuntimeError('policy_activation_readback_failed')
        record={'beforeRevision':before['revision'],'beforePolicySha256':before['policySha256'],
                'afterRevision':after['revision'],'afterPolicySha256':after['policySha256'],
                'backupDriveId':receipt['driveId'],'changedField':'playbackIntegrationEnabled','changed':False,
                'enabled':True,'readbackVerified':True,'otherSettingsPreserved':True,'sources':sources}
        # Preserve an earlier mutation owned by this runner for its rollback.
        owned=json.loads(STATE.read_text())if STATE.exists()else None
        if not (isinstance(owned,dict)and owned.get('changed')is True and owned.get('afterRevision')==after['revision']
                and owned.get('afterPolicySha256')==after['policySha256']and owned.get('sources')==sources):
            STATE.write_text(json.dumps(record))
        else:record['rollbackOwnedByEarlierAttempt']=True
        print('NOA_PLAYCOUNT_POLICY_VERIFIED '+json.dumps(record));return record
    else:
        if before['revision']!=receipt['revision']or before['policySha256']!=receipt['policySha256']or before['policy']['playbackIntegrationEnabled']is not False:raise RuntimeError('unbacked_policy_change_preserved')
        enabled=True
    expected=before['policy']|{'playbackIntegrationEnabled':enabled}
    record={'beforeRevision':before['revision'],'beforePolicySha256':before['policySha256'],'afterRevision':before['revision']+1,'afterPolicySha256':digest(expected),'backupDriveId':receipt['driveId'],'changedField':'playbackIntegrationEnabled','changed':True,'sources':sources}
    if not rollback:STATE.write_text(json.dumps(record))
    changed=call(key,{'action':'set','expectedRevision':before['revision'],'expectedPolicySha256':before['policySha256'],'enabled':enabled,'expectedSources':sources})
    after=call(key,{'action':'inspect'})
    if (after['policy']!=expected or after['revision']!=before['revision']+1 or after['policySha256']!=digest(expected)
            or after['sources']!=sources or not changed['changed']):raise RuntimeError('policy_activation_readback_failed')
    record.update({'enabled':enabled,'readbackVerified':True,'otherSettingsPreserved':True,'sources':sources})
    if not rollback:STATE.write_text(json.dumps(record))
    print('NOA_PLAYCOUNT_POLICY_VERIFIED '+json.dumps(record));return record
def main():
    rollback=sys.argv[1:]==['rollback']
    if sys.argv[1:]and not rollback:raise RuntimeError('unsupported_action')
    receipt=json.loads(Path('scripts/noa_playcount_policy_drive_receipt.json').read_text())
    verified_receipt(receipt)
    if rollback and unchanged_rollback()is not None:return
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',);transport.start_client(timeout=25)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        with paramiko.SFTPClient.from_transport(transport)as sftp:
            path='/hosting/noastudio/noa-ai-lab/worker.key'
            if sftp.normalize(path)!=path or not stat.S_ISREG(sftp.lstat(path).st_mode):raise RuntimeError('unsafe_service_key')
            with sftp.open(path,'rb')as source:key=source.read(129).strip()
    finally:transport.close()
    sources={p:hashlib.sha256((Path('deploy')/p).read_bytes()).hexdigest()for p in SOURCES}
    activate(key,receipt,sources,rollback)
if __name__=='__main__':main()
