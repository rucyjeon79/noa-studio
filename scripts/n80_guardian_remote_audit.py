"""N80 Guardian read-only production drift audit. No worker execution or writes."""
import os,stat,base64,hashlib,json
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
FILES=[
'noa-app/engine/registry.php','noa-app/engine/identity.php',
'noa-app/engine/health.php','noa-app/engine/router.php',
'noa-app/engine/workflow.php','noa-app/engine/bridge.php',
'noa-app/engine/guardian.php','noa-app/engine/policy.php',
'noa-app/engine/n80.php','noa-app/engine/readiness.php',
'noa-app/engine/adapter-contract.php','noa-app/engine/dispatch-gate.php',
'noa-app/engine/executor.php','noa-app/engine/inbox.php',
'noa-app/engine/outbox.php','noa-app/engine/durable-store.php',
'noa-app/engine/lease-inbox.php','noa-app/engine/integration-audit.php',
'noa-app/engine/event-contract.php',
'noa-app/engine/lease-state.php','noa-app/engine/music-adapter.php',
'noa-app/engine/authenticated-probe.php',
'noa-app/engine/readonly-pipeline.php']
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
    keys=['NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT']
    if any(not os.getenv(k) for k in keys):raise RuntimeError('missing_config')
    t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not t.is_authenticated():raise RuntimeError('authentication_failed')
        s=paramiko.SFTPClient.from_transport(t)
        try:
            if s.normalize(ROOT)!=ROOT:raise RuntimeError('root_mismatch')
            rows=[]
            for relative in FILES:
                local=Path('deploy')/relative
                if not local.is_file():raise RuntimeError('source_missing:'+relative)
                expected=digest(local.read_bytes())
                try:
                    st=s.lstat(ROOT+'/'+relative)
                    if not stat.S_ISREG(st.st_mode):state='nonregular'
                    else:
                        with s.open(ROOT+'/'+relative,'rb') as f:actual=digest(f.read())
                        state='match' if actual==expected else 'different'
                except FileNotFoundError:state='missing'
                rows.append({'module':relative,'state':state})
        finally:s.close()
    finally:t.close()
    summary={'engine':'N80 ENGINE','audit':'remote_source_drift','rows':rows,'allMatch':all(x['state']=='match' for x in rows)}
    print('N80_GUARDIAN_REMOTE_AUDIT',json.dumps(summary))
    if not summary['allMatch']:raise RuntimeError('production_drift_detected')
if __name__=='__main__':main()
