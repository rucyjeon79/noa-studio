"""Read-only source/production comparison. Never reads DB credentials, tokens or user payloads."""
import os,base64,hashlib,json,stat
from pathlib import Path
import paramiko
import noa_sftp_deploy as base
import noa_catalog_deploy as catalog
import noa_lab_deploy as lab
import noa_youtube_deploy as youtube

def main():
    files={**base.FILES,**catalog.FILES,**lab.FILES,**youtube.FILES,
           'bridge/lab-oauth-core.php':'noa-bridge/lab-oauth-core.php',
           'bridge/lab-oauth.php':'noa-bridge/lab-oauth.php'}
    connection=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        connection.get_security_options().key_types=('ssh-ed25519',)
        connection.start_client(timeout=20)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(connection.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('Host key mismatch')
        connection.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        s=paramiko.SFTPClient.from_transport(connection);root='/hosting/noastudio/html'
        if s.normalize(root)!=root:raise RuntimeError('Root mismatch')
        rows=[]
        for local,remote in sorted(files.items()):
            p=Path(local)
            if not p.is_file(): rows.append({'source':local,'remote':remote,'state':'local_generated_bundle_missing'});continue
            expected=hashlib.sha256(p.read_bytes()).hexdigest()
            try:actual=base.digest(s,root+'/'+remote)
            except FileNotFoundError:actual=None
            rows.append({'source':local,'remote':remote,'state':'match' if actual==expected else 'missing' if actual is None else 'different_preserved','source_sha256':expected,'remote_sha256':actual})
        directories={}
        for rel in ['theme','skin/board','skin/member','skin/search','mobile/skin/board','mobile/skin/member','extend','noa-bridge']:
            try:directories[rel]=sorted(s.listdir(root+'/'+rel))
            except FileNotFoundError:directories[rel]=None
        names=sorted(n for n in s.listdir(root) if n.startswith('noa') or n.startswith('setup'))
        deployed=set(files.values())
        report={'source_commit':os.getenv('GITHUB_SHA'),'read_only':True,'comparison':rows,'directories':directories,
                'root_noa_files':names,'unmapped_root_noa_files':[n for n in names if n not in deployed],
                'protected_hashes':{p:base.digest(s,root+'/'+p) for p in base.PROTECTED if base.exists(s,root+'/'+p)},
                'legacy_bundle_source_files':sum(p.is_file() for p in Path('deploy/noastudio').rglob('*'))}
        print('NOA_INVENTORY_JSON='+json.dumps(report,ensure_ascii=False,separators=(',',':')))
    finally:connection.close()
if __name__=='__main__':main()
