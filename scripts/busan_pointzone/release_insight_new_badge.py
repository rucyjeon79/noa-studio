"""Deploy only Insight hub NEW badge, preserving native board policies and newsroom manifest."""
import hashlib,hmac,json,tempfile,subprocess,shutil,re
from pathlib import Path
from urllib.request import Request,urlopen
import release_submenu_fix as remote
from release_native_catalog_admin import lint
SOURCE=Path('deploy/busan/newsroom/index.php')
REL='busan-assistant/newsroom/index.php'
OLD='f5c1fa8a0bd2282bfd3b69fed83722b0179115ec'
def fixture():
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);hub=root/'busan-assistant/newsroom';hub.mkdir(parents=True)
        shutil.copyfile(SOURCE,hub/'index.php')
        (root/'common.php').write_text("""<?php
date_default_timezone_set('Asia/Seoul');
define('G5_PATH',__DIR__);define('G5_BBS_URL','https://fixture.invalid/bbs');define('G5_SERVER_TIME',strtotime('2026-11-26 17:00:00'));
$g5=['board_table'=>'g5_board','write_prefix'=>'g5_write_'];
function busan_news_split_active(){return true;}
function busan_news_sections(){return ['busan_news_company'=>'회사·그룹 소식','busan_news_union'=>'노동조합 소식'];}
function sql_fetch($q,$e=false){return ['gr_id'=>'fixture','bo_list_level'=>1,'bo_read_level'=>1,'bo_new'=>str_contains($q,'busan_news_union')?0:24];}
function get_group($id){return ['gr_id'=>$id,'gr_use_access'=>0];}
function sql_query($q,$e=false){if(!str_contains($q,'wr_datetime'))throw new RuntimeException('missing post creation time');$GLOBALS['fixture_rows']=[['wr_id'=>1,'wr_subject'=>'RECENT_POST','wr_1'=>'2020-01-01','ca_name'=>'','wr_datetime'=>'2026-11-26 16:00:00'],['wr_id'=>2,'wr_subject'=>'OLD_POST','wr_1'=>'2026-11-26','ca_name'=>'','wr_datetime'=>'2026-11-25 16:59:59']];return true;}
function sql_fetch_array($q){return array_shift($GLOBALS['fixture_rows']);}
""")
        (root/'head.php').write_text('<?php echo "<html><body>";')
        (root/'tail.php').write_text('<?php echo "</body></html>";')
        p=subprocess.run(['php',str(hub/'index.php')],capture_output=True,text=True,check=True)
        if p.stderr or p.stdout.count('class="bn-hub-new"')!=1 or not re.search(r'RECENT_POST\s*<span class="bn-hub-new"',p.stdout) or re.search(r'OLD_POST\s*<span class="bn-hub-new"',p.stdout):raise RuntimeError('native freshness fixture failed')
        print('BUSAN_INSIGHT_NEW_FIXTURE_OK',{'fresh':True,'old':False,'disabled_board':False,'uses_creation_time':True},flush=True)
def release(s):
    for p in (remote.ROOT,remote.ROOT+'/busan-assistant/newsroom',remote.PRIVATE):remote.directory(s,p)
    new=SOURCE.read_bytes();lint(new)
    target=remote.ROOT+'/'+REL;manifest_path=remote.PRIVATE+'/newsroom-manifest.json'
    old=remote.read(s,target,100000);manifest_old=remote.read(s,manifest_path,1500000)
    if old is None or manifest_old is None:raise RuntimeError('missing managed newsroom asset')
    manifest=json.loads(manifest_old)
    if manifest.get('assets',{}).get(REL)!=remote.digest(old):raise RuntimeError('managed asset hash conflict')
    if old!=new and remote.blob(old)!=OLD:raise RuntimeError('live Insight hub version changed; stop without overwrite')
    for label,blob in [('hub',old),('manifest',manifest_old)]:
        p=remote.PRIVATE+'/insight-new-'+label+'-'+remote.digest(blob)+'.bak'
        if remote.read(s,p,1500000) is None:remote.write(s,p,blob,0o600)
        if remote.read(s,p,1500000)!=blob:raise RuntimeError('backup verification failed')
    manifest['assets'][REL]=remote.digest(new);manifest_new=json.dumps(manifest).encode()
    changed=False;manifest_changed=False
    try:
        if old!=new:
            if remote.read(s,target,100000)!=old or remote.read(s,manifest_path,1500000)!=manifest_old:raise RuntimeError('concurrent publisher change')
            remote.write(s,target,new,0o644);changed=True
            if remote.read(s,manifest_path,1500000)!=manifest_old:raise RuntimeError('manifest changed concurrently')
            remote.write(s,manifest_path,manifest_new,0o600);manifest_changed=True
        for device in ('pc','mobile'):
            url='https://skhnslu-busan.com/busan-assistant/newsroom/index.php?device='+device
            with urlopen(Request(url,headers={'Cache-Control':'no-cache','User-Agent':'Busan-Insight-Badge-Verify/1.0'}),timeout=20) as r:
                body=r.read(700000).decode('utf-8','replace')
                if r.status!=200 or 'bn-hub-new' not in body or 'Fatal error' in body or 'OpenAI INSIGHT' not in body:raise RuntimeError('live hub markup verification failed: '+device)
                print('BUSAN_INSIGHT_NEW_RENDER',device,{'status':r.status,'badges':body.count('class="bn-hub-new"')},flush=True)
        print('BUSAN_INSIGHT_NEW_RELEASE_OK',{'changed':changed,'article_mutations':0,'point_mutations':0,'menu_mutations':0},flush=True)
    except Exception:
        if manifest_changed and remote.read(s,manifest_path,1500000)==manifest_new:remote.write(s,manifest_path,manifest_old,0o600)
        if changed and remote.read(s,target,100000)==new:remote.write(s,target,old,0o644)
        raise
if __name__=='__main__':
    fixture()
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);release(s)
