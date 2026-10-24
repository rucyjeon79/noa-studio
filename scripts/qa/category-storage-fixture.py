"""Isolated production-code fixture. Never connects to production MySQL or writes host data."""
import json,os,pathlib,shutil
root=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-category-fixture'
root.mkdir(exist_ok=True);(root/'noa-bridge').mkdir(exist_ok=True);(root/'noa-app/jukebox').mkdir(parents=True,exist_ok=True);(root/'private').mkdir(exist_ok=True)
(root/'common.php').write_text("<?php session_start();if(($_GET['auth']??'')==='admin')$_SESSION['fixture_admin']=true;$is_member=!empty($_SESSION['fixture_admin']);$is_admin=$is_member?'super':'';if($is_member)$_SESSION['noa_category_order_csrf']='isolated-token';")
(root/'noa-bridge/storage.php').write_text('''<?php
class FixtureDB{function query($sql){
 if(str_contains($sql,'noa_catalog_aliases'))return [['alias_key'=>'story:01','entity_id'=>str_repeat('a',64)],['alias_key'=>'story:02','entity_id'=>str_repeat('b',64)]];
 return [['doc_key'=>'story:01','payload'=>json_encode(['genreId'=>'your-story','title'=>'첫 곡'])],['doc_key'=>'story:02','payload'=>json_encode(['genreId'=>'your-story','title'=>'둘째 곡'])]];
}}
function noa_bridge_pdo(){return new FixtureDB;}
''')
(root/'noa-bridge/sound-core.php').write_text('<?php ')
(root/'noa-app/jukebox/core.php').write_text("<?php function nj_catalog($db){return ['catalog:'.str_repeat('c',64)=>['genreId'=>'cover-reborn','title'=>'커버 곡']];}")
for name in ['noa-category-order.php','noa-category-order-admin.php']:
 s=pathlib.Path('deploy',name).read_text().replace("'/hosting/noastudio/noa-ai-lab/category-order.json'",repr(str(root/'private/category-order.json')))
 (root/name).write_text(s)
print(root)
