"""Read-only source fingerprints and the existing signed N80 audit; never install anything."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import paramiko
sys.path.insert(0, str(Path(__file__).resolve().parent))
from n80_app_integration import call

ROOT='/hosting/noastudio/html'
FILES=['noa-browse.js','noa-ui.js','noa-ui.css','noa-policy-20261024.css','noa-design.json',
       'noa-my.php','noa-history.js','noa-youtube.php','noa-youtube.js','noa-music.php',
       'noa-app/p0-player.js','noa-app/p0-media.css','noa-app/home.php',
       'noa-app/jukebox/core.php','noa-app/jukebox/upload-core.php','noa-app/jukebox/upload.js',
       'noa-app/jukebox/upload-transport.js','noa-app/jukebox/service.php',
       'noa-world.php','noa-app/world-view.php']
BRIDGE=['youtube-store.php','youtube-core.php','taxonomy-store.php','world-mv.php','home-core.php']
sha=lambda b:hashlib.sha256(b).hexdigest()
def main():
    out=Path('p0-evidence');out.mkdir(exist_ok=True)
    report={'commit':os.environ['GITHUB_SHA'],'run':os.environ['GITHUB_RUN_ID'],
            'serverWrites':0,'sqlMutations':0,'stoppedJobs':0,'rows':[]}
    t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=30)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        with paramiko.SFTPClient.from_transport(t)as s:
            s.get_channel().settimeout(45)
            if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
            def read(p):
                if not stat.S_ISREG(s.lstat(p).st_mode):raise RuntimeError('nonregular_source')
                with s.open(p,'rb')as f:return f.read()
            for rel in FILES+['noa-bridge/'+p for p in BRIDGE]+['extend/noa.design.php']:
                source='deploy/'+rel
                if rel.startswith('noa-bridge/'):source='bridge/'+rel.split('/',1)[1]
                if rel=='extend/noa.design.php':source='deploy/noa-design.extend.php'
                b=read(ROOT+'/'+rel);expected=Path(source).read_bytes()
                report['rows'].append({'path':rel,'bytes':len(b),'sha256':sha(b),'matchesGitHub':b==expected})
            report['uiTemporaryFilesAtRoot']=[x.filename for x in s.listdir_attr(ROOT) if x.filename.startswith('.noa-')and any(tag in x.filename for tag in ['.tmp','.stage','-stage-'])]
            report['folderUsage']={}
            for entry in s.listdir_attr('/hosting/noastudio'):
                if not stat.S_ISDIR(entry.st_mode):continue
                total=0;count=0;stack=['/hosting/noastudio/'+entry.filename]
                while stack:
                    path=stack.pop()
                    for item in s.listdir_attr(path):
                        if stat.S_ISDIR(item.st_mode):stack.append(path+'/'+item.filename)
                        elif stat.S_ISREG(item.st_mode):total+=item.st_size;count+=1
                report['folderUsage'][entry.filename]={'bytes':total,'files':count}
            key=read('/hosting/noastudio/noa-ai-lab/worker.key').strip()
            if len(key)!=64:raise RuntimeError('invalid_service_key')
        started=time.perf_counter();data=call(key);del key
        report['dataAuditMs']=round((time.perf_counter()-started)*1000,1)
        report['dataAudit']=data
        report['sourceMatches']=all(r['matchesGitHub']for r in report['rows'])
        (out/'postflight.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print('NOA_P0_POSTFLIGHT',json.dumps({'sourceFiles':len(report['rows']),'sourceMatches':report['sourceMatches'],'dataIntegrityOk':data.get('integrityOk'),'serverWrites':0}))
    finally:t.close()
if __name__=='__main__':main()
