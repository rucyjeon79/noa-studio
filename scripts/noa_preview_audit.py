"""Read only the current public catalog projection through existing operator transport."""
import hashlib,json,secrets,time,urllib.request,os
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
 token=secrets.token_hex(32);name='preview-audit-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_preview_audit.php').read_text().replace('NOA_PREVIEW_EXPIRY',str(int(time.time())+600)).replace('NOA_PREVIEW_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest())
 reader=Path('bridge/youtube-catalog.php').read_text().replace('<?php','',1).replace('declare(strict_types=1);','',1) if os.getenv('NOA_PREVIEW_PHASE')=='candidate' else "require_once __DIR__.'/youtube-catalog.php';"
 code=code.replace('/* NOA_CATALOG_READER */',reader).encode()
 t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t)as s:
   s.get_channel().settimeout(45)
   try:
    with s.open(remote,'wx')as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb')as f:assert f.read()==code
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=90)as r:data=json.load(r)
    assert data['ok']
    with urllib.request.urlopen('https://noastudio.ai.kr/noa-category-order.php',timeout=30)as r:data['order']=json.load(r)
    data['sourcePhase']=os.getenv('NOA_PREVIEW_PHASE','live')
    out=Path('preview-proof');out.mkdir(exist_ok=True);(out/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print('PREVIEW_CATALOG_READ',json.dumps(data['sourceCounts']))
    for group in ['your-story','cover-reborn']:
     items=[r for r in data['rows']if r['genre']==group];checks=[r for r in data['checks']if r['genre']==group]
     print(group,json.dumps({'rows':len(items),'playable':sum(bool(r.get('video'))for r in items),'coming':sum(bool(r.get('comingSoon'))for r in items),'canonicalPublicRemoved':sum(r['sourcePublic']and r['removedFromOrdinary']for r in checks),'sample':[c for c in checks if any(r.get('video') for r in c['rows'])][:1]},ensure_ascii=False))
   finally:
    if installed:
     with s.open(remote,'rb')as f:assert f.read()==code
     s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
