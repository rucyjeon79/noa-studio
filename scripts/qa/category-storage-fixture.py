"""Run the real endpoint against disposable SQLite documents and private order storage."""
import json,os,pathlib,shutil,sqlite3
root=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-category-fixture'
root.mkdir(exist_ok=True);(root/'noa-bridge').mkdir(exist_ok=True);(root/'noa-app/jukebox').mkdir(parents=True,exist_ok=True);(root/'private').mkdir(exist_ok=True)
(root/'common.php').write_text("<?php session_start();if(($_GET['auth']??'')==='admin')$_SESSION['fixture_admin']=true;$is_member=!empty($_SESSION['fixture_admin']);$is_admin=$is_member?'super':'';$member=['mb_id'=>'fixture'];if($is_member)$_SESSION['noa_category_order_csrf']='isolated-token';")
(root/'noa-bridge/storage.php').write_text('''<?php
class FixtureDB extends PDO{function prepare(string $query,array $options=[]):PDOStatement|false{return parent::prepare(str_replace('INSERT IGNORE','INSERT OR IGNORE',$query),$options);}}
function noa_bridge_pdo():PDO{return new FixtureDB('sqlite:''' + str(root/'fixture.sqlite') + "',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}\n")
shutil.copyfile('bridge/package-record.php',root/'noa-bridge/package-record.php')
(root/'noa-bridge/sound-core.php').write_text('<?php ')
(root/'noa-app/jukebox/core.php').write_text("<?php function nj_catalog($db){return ['catalog:'.str_repeat('c',64)=>['genreId'=>'cover-reborn','title'=>'커버 곡']];}")
with sqlite3.connect(root/'fixture.sqlite') as db:
 db.executescript('CREATE TABLE IF NOT EXISTS noa_documents(doc_key TEXT PRIMARY KEY,kind TEXT,payload TEXT,revision INTEGER,updated_by TEXT);CREATE TABLE IF NOT EXISTS noa_document_history(doc_key TEXT,revision INTEGER,payload TEXT,changed_by TEXT,PRIMARY KEY(doc_key,revision));CREATE TABLE IF NOT EXISTS noa_catalog_batches(batch_id TEXT,status TEXT,applied_at TEXT);CREATE TABLE IF NOT EXISTS noa_catalog_aliases(batch_id TEXT,alias_key TEXT,entity_id TEXT);')
 for key,genre,title in [('a','cover-reborn','커버 A'),('b','cover-reborn','커버 B'),('c','cover-reborn','커버 C'),('story:01','your-story','첫 곡'),('story:02','your-story','둘째 곡')]:db.execute('INSERT OR IGNORE INTO noa_documents VALUES(?,?,?,?,?)',(key,'story',json.dumps({'genreId':genre,'title':title,'body':{}}),1,'fixture'))
for name in ['noa-category-order.php','noa-category-order-admin.php']:
 s=pathlib.Path('deploy',name).read_text().replace("'/hosting/noastudio/noa-ai-lab/category-order.json'",repr(str(root/'private/category-order.json')))
 (root/name).write_text(s)
print(root)
