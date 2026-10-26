"""Read native board configuration and source code through the existing pinned transport."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
 out=Path('community-proof');out.mkdir(exist_ok=True)
 token=secrets.token_hex(32);name='community-inventory-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_community_inventory.php').read_text().replace('NOA_COMMUNITY_EXPIRY',str(int(time.time())+600)).replace('NOA_COMMUNITY_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
 t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t)as s:
   s.get_channel().settimeout(45)
   try:
    with s.open(remote,'wx')as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb')as f:assert f.read()==code
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=60)as r:data=json.load(r)
    assert data['ok'];(out/'inventory.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    files=['bbs/board.php','bbs/view.php','bbs/write.php','bbs/write_update.php','bbs/write_comment_update.php','bbs/password.php','bbs/password_check.php','bbs/download.php','bbs/search.php','bbs/rss.php','adm/board_form_update.php','adm/sql_write.sql','lib/common.lib.php']
    hashes={}
    for name in files:
     try:
      with s.open(ROOT+'/'+name,'rb')as f:source=f.read()
     except FileNotFoundError:continue
     p=out/'native-source'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(source);hashes[name]=hashlib.sha256(source).hexdigest()
    (out/'native-source-hashes.json').write_text(json.dumps(hashes,indent=2));print('COMMUNITY_NATIVE_INVENTORY',json.dumps({'version':data['version'],'boards':[{k:b[k]for k in ['bo_table','bo_subject','bo_count_write','bo_read_level','bo_use_secret']}for b in data['boards']],'readSourceFiles':len(hashes),'databaseWrites':0},ensure_ascii=False))
   finally:
    if installed:
     with s.open(remote,'rb')as f:assert f.read()==code
     s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
