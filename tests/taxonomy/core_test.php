<?php
declare(strict_types=1);define('_GNUBOARD_',true);require dirname(__DIR__,2).'/bridge/taxonomy-store.php';
function assert_nt(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$songs=['a'=>['genre_id'=>'kpop-original','ep'=>'01','language'=>'ko','version_name'=>'unspecified','fields'=>['title'=>'하루의 끝에']],'b'=>['genre_id'=>'jpop-original','ep'=>'01','language'=>'ja','version_name'=>'unspecified','fields'=>['title'=>'하루의 끝에']],'c'=>['genre_id'=>'cover-reborn','ep'=>'','language'=>'ko','version_name'=>'unspecified','fields'=>['title'=>'이젠 잊기로 해요']]];
$v=['id'=>'aaaaaaaaaaa','snippet'=>['title'=>'EP.1 | 하루의 끝에 | K-POP Original Song'],'match'=>['songId'=>null,'status'=>'unmatched']];$c=nt_classify($v,null,[],nt_defaults());$m=nt_match($v,$songs,$c);assert_nt($m['status']==='confirmed'&&$m['songId']==='a','unique title+EP+language must match');
$cover=$v;$cover['snippet']['title']='이젠 잊기로 해요 - 김완선 | Cover by AInoa';$c=nt_classify($cover,null,[],nt_defaults());assert_nt(nt_match($cover,$songs,$c)['songId']==='c','cover artist suffix and category evidence');
$dupes=$songs;$dupes['duplicate']=$songs['a'];assert_nt(nt_match($v,$dupes,$c)['status']!=='confirmed','duplicate title identity must not auto match');
$v['match']=['songId'=>'b','status'=>'approved'];assert_nt(nt_match($v,$songs,$c)['songId']==='b','existing confirmed match overwritten');$v['match']=['songId'=>null,'status'=>'rejected'];assert_nt(nt_match($v,$songs,$c)['status']==='rejected','administrator rejection ignored');
$lists=[['id'=>'PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB'],['id'=>'PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb']];$c=nt_classify([],null,$lists,nt_defaults());assert_nt($c['status']==='review','multiple incompatible official memberships must be reviewed');
$c=nt_classify([],['genre_id'=>'kpop-original'],[['id'=>'PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb']],nt_defaults());assert_nt($c['categories']===['cover-reborn'],'official playlist must precede old catalog genre');
$translation=['snippet'=>['title'=>'[Cover] EP.1 Japanese POP Original']];assert_nt(nt_classify($translation,null,[],nt_defaults())['status']==='unclassified','generic Cover treated as famous cover');
$collection=['snippet'=>['title'=>'ACT.1 Playlist EP.1~10 | K-POP Original']];assert_nt(nt_match($collection,$songs,['status'=>'unclassified','categories'=>[]])['status']==='not_applicable','compilation matched as individual song');
$bad=false;try{nt_rule_valid(['kind'=>'sql','values'=>['DROP']]);}catch(InvalidArgumentException $e){$bad=true;}assert_nt($bad,'arbitrary SQL rule allowed');
assert_nt(nt_language('EP.1 | 하루의 끝에 | J-POP Original')==='ja','translated language detection');assert_nt(nt_ep('EP.1~10')===null,'EP range treated as single EP');
echo "PASS taxonomy priority, ambiguity, matching evidence, variants, rejection and compilation invariants\n";

$mv=['snippet'=>['title'=>'EP.1 하루의 끝에 | Official MV (KR) | Original Song'],'_ownerPlaylistIds'=>['PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY']];$same=$songs;$same['collection']=$songs['a'];$same['collection']['genre_id']='joseon-ballad';$c=['status'=>'unclassified','categories'=>[]];assert_nt(nt_match($mv,$same,$c)['songId']==='a','verified original MV playlist plus explicit language must disambiguate a genre collection');unset($mv['_ownerPlaylistIds']);assert_nt(nt_match($mv,$same,$c)['status']==='review','MV title alone must not bypass duplicate genre review');
echo "PASS official playlist + original MV language evidence separates collection titles\n";
