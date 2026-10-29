"""Temporary authenticated read-only owner and media projection receipt; removed in finally."""
import hashlib,json,secrets,time,urllib.request,urllib.parse
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
 out=Path('channel-view-proof/live');out.mkdir(parents=True,exist_ok=True);token=secrets.token_hex(32);name='channel-view-audit-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_channel_view_audit.php').read_text().replace('NOA_CREATOR_EXPIRY',str(int(time.time())+600)).replace('NOA_CREATOR_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode();t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:data=json.load(r)
    assert data['ok'] and data['counts']['emptyCovers']==0 and data['channelOwned'] and data['publicSongs']>0;html=data.pop('html');(out/'production-render.html').write_text(html);(out/'ownership-covers.json').write_text(json.dumps(data,indent=2));print('CHANNEL_VIEW_LIVE_READ_ONLY_OK',json.dumps(data))
   finally:
    if installed:s.remove(remote)
 finally:t.close()
 import re
 url='https://noastudio.ai.kr/noa-channel.php?id='+data['channelId']
 with urllib.request.urlopen(url,timeout=45) as r:assert urllib.parse.urlparse(r.url).path.endswith('login.php'), 'guest membership gate preserved'
 projection=json.loads(re.search(r'<script id="channel-data" type="application/json">(.*?)</script>',html,re.S).group(1))
 songs=[v for v in projection['records'] if v['kind']!='playlist']
 assert len(songs)==data['publicSongs'] and all(not v['audio'] and v['cover'] for v in songs)
 assert 'data-columns="4"' in html and 'channel-navigation' in html
 (out/'production-page.json').write_text(json.dumps({'url':url,'publicSongs':len(songs),'audioUrlsExposedToBasicMember':0,'render':'signed-read-only-installed-template','guestLoginRequired':True,'writes':0}))
 for p in ['/noa-creator-symbol.php','/noa-creator-symbol.php?channel='+hashlib.sha256(b'admin').hexdigest()]:
  with urllib.request.urlopen('https://noastudio.ai.kr'+p,timeout=30) as r:assert r.status==200 and r.headers['Content-Type'].startswith('image/') and len(r.read())>100
 print('CHANNEL_VIEW_SYMBOL_PUBLIC_OK')
if __name__=='__main__':main()
