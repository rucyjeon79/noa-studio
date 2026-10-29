"""Reuse signed N80 and P0 read protocols; no business or file mutations."""
import collections
import hashlib
import json
import os
import time
from pathlib import Path
import paramiko
from noa_full_inventory import connect, mappings, ROOT
from noa_p0_inventory import inventory
from n80_workstate_sync import request
from noa_jukebox_recovery import signed_service

OUT = Path('p0-current-proof')

def main():
    OUT.mkdir(exist_ok=True)
    report = {'commit': os.environ['GITHUB_SHA'], 'runUrl': 'https://github.com/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs/'+os.environ['GITHUB_RUN_ID'], 'checkedAtUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()), 'databaseWrites':0, 'applicationFilesWritten':0, 'completionClaimed':False}
    t = connect()
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as f:
                key=f.read(129).strip()
            if len(key)!=64: raise RuntimeError('invalid_worker_key')
            # Hash the runtime surfaces named by the directive; never replace them.
            names={'noa-music.php','noa-youtube.php','noa-world.php','noa-my.php','noa-sitemap.php','noa-ui.css','noa-ui.js','noa-browse.js','noa-browse-edit.js','noa-app/p0-player.js','noa-app/p0-media.css','noa-app/home.php','noa-app/jukebox/stream.php','noa-app/jukebox/core.php','noa-app/jukebox/upload.php','noa-app/jukebox/upload.js','noa-app/jukebox/queue-core.php','noa-app/jukebox/operations.php','noa-app/engine/work-state.php','noa-bridge/ainoa-generation.php','noa-bridge/package-record.php','noa-bridge/member-access.php','noa-bridge/music-readmodel.php','noa-bridge/catalog-store.php','noa-bridge/category-order-store.php'}
            rows=[]
            for remote,local in mappings().items():
                if remote not in names: continue
                expected=hashlib.sha256(Path(local).read_bytes()).hexdigest()
                try:
                    with s.open(ROOT+'/'+remote,'rb') as f: actual=hashlib.sha256(f.read()).hexdigest()
                    state='match' if actual==expected else 'different'
                except FileNotFoundError: actual=None;state='missing'
                rows.append({'source':local,'url':'https://noastudio.ai.kr/'+remote,'sourceSha256':expected,'operatingSha256':actual,'state':state})
            report['runtimeFiles']=rows
    finally:t.close()
    (OUT/'source.json').write_text(json.dumps(report,indent=2))
    # Persist bounded aggregates only, never lyrics, private member data or credentials.
    data=inventory(key)
    report['database']={k:data.get(k) for k in ['documents','kinds','tableEngines','catalogBatch','catalogRecords','fieldStats','aiSettings'] if k in data}
    comparison=data.get('archiveComparison',{})
    report['sourceComparison']={'matchedDocuments':comparison.get('matchedDocuments'),'missingFields':len(comparison.get('sourceFieldMissing',[])),'differentFields':len(comparison.get('sourceFieldDifferent',[]))}
    state=request(key,{'action':'read'})
    report['n80']={'revision':state['state']['revision'],'allAreasComplete':state['summary']['allAreasComplete'],'areas':state['summary']['areas'],'instructionCount':len(state['state']['instructions'])}
    call=signed_service(key.decode());health=call('runtime_health');queue=call('queue_snapshot')
    report['queue']={'queued':health['queued'],'active':health['active'],'worker':health['worker'],'statuses':dict(collections.Counter(x['status']for x in queue['rows']))}
    report['integrity']=call('integrity_snapshot')
    (OUT/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('P0_CURRENT_AUDIT',json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
