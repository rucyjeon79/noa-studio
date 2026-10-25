"""Read-only allowlist/source checks and N80 work-state observation for this release."""
import hashlib,json,subprocess,sys
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from n80_workstate_sync import request
FILES={'noa-app/world-view.php':'deploy/noa-app/world-view.php','noa-app/home.php':'deploy/noa-app/home.php','noa-browse.js':'deploy/noa-browse.js','noa-music.php':'deploy/noa-music.php','noa-youtube.php':'deploy/noa-youtube.php'}
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 post='--post' in sys.argv
 result={'phase':'post' if post else 'pre','files':{}}
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   for remote,local in FILES.items():
    with s.open(ROOT+'/'+remote,'rb') as f:actual=sha(f.read())
    expected=sha(Path(local).read_bytes())
    if post:
     if actual!=expected:raise RuntimeError('deployed_source_mismatch:'+remote)
    else:
     commits=subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines()
     known={sha(subprocess.check_output(['git','show',c+':'+local])):c for c in commits}
     if actual not in known:raise RuntimeError('unknown_remote_source_preserved:'+remote)
    result['files'][remote]={'actual':actual,'expected':expected,'match':actual==expected,'restoreCommit':None if post else known[actual]}
   if not post:
    with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:key=f.read(129).strip()
    if len(key)!=64:raise RuntimeError('invalid_worker_key')
    state=request(key,{'action':'read'})
    result['n80']={'readOnly':True,'summary':state.get('summary'),'revision':state.get('state',{}).get('revision')}
 finally:t.close()
 out=Path('initial-flash-proof');out.mkdir(exist_ok=True)
 (out/('source-'+result['phase']+'.json')).write_text(json.dumps(result,indent=2)+'\n')
 print('NOA_INITIAL_SOURCE_VERIFIED '+json.dumps(result))
if __name__=='__main__':main()
