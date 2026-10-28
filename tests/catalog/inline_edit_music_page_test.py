"""Execute the real Music PHP page with metadata in a disposable SQLite fixture."""
import base64,hashlib,json,re,shutil,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class MusicInlineMetadata(unittest.TestCase):
 def test_regular_guest_and_admin_receive_act_labels_and_current_helper_revision(self):
  with tempfile.TemporaryDirectory(prefix='noa-inline-page-') as directory:
   web=Path(directory);(web/'noa-bridge').mkdir();(web/'noa-app/jukebox').mkdir(parents=True)
   for source,target in [('bridge/channel-ownership.php','noa-bridge/channel-ownership.php'),('bridge/member-access.php','noa-bridge/member-access.php'),('deploy/noa-premium.js','noa-premium.js'),('deploy/noa-app/jukebox/upload.css','noa-app/jukebox/upload.css'),('deploy/noa-browse.js','noa-browse.js'),('deploy/noa-music.php','noa-music.php'),('deploy/noa-app/jukebox/upload.js','noa-app/jukebox/upload.js'),('deploy/noa-browse-edit.js','noa-browse-edit.js'),('bridge/sound-core.php','noa-bridge/sound-core.php'),('bridge/inline-edit.php','noa-bridge/inline-edit.php'),('bridge/package-record.php','noa-bridge/package-record.php')]:shutil.copyfile(ROOT/source,web/target)
   (web/'common.php').write_text("<?php define('_GNUBOARD_',true);$_SESSION=[];$is_member=($_GET['auth']??'')==='admin';$is_admin=$is_member?'super':'';")
   (web/'noa-app/jukebox/core.php').write_text('<?php function nj_assets(PDO $db):array{return [];}')
   (web/'noa-bridge/music-readmodel.php').write_text('<?php function noa_music_cover(array $a,string $k,string $s,array $b,string $o):string{return "/noa-creator-symbol.php";}function noa_music_recovered_catalog(PDO $db):array{return [];}function noa_music_asset_url(array $a,string $k,string $s,string $t):string{return "";}')
   (web/'noa-bridge/storage.php').write_text("<?php function noa_bridge_pdo():PDO{return new PDO('sqlite:"+str(web/'fixture.sqlite')+"',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}")
   rows=[['single:kpop-original:01','single',json.dumps({'title':'원곡','genreId':'kpop-original','ep':'01','body':{}}),1],['meta:inline-act:kpop-original:1','meta',json.dumps({'inlineEdit':1,'target':{'type':'act','id':'kpop-original:1'},'fields':{'title':'저장한 ACT 제목'}}),1]]
   setup="require '"+str(web/'noa-bridge/storage.php')+"';$db=noa_bridge_pdo();$db->exec('CREATE TABLE noa_documents(doc_key TEXT,kind TEXT,payload TEXT,revision INT);CREATE TABLE noa_catalog_aliases(batch_id TEXT,alias_key TEXT,entity_id TEXT);CREATE TABLE noa_catalog_batches(batch_id TEXT,status TEXT,applied_at TEXT)');$q=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?,?)');foreach(json_decode(base64_decode('"+base64.b64encode(json.dumps(rows).encode()).decode()+"'),true)as $r)$q->execute($r);"
   subprocess.run(['php','-r',setup],check=True,capture_output=True)
   for query in [{},{'auth':'admin'}]:
    code="$_GET=json_decode(base64_decode('"+base64.b64encode(json.dumps(query).encode()).decode()+"'),true);require '"+str(web/'noa-music.php')+"';"
    result=subprocess.run(['php','-r',code],check=True,capture_output=True,text=True)
    self.assertNotIn('Warning',result.stdout+result.stderr);match=re.search(r'<script type="application/json" id="noa-act-labels" data-edit-revision="([a-f0-9]{64})">(.*?)</script>',result.stdout,re.S);self.assertIsNotNone(match,'regular page must expose ACT label JSON outside administrator QA condition')
    self.assertEqual(match[1],hashlib.sha256((ROOT/'deploy/noa-browse-edit.js').read_bytes()).hexdigest());self.assertEqual(json.loads(match[2]),{'kpop-original:1':'저장한 ACT 제목'});self.assertIn('id="songs" hidden',result.stdout)
    if query:
     self.assertIn('/noa-app/jukebox/upload.js?v='+hashlib.sha256((ROOT/'deploy/noa-app/jukebox/upload.js').read_bytes()).hexdigest(),result.stdout)
    else:self.assertNotIn('/noa-app/jukebox/upload.js?v=',result.stdout)
if __name__=='__main__':unittest.main()
