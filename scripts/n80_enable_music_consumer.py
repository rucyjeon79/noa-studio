"""Activate only the deployed MUSIC availability verifier; no SQL or queue writes."""
import base64, hashlib, json, os, stat, sys
from pathlib import Path
import paramiko
from n80_guardian_remote_audit import compare_sources
from n80_live_observer import MUSIC_BASE, MUSIC_POLICY, MUSIC_EFFECT, compact, music_consumer_policy

VALUE=compact({'version':1,'enabled':True,'exactConsumer':MUSIC_EFFECT})
STATE=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'n80-music-activation.json'

def activate(sftp):
    if not compare_sources(sftp)['allMatch']:
        raise RuntimeError('consumer_source_not_deployed')
    parent='/hosting/noastudio/noa-ai-lab'
    for path in [parent,MUSIC_BASE,MUSIC_BASE+'/events',MUSIC_BASE+'/leases']:
        try: info=sftp.lstat(path)
        except FileNotFoundError:
            if path==parent:raise RuntimeError('private_parent_missing')
            try:sftp.mkdir(path,0o700)
            except OSError:pass
            info=sftp.lstat(path)
        if not stat.S_ISDIR(info.st_mode) or sftp.normalize(path)!=path or (path!=parent and stat.S_IMODE(info.st_mode)!=0o700):
            raise RuntimeError('unsafe_consumer_directory')
    policy=music_consumer_policy(sftp)
    if policy.get('enabled'):
        return {'created':False,'alreadyEnabled':True,'policySha256':policy['policySha256']}
    if policy.get('reason')!='policy_missing':
        raise RuntimeError('existing_consumer_policy_preserved')
    owned=False
    try:
        with sftp.open(MUSIC_POLICY,'wx') as output:
            owned=True;output.write(VALUE);output.flush()
        sftp.chmod(MUSIC_POLICY,0o600)
        check=music_consumer_policy(sftp)
        if not check.get('enabled') or check['policySha256']!=hashlib.sha256(VALUE).hexdigest():
            raise RuntimeError('consumer_policy_readback_failed')
        return {'created':True,'policySha256':check['policySha256'],'readbackVerified':True}
    except Exception:
        if owned:
            with sftp.open(MUSIC_POLICY,'rb') as source: current=source.read(1025)
            if VALUE.startswith(current):sftp.remove(MUSIC_POLICY)
        raise

def main():
    rollback=sys.argv[1:]==['rollback']
    if sys.argv[1:] and not rollback:raise RuntimeError('unsupported_action')
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',);transport.start_client(timeout=25)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            if rollback:
                record=json.loads(STATE.read_text())
                if record.get('created'):
                    with sftp.open(MUSIC_POLICY,'rb') as source:current=source.read(1025)
                    if current!=VALUE:raise RuntimeError('changed_consumer_policy_preserved')
                    sftp.remove(MUSIC_POLICY)
                print('N80_CONSUMER_ACTIVATION_REVERTED_DURABLE_EVIDENCE_PRESERVED')
            else:
                result=activate(sftp);STATE.write_text(json.dumps(result))
                print('N80_EXACT_CONSUMER_POLICY_VERIFIED '+json.dumps(result))
    finally:transport.close()

if __name__=='__main__':main()
