"""Repair only the configured admin's legacy JPEG profile; CAS and private encrypted backup."""
import base64,hashlib,json,secrets,time,urllib.request,sys
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
 token=secrets.token_hex(32);name='activity-profile-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_activity_profile.php').read_text().replace('NOA_ACTIVITY_EXPIRY',str(int(time.time())+600)).replace('NOA_ACTIVITY_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).replace('NOA_ACTIVITY_LOGO_BASE64',base64.b64encode(Path('public/papa-logo.png').read_bytes()).decode()).encode()
 t=connect();installed=False;out=Path('activity-proof');out.mkdir(exist_ok=True)
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    def call(body):
     req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token})
     with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:data=json.load(r)
     assert data['ok'];return data
    before=call({'action':'inspect'})
    action='rollback' if 'rollback' in sys.argv else 'apply'
    receipt=call({'action':action,'revision':before['revision'],'hash':before['hash']})
    (out/('profile-'+action+'.json')).write_text(json.dumps(receipt,indent=2));print('ACTIVITY_PROFILE_'+action.upper()+'_OK',json.dumps(receipt))
    if action=='apply':
     from PIL import Image
     import io
     url='https://noastudio.ai.kr/noa-creator-symbol.php?channel='+hashlib.sha256(b'admin').hexdigest()+'&v='+str(receipt['revision'])
     with urllib.request.urlopen(url,timeout=30) as r:img=Image.open(io.BytesIO(r.read())).convert('RGBA')
     assert img.getpixel((0,0))[3]==0 and img.getpixel((img.width-1,img.height-1))[3]==0
     img.save(out/'transparent-admin-profile.png');print('ACTUAL_PUBLIC_PROFILE_ALPHA_OK')
   finally:
    if installed:s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
