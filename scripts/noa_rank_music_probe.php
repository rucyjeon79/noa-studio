<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CREATOR_EXPIRY||!hash_equals('NOA_CREATOR_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
ob_start();require_once dirname(__DIR__).'/common.php';ob_end_clean();
$member=['mb_id'=>'noa-readonly-rank-audit','mb_level'=>3];$is_member=true;$is_admin='';
$_SERVER['REQUEST_URI']='/noa-music.php';$_SERVER['REQUEST_METHOD']='GET';
$depth=ob_get_level();ob_start();
require dirname(__DIR__).'/extend/zz.noa-music-vinyl.php';
require dirname(__DIR__).'/noa-music.php';
while(ob_get_level()>$depth+1)ob_end_flush();
$html=ob_get_clean();
preg_match('~<script type="application/json" id="noa-track-counts">(.*?)</script>~s',$html,$m);
$counts=json_decode($m[1]??'null',true);
preg_match('~const records=(.*?);\s*const collections=~s',$html,$m);
$records=json_decode($m[1]??'null',true);
$db=noa_bridge_pdo();
$groups=$db->query('SELECT song_id,COUNT(*) FROM noa_valid_plays GROUP BY song_id')->fetchAll(PDO::FETCH_KEY_PAIR);
$seen=[];$errors=0;$examples=[];
foreach($records??[] as $r){$id=$r['catalogSongId']??'';if(!isset($groups[$id]))continue;
 $value=(int)($counts['plays'][$r['key']]??0);if($value!==(int)$groups[$id])$errors++;
 if(!isset($seen[$id]))$examples[]=[$r['title'],$value];$seen[$id]=$value;
}
header('Content-Type: application/json');echo json_encode(['ok'=>is_array($records)&&is_array($counts['plays']??null)&&!$errors&&count($seen)===count($groups),'expected'=>array_sum($groups),'rendered'=>array_sum($seen),'unmatched'=>count(array_diff_key($groups,$seen)),'errors'=>$errors,'rows'=>count($records??[]),'examples'=>array_slice($examples,0,5)],JSON_THROW_ON_ERROR);
