<?php
declare(strict_types=1);define('_GNUBOARD_',true);$root=sys_get_temp_dir().'/noa-db-test-'.bin2hex(random_bytes(5));mkdir($root);mkdir($root.'/html');define('G5_PATH',$root.'/html');
define('G5_MYSQL_HOST',getenv('NOA_TEST_MYSQL_HOST')?:'127.0.0.1');define('G5_MYSQL_DB','noa_db_test');define('G5_MYSQL_USER','root');define('G5_MYSQL_PASSWORD','noa-test-only');
require __DIR__.'/../../deploy/noa-app/database/core.php';
function check(bool $v,string $s):void{if(!$v)throw new RuntimeException($s);}
$db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4','root',G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE songs(id INT PRIMARY KEY,title VARCHAR(100),n INT,raw_data BLOB, j JSON, optional TEXT, computed INT GENERATED ALWAYS AS(n*2) STORED) ENGINE=InnoDB');
$db->exec('CREATE TABLE members(id INT PRIMARY KEY,secret VARCHAR(100)) ENGINE=InnoDB');
$q=$db->prepare('INSERT INTO songs(id,title,n,raw_data,j,optional) VALUES(?,?,?,?,?,?)');$q->execute([1,"가을 ' ; \\ 💛",42,"\0\xff\x01",'{"a":"한글"}',null]);$db->exec("INSERT INTO members VALUES(1,'unchanged')");
for($i=2;$i<1101;$i++)$q->execute([$i,'test'.$i,$i,'','{}','']);
$ro=nd_db();$status=nd_rows($ro,'SELECT @@session.transaction_read_only AS ro')[0];check((int)$status['ro']===1,'read only session');
$r=nd_query($ro,'SELECT * FROM songs LIMIT 9000');check($r['rowCount']===1000,'row cap');
$r=nd_query($ro,"SELECT id,title FROM songs WHERE title LIKE '%가을%' LIMIT 20");check($r['rowCount']===1,'unicode search');
$r=nd_query($ro,'SELECT COUNT(*) AS total FROM songs');check((int)$r['rows'][0][0]===1100,'aggregation');
try{$ro->exec('DELETE FROM members');throw new RuntimeException('read only bypass');}catch(PDOException $good){}
$before=$db->query('SELECT * FROM songs ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
$m=nd_backup($ro,null);check($m['tables']['songs']===1100,'backup row count');check(!$m['restoreVerified'],'honest restore status');check(nd_manifest($m['id'])['sha256']===$m['sha256'],'checksum');
// Restore into a separate disposable DB only. Never point these tests at production.
$db->exec('CREATE DATABASE noa_db_restore CHARACTER SET utf8mb4');$restore=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname=noa_db_restore;charset=utf8mb4','root',G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$restore->exec(file_get_contents(nd_private().'/'.$m['id'].'.sql'));
$after=$restore->query('SELECT * FROM songs ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);check($before===$after,'restored values differ');check($db->query('SELECT * FROM members')->fetchAll()===$restore->query('SELECT * FROM members')->fetchAll(),'restored member mismatch');
$db->exec('CREATE TABLE legacy(id INT PRIMARY KEY,n VARCHAR(50)) ENGINE=MyISAM');$db->exec("INSERT INTO legacy VALUES(1,'preserved')");$m2=nd_backup($ro,'legacy');check($m2['consistency']==='READ LOCK','MyISAM consistency lock');$restore->exec(file_get_contents(nd_private().'/'.$m2['id'].'.sql'));check($restore->query('SELECT n FROM legacy')->fetchColumn()==='preserved','MyISAM restored');
$db->exec('CREATE VIEW song_view AS SELECT id FROM songs');try{nd_backup($ro,null);throw new RuntimeException('incomplete full dump accepted');}catch(DomainException $e){check(str_contains($e->getMessage(),'뷰'),'unexpected backup error');}$db->exec('DROP VIEW song_view');
file_put_contents(nd_private().'/'.$m['id'].'.sql',"tamper",FILE_APPEND);try{nd_manifest($m['id']);throw new RuntimeException('tamper accepted');}catch(RuntimeException $e){check($e->getMessage()==='백업 무결성 검사 실패','wrong tamper error');}
check($db->query('SELECT secret FROM members')->fetchColumn()==='unchanged','production-shaped member preservation');
$member=['mb_id'=>'test-admin'];nd_audit('test','ok',['rows'=>1100]);check(str_contains(file_get_contents(nd_private().'/audit-'.gmdate('Y-m').'.jsonl'),'test-admin'),'audit');
echo "MySQL 8: read-only enforcement, 1000 row cap, Unicode bound search, aggregate, full/table backup, isolated actual restore (1100 rows, generated column, JSON, binary, NULL), MyISAM lock/restore, unsafe-object refusal, tamper detection, member preservation, private audit passed.\n";
