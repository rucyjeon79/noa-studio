<?php
declare(strict_types=1);
require_once __DIR__.'/member-access.php';
function nmb_data(array $m,string $admin=''):array{$a=nam_access($m,$admin);$level=$a['level'];return ['level'=>$level,'label'=>$a['name'],'mark'=>$a['admin']?'N':([2=>'S',3=>'S',4=>'V',5=>'C',6=>'C'][$level]??'S'),'premium'=>in_array($level,[4,6],true),'admin'=>$a['admin']];}
function nmb_html(array $badge,bool $large=false):string{$level=(int)$badge['level'];$label=htmlspecialchars((string)$badge['label'],ENT_QUOTES,'UTF-8');return '<span class="noa-rank-badge noa-rank-'.$level.($large?' noa-rank-large':'').(!empty($badge['premium'])?' noa-rank-premium':'').'" role="img" aria-label="'.$label.'" title="'.$label.'"><span aria-hidden="true">'.htmlspecialchars((string)$badge['mark']).'</span></span>';}
function nmb_lookup(string $owner,?PDO $db=null):?array{
 global $g5,$config;if($owner==='')return null;static $cache=[];if(array_key_exists($owner,$cache))return $cache[$owner];if(empty($g5['member_table'])||!preg_match('/^[A-Za-z0-9_]+$/D',$g5['member_table']))return null;
 try{if($db){$q=$db->prepare('SELECT mb_id,mb_level FROM `'.$g5['member_table'].'` WHERE mb_id=?');$q->execute([$owner]);$m=$q->fetch(PDO::FETCH_ASSOC);}else{$m=sql_fetch('SELECT mb_id,mb_level FROM `'.$g5['member_table'].'` WHERE mb_id=\''.sql_escape_string($owner).'\'');}
 }catch(Throwable $e){return null;}
 if($m){try{require_once __DIR__.'/subscription-access.php';$m=$db?ns_apply_member($db,$m,time()):ns_apply_native_member($m,time());}catch(Throwable $e){/* Badge failure never blocks a post. */}}
 return $cache[$owner]=$m?nmb_data($m,($config['cf_admin']??'')===$owner?'super':''):null;
}
