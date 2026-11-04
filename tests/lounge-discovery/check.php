<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require __DIR__.'/../../bridge/storage.php';require __DIR__.'/../../bridge/lounge-discovery.php';
$db=noa_bridge_pdo();$now=time();$g=['board_table'=>'b','group_table'=>'g','write_prefix'=>'w_'];
$db->exec("CREATE TABLE g(gr_id VARCHAR(20) PRIMARY KEY,gr_use_access INT);CREATE TABLE b(bo_table VARCHAR(20) PRIMARY KEY,gr_id VARCHAR(20),bo_read_level INT,bo_list_level INT,bo_read_point INT,bo_use_secret INT,bo_use_cert VARCHAR(20))");
$db->exec("INSERT INTO g VALUES ('public',0),('locked',1);INSERT INTO b VALUES('free','public',1,1,0,0,''),('notice','locked',1,1,0,0,''),('song_request','public',1,1,0,0,'')");
$db->exec("CREATE TABLE w_free(wr_id INT PRIMARY KEY,wr_parent INT,wr_is_comment INT,wr_reply VARCHAR(12),wr_option VARCHAR(30),mb_id VARCHAR(40),wr_subject TEXT,wr_content TEXT,wr_datetime DATETIME,wr_good INT)");
$db->exec("CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(40),payload JSON,KEY(kind))");
function postrow($key,$title,$age,$likes,$extra=[]){
 global $db,$now;$id=substr(hash('sha256',$key),0,32);$payload=array_replace(['id'=>$id,'space'=>'lounge','title'=>$title,'likes'=>$likes,'at'=>$now-$age*86400,'owner'=>'alice','visibility'=>'public'],$extra);
 $db->prepare('INSERT INTO noa_documents VALUES (?,?,?)')->execute(['ecosystem:post:'.$id,'ecosystem_post',json_encode($payload)]);return $id;
}
function replyrow($key,$parent,$body,$user,$extra=[]){
 global $db,$now;$id=substr(hash('sha256',$key),0,32);$payload=array_replace(['id'=>$id,'post'=>$parent,'body'=>$body,'owner'=>$user,'at'=>$now-5,'visibility'=>'public'],$extra);
 $db->prepare('INSERT INTO noa_documents VALUES (?,?,?)')->execute(['ecosystem:comment:'.$id,'ecosystem_comment',json_encode($payload)]);
}
$week=postrow('wk','이번 주 글',1,5);postrow('mo','이달 글',15,20);postrow('old','오래된 글',60,40);postrow('plain','반응 없는 새 글',0,0);
$hidden=postrow('secret','숨김 글',1,100,['visibility'=>'private']);postrow('deleted','숨김 삭제',1,100,['deleted'=>true]);postrow('vip','숨김 VIP',1,100,['vipOnly'=>true,'releaseAt'=>$now+60]);postrow('other','숨김 LAB',1,99,['space'=>'lab']);postrow('members','숨김 회원',1,90,['visibility'=>'members']);
replyrow('public',$week,'따뜻한 노래','alice');replyrow('someone',$week,'다른 별무리','bob');replyrow('invisible',$hidden,'숨김 원글 댓글','alice');replyrow('deletedc',$week,'숨김 삭제 댓글','alice',['deleted'=>true]);replyrow('privc',$week,'숨김 비공개 댓글','alice',['visibility'=>'private']);
$q=$db->prepare('INSERT INTO w_free VALUES(?,?,?,?,?,?,?,?,?,?)');$kst=gmdate('Y-m-d H:i:s',$now+32400-86400);
foreach([[10,10,0,'','','bob','게시판 원문','',10],[11,10,1,'','','alice','','게시판 공개 댓글',0],[12,10,1,'','secret','bob','','숨김 비밀 댓글',0],[13,13,0,'','secret','alice','숨김 비밀 원글','',90],[14,13,1,'','','alice','','숨김 부모 댓글',0]] as $r){$score=array_pop($r);$q->execute([...$r,$kst,$score]);}
function verify($yes,$reason){if(!$yes)throw new RuntimeException($reason);}
foreach(nld_views() as $v=>$unused){$rs=nld_read($db,$g,$v,'alice',$now);verify(!str_contains(json_encode($rs,JSON_UNESCAPED_UNICODE),'숨김'),'private record in '.$v);}
$weekRows=nld_read($db,$g,'week','',$now);verify(array_column($weekRows,'title')===['게시판 원문','이번 주 글'],'weekly sorting/window/zero score');
verify(nld_read($db,$g,'month','',$now)[0]['title']==='이달 글','monthly window');verify(nld_read($db,$g,'likes','',$now)[0]['title']==='오래된 글','all-time likes');
$mine=nld_read($db,$g,'replies','alice',$now);verify(count($mine)===2&&!in_array('다른 별무리',array_column($mine,'excerpt')),'viewer isolation');verify(count(nld_read($db,$g,'replies','bob',$now))===1,'second user');
verify(count(nld_read($db,$g,'comments','',$now))===3,'public latest comments');
try{nld_read($db,$g,'mine','',$now);throw new RuntimeException('guest personal feed');}catch(DomainException $e){}
verify(str_contains(nld_destination($weekRows[0]),'board=free&nativePost=10#noa-free-10'),'native original');
verify(nld_destination($weekRows[1])==='/noa-lounge.php?post='.$week.'#ec-content','app original');
$db->exec("UPDATE b SET bo_read_point=-1 WHERE bo_table='free'");verify(count(nld_read($db,$g,'comments','',$now))===2,'paid board excluded');
$db->exec("UPDATE b SET bo_read_point=0 WHERE bo_table='free'");
echo "NOA_LOUNGE_PUBLIC_RANKING_AND_PRIVACY_OK\n";
