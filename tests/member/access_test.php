<?php
declare(strict_types=1);require __DIR__.'/../../bridge/member-access.php';require __DIR__.'/../../bridge/creator-core.php';
function check($v,string $m):void{if(!$v)throw new RuntimeException($m);}
$expected=[1=>[0,0,0,0,0],2=>[1,0,0,0,0],3=>[1,1,0,0,0],4=>[1,1,1,0,0],5=>[1,1,0,1,0],6=>[1,1,1,1,1],7=>[1,1,0,0,0],8=>[1,1,0,0,0],9=>[1,1,0,0,0],10=>[1,1,0,0,0]];
foreach($expected as $level=>$values){$a=nam_access($level===1?[]:['mb_id'=>'qa','mb_level'=>$level]);foreach(['member','write','music','creator','ownDownload']as $i=>$cap)check($a[$cap]===(bool)$values[$i],"level_$level:$cap");check(!$a['admin'],"no_numeric_admin_$level");foreach(['/noa-youtube.php','/noa-world.php','/noa-my.php','/noa-bridge/catalog.php','/bbs/board.php']as $p)check(nam_allowed($a,nam_requirement($p))===(bool)$values[0],"member_path:$p:$level");foreach(['/noa-music.php','/noa-bridge/user-playlists.php']as $p)check(nam_allowed($a,nam_requirement($p))===(bool)$values[2],"music_path:$p:$level");foreach(['/bbs/write.php','/bbs/write_update.php','/bbs/write_comment_update.php','/bbs/delete_comment.php']as $p)check(nam_allowed($a,nam_requirement($p,'POST'))===(bool)$values[1],"write_path:$p:$level");check(!nam_allowed($a,nam_requirement('/adm/member_list.php')),'admin_denied');}
$a=nam_access(['mb_id'=>'admin','mb_level'=>10],'super');foreach($a as $k=>$v)if(is_bool($v))check($v,'super_'.$k);
foreach(['/bbs/login.php','/bbs/login_check.php','/bbs/register.php','/bbs/register_form_update.php','/bbs/password_lost.php','/','/noa-bridge/home.php']as $p)check(nam_allowed(nam_access(),nam_requirement($p)),'onboarding_'.$p);
check(nam_requirement('/bbs/content.php','GET',['co_id'=>'privacy'])==='home','legal');check(nam_requirement('/bbs/content.php','GET',['co_id'=>'other'])==='member','nonlegal');
check(nam_owner(['ownerId'=>'a'],['mb_id'=>'a']),'own');check(!nam_owner(['ownerId'=>'a'],['mb_id'=>'b']),'cross_tenant');check(!nam_owner([],['mb_id'=>'a']),'canonical_no_owner');
$d=['ownerId'=>'a','title'=>'my song','genreId'=>'your-story','visibility'=>'private','ep'=>'','body'=>[]];$patched=nc_patch($d,['fields'=>['title'=>'changed','lyrics'=>'actual lyrics'],'genre'=>'your-story','visibility'=>'private']);check($patched['ownerId']==='a'&&$patched['body']['lyricsBlock']==='actual lyrics','single_record_owner_preserved');
foreach([['fields'=>['ownerId'=>'b']],['fields'=>['audioFileLocation'=>'/etc/passwd']],['fields'=>['youtubeUrl'=>'https://evil.invalid/watch']]]as $b){try{nc_patch($d,$b);throw new RuntimeException('unsafe_patch_accepted');}catch(InvalidArgumentException $e){}}
echo "MEMBER_ACCESS_MATRIX_OK levels1-10 super onboarding direct_routes ownership immutable_media\n";

$d['body']['customSource']=['keep'=>true];$p=nc_patch($d,['fields'=>['title'=>'공통 폼','songDescription'=>'곡 소개','description'=>'영상 설명','lyricsTranslation'=>'번역','sunoPrompt'=>'스타일','productionPrompt'=>'제작','characterPrompt'=>'캐릭터','youtubeTitle'=>'영상 제목','sunoUrl'=>'https://suno.com/s/example','creativeFields'=>['storyPlan'=>'이야기']],'genre'=>'cover-reborn','originalArtist'=>'원가수']);
check($p['packageType']==='cover'&&$p['ownerId']==='a'&&$p['body']['originalArtist']==='원가수'&&$p['body']['customSource']===['keep'=>true],'owner common form preserves ownership and source');check(nup_fields($p)['songDescription']==='곡 소개'&&nup_fields($p)['description']==='영상 설명','owner descriptions independent');
try{nc_patch($d,['fields'=>['confirmed'=>true]]);throw new RuntimeException('owner_confirmation_escalation');}catch(InvalidArgumentException $e){}
echo "OWNER_COMMON_FIELDS_WITHOUT_ADMIN_ESCALATION_OK\n";

check(nam_allowed(nam_access(),nam_requirement('/noa-sitemap.php')),'public sitemap describes locked destinations without granting access');
