"""Read enrollment capabilities and installed native contracts; no member data exported."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect
def main():
 out=Path('creator-proof/inventory');out.mkdir(parents=True,exist_ok=True)
 token=secrets.token_hex(32);name='creator-inventory-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_creator_inventory.php').read_text().replace('NOA_CREATOR_EXPIRY',str(int(time.time())+600)).replace('NOA_CREATOR_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
 t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:data=json.load(r)
    assert data['ok'];(out/'capabilities.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    for path in ['bbs/register_form_update.php','bbs/register_form.php','skin/member/basic/register_form.skin.php','lib/common.lib.php','adm/sql_write.sql','js/certify.js','plugin/kcpcert/kcpcert_result.php','plugin/okname/hpcert2.php']:
     try:
      with s.open(ROOT+'/'+path,'rb') as f:raw=f.read()
     except FileNotFoundError:continue
     p=out/'source'/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
    print('CREATOR_CAPABILITIES',json.dumps({k:data[k] for k in ['version','cert','credentialPresence','databaseWrites']}))
   finally:
    if installed:s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
