"""Native PHP/SQLite rendering fixture, never uploaded to the operating site."""
import base64,hashlib,json,shutil,subprocess,tempfile
from pathlib import Path

def render():
 root=Path(tempfile.mkdtemp(prefix='noa-coming-'));bridge=root/'noa-bridge';bridge.mkdir()
 for name in ['member-access.php','package-record.php','sound-core.php','music-readmodel.php','youtube-catalog.php']:shutil.copyfile(Path('bridge')/name,bridge/name)
 for name in ['noa-premium.js','noa-music.php','noa-youtube.php','noa-youtube.js','noa-youtube.css','noa-browse.js','noa-browse-edit.js','noa-ui.js']:shutil.copyfile(Path('deploy')/name,root/name)
 (root/'extend').mkdir();shutil.copyfile('deploy/noa-design.extend.php',root/'extend/noa.design.php')
 (root/'noa-app/jukebox').mkdir(parents=True)
 shutil.copyfile('deploy/noa-app/p0-player.js',root/'noa-app/p0-player.js')
 shutil.copyfile('deploy/noa-app/jukebox/upload.css',root/'noa-app/jukebox/upload.css')
 (root/'noa-app/jukebox/core.php').write_text('<?php function nj_assets(PDO $db):array{return [];}')
 # A disposable native renderer, not a production authentication bypass. Guest
 # denial is checked separately against the real access extension.
 (root/'common.php').write_text("<?php define('_GNUBOARD_',true);$_SESSION=[];$is_member=true;$is_admin='';require __DIR__.'/extend/noa.design.php';noa_design_assets();")
 db=root/'fixture.sqlite';(bridge/'storage.php').write_text("<?php function noa_bridge_pdo():PDO{static $db;$db??=new PDO('sqlite:"+str(db)+"');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);$db->sqliteCreateFunction('UNIX_TIMESTAMP',static fn($date)=>$date===null?null:strtotime($date),1);return $db;}")
 genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];docs=[];songs={};videos={}
 for n,g in enumerate(genres):
  for pending in [False,True]:
   key=hashlib.sha256((g+str(pending)).encode()).hexdigest();vid='v'+str(n*2+int(pending)).zfill(10);title=('공개 준비 곡 ' if pending else '공개 곡 ')+g;ep='' if g in ['your-story','cover-reborn'] else str(2 if pending else 1);body={'confirmedTitle':title,'youtubeUrl':'https://www.youtube.com/watch?v='+vid}
   docs.append(['catalog:'+key,'story',json.dumps({'title':title,'genreId':g,'ep':ep,'body':body})]);songs[key]={'song_id':key,'genre_id':g,'ep':ep,'public_verified':True,'fields':dict(body,title=title)};videos[vid]={'id':vid,'snippet':{'title':'PROVIDER_PRIVATE_SECRET' if pending else title,'description':'PRIVATE_DESCRIPTION_SECRET'},'status':{'privacyStatus':'private' if pending else 'public','embeddable':not pending},'match':{'songId':key,'status':'matched'},'classification':'music'}
 enc=lambda x:base64.b64encode(json.dumps(x).encode()).decode()
 (bridge/'youtube-store.php').write_text("<?php function ny_latest(PDO $d):array{return ['run_id'=>'fixture','channel_id'=>'fixture'];}function ny_batch(PDO $d):string{return 'fixture';}function ny_songs(PDO $d,string $b):array{return json_decode(base64_decode('"+enc(songs)+"'),true);}function ny_videos(PDO $d,array $r,bool $t=true,?array $s=null):array{return json_decode(base64_decode('"+enc(videos)+"'),true);}function ny_video_id(string $u):?string{parse_str((string)parse_url($u,PHP_URL_QUERY),$q);return isset($q['v'])&&preg_match('/^[A-Za-z0-9_-]{11}$/D',$q['v'])?$q['v']:null;}function ny_official_members(PDO $d,array $r):array{return [];}")
 (bridge/'world-mv.php').write_text("<?php const NWM_PLAYLIST='world';const NWM_ACT_PLAYLIST='world-act';function nwm_act_load(PDO $d,array $r,array $v):array{return ['videos'=>[]];}")
 sql="CREATE TABLE noa_document_history(doc_key TEXT,revision INTEGER,changed_at TEXT);CREATE TABLE noa_documents(doc_key TEXT,kind TEXT,payload TEXT);CREATE TABLE noa_catalog_aliases(batch_id TEXT,alias_key TEXT,entity_id TEXT);CREATE TABLE noa_catalog_batches(batch_id TEXT,status TEXT,applied_at TEXT);CREATE TABLE noa_catalog_songs(song_id TEXT,identity_json TEXT,genre_id TEXT,ep TEXT);CREATE TABLE noa_catalog_versions(batch_id TEXT,entity_id TEXT,entity_type TEXT,fields_json TEXT,public_verified INT);CREATE TABLE noa_youtube_playlists(run_id TEXT,playlist_id TEXT,payload TEXT);INSERT INTO noa_catalog_batches VALUES('fixture','applied','2026-10-25');"
 setup="require '"+str(bridge/'storage.php')+"';$d=noa_bridge_pdo();$d->exec(base64_decode('"+base64.b64encode(sql.encode()).decode()+"'));$q=$d->prepare('INSERT INTO noa_documents VALUES(?,?,?)');foreach(json_decode(base64_decode('"+enc(docs)+"'),true) as $r)$q->execute($r);"
 subprocess.run(['php','-r',setup],check=True,capture_output=True)
 out=Path('youtube-coming-proof');out.mkdir(exist_ok=True)
 for page,filename,marker in [('noa-youtube.php','candidate.html','const rows='),('noa-music.php','music.html','const records=')]:
  code="$_GET=[];$_SERVER['REQUEST_METHOD']='GET';$_SERVER['REQUEST_URI']='/"+page+"';require '"+str(root/page)+"';"
  result=subprocess.run(['php','-d','display_errors=0','-r',code],capture_output=True,text=True)
  if result.returncode or result.stderr:raise RuntimeError(result.stderr)
  assert 'PROVIDER_PRIVATE_SECRET' not in result.stdout and 'PRIVATE_DESCRIPTION_SECRET' not in result.stdout
  assert marker in result.stdout and '불러오지 못했습니다' not in result.stdout.split('<script',1)[0]
  (out/filename).write_text(result.stdout)
 shutil.rmtree(root)
if __name__=='__main__':render()
