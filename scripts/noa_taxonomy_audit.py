"""Read-only business-data audit using the existing fixed authenticated operation.
No deployment, migration, synchronization, restore, media or queue mutations.
Authentication creates only its normal short-lived replay-protection nonce.
"""
import json,os,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect
from noa_taxonomy_release import service

def main():
 t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
 try:
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(256).decode().strip()
  if len(key)!=64:raise RuntimeError('invalid_service_key')
  data=service(key,'verify')
 finally:s.close();t.close()
 status=data.get('status')
 if not status:raise RuntimeError('taxonomy_not_installed')
 latest=json.loads(status['latest'])if isinstance(status['latest'],str)else status['latest']
 result={'checkedAtUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'commit':os.environ.get('GITHUB_SHA'),'businessDataWrites':False,'deployment':False,'inventory':data['inventory'],'classification':latest,'categories':status['counts'],'productionRules':status['productionRules'],'productionRevisions':status['productionRevisions'],'confirmedAutoSongLinks':status['confirmedAutoSongLinks'],'playlistMatchesByType':status['playlistMatchesByType']}
 for path,name in [('/noa-bridge/home.php','home'),('/noa-bridge/taxonomy.php','taxonomy')]:
  with urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=60)as r:p=json.load(r)
  if not p.get('ok'):raise RuntimeError(name+'_api_failed')
  if name=='home':result['home']={k:len(p[k])for k in ['stories','covers','playlists']};result['home']['collectedAt']=p.get('collectedAt')
  else:result['public']={'installed':p.get('installed'),'categories':len(p.get('categories',[])),'videos':len(p.get('videos',[]))}
 if not result['public']['installed']:raise RuntimeError('public_taxonomy_not_installed')
 Path('quality-taxonomy').mkdir(exist_ok=True);Path('quality-taxonomy/current-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print('TAXONOMY_CURRENT_AUDIT '+json.dumps(result,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
