"""Read-only production UI inventory. Never writes server files, SQL or worker state."""
import hashlib,json,os,subprocess
from pathlib import Path
from noa_uiux_release import connect,read,ROOT,PROTECTED,FILES as RELEASE_FILES

FILES=['noa2.php','noa-ui.css','noa-ui.js','noa-design.json','noa-app/home.php','noa-app/world-view.php','noa-world.css','noa-world.js','noa-youtube.php','noa-youtube.css','noa-youtube.js','noa-music.php','noa-music.css','noa-browse.js','noa-hero.js','noa-home.js','noa-my.php','noa-catalog.php','noa-settings.php','noa-ai-lab.php']
FILES+=['theme/noa_studio/head.php','theme/noa_studio/mobile/head.php','theme/noa_studio/skin-bridge.php','noa-theme-admin.php','extend/noa.design.php']
BASE='bd35d0a54069f904429a2bf2aa1e452c73463306'
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 out=Path('uiux-proof/audit');out.mkdir(parents=True,exist_ok=True)
 transport,sftp=connect()
 try:
  rows=[]
  for remote in FILES:
   current=read(sftp,ROOT+'/'+remote)
   source=RELEASE_FILES.get(remote,'deploy/'+remote)
   baseline=subprocess.check_output(['git','show',BASE+':'+source])
   candidate=Path(source).read_bytes()
   row={'path':remote,'productionSha256':sha(current),'baseSha256':sha(baseline),'candidateSha256':sha(candidate),'matchesBase':current==baseline,'matchesCandidate':current==candidate}
   rows.append(row)
   dest=out/'source'/remote;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(current)
  protected={p:sha(read(sftp,ROOT+'/'+p))for p in PROTECTED}
  result={'baseCommit':BASE,'readOnly':True,'serverWrites':False,'sqlWrites':False,'workerInterrupted':False,'files':rows,'protectedCount':len(protected)}
  (out/'inventory.json').write_text(json.dumps(result,indent=2))
  print(json.dumps(result),flush=True)
  if os.environ.get('NOA_UIUX_REQUIRE_MATCH')=='1':
   assert all(r['matchesCandidate'] for r in rows if r['path'] in RELEASE_FILES),'Production UI hash mismatch after live acceptance'
 finally:transport.close()
if __name__=='__main__':main()
