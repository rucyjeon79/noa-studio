<?php
declare(strict_types=1);if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/popularity-store.php';
/** Only Work_music's verified audio stream handler calls this server-side hook.
 * A public heartbeat cannot establish that an audio stream started. */
function np_stream_started(PDO $db,string $token,string $songKey,bool $admin,int $now):bool{
 if(!preg_match('/^[a-f0-9]{64}$/D',$token))return false;
 $q=$db->prepare("UPDATE noa_play_sessions SET started_at=?,last_at=?,last_position=0,credited=0,status='playing' WHERE token=? AND song_key=? AND status='pending' AND created_at>=?");
 if($admin){$q=$db->prepare("UPDATE noa_play_sessions SET status='excluded',reason='admin_test' WHERE token=? AND song_key=? AND status='pending'");$q->execute([$token,$songKey]);return false;}
 $q->execute([$now,$now,$token,$songKey,$now-120]);return $q->rowCount()===1;
}
function np_start_play(PDO $db,string $actor,string $sid,string $key,bool $admin,?int $now=null):array{
 $now??=time();$policy=np_policy($db)['values'];np_validate_policy($policy);
 if($admin){np_error($db,'play_rejected','admin_test');throw new DomainException('admin_test_excluded');}
 if(!$policy['playbackIntegrationEnabled'])throw new DomainException('awaiting_music_integration');
 if(!(int)$db->query("SELECT GET_LOCK('noa_play_".substr($actor,0,40)."',0)")->fetchColumn())throw new DomainException('play_busy');
 try{$q=$db->prepare('SELECT COUNT(*) FROM noa_play_sessions WHERE actor=? AND created_at>?');$q->execute([$actor,$now-3600]);if((int)$q->fetchColumn()>=$policy['actorStartHourlyLimit']){np_error($db,'play_rejected','start_rate_limit');throw new DomainException('start_rate_limit');}
 $token=bin2hex(random_bytes(32));$q=$db->prepare("INSERT INTO noa_play_sessions(token,actor,song_id,song_key,created_at,status,policy) VALUES(?,?,?,?,?,'pending',?)");$q->execute([$token,$actor,$sid,$key,$now,np_json($policy)]);return ['token'=>$token,'minimumSeconds'=>$policy['minimumSeconds'],'heartbeatSeconds'=>min(10,intdiv($policy['heartbeatMaxGap'],2)),'requiresVerifiedStream'=>true];
 }finally{$db->query("SELECT RELEASE_LOCK('noa_play_".substr($actor,0,40)."')");}
}
/** Pure heartbeat reducer: trust server time and bounded media progress together. */
function np_play_progress(array $s,float $position,string $event,int $now):array{
 $p=json_decode($s['policy'],true,512,JSON_THROW_ON_ERROR);$wall=$now-(int)($s['last_at']??$now);$elapsed=$now-(int)($s['started_at']??$now);$delta=$position-(float)$s['last_position'];$credit=0.0;
 if(!in_array($event,['progress','pause','ended','error'],true)||!is_finite($position)||$position<0)throw new DomainException('invalid_progress');
 if($event==='error')return ['status'=>'excluded','reason'=>'playback_failed','credited'=>(float)$s['credited'],'position'=>$position];
 if($s['status']!=='playing')return ['status'=>$s['status'],'reason'=>$s['reason'],'credited'=>(float)$s['credited'],'position'=>$position];
 if($elapsed>$p['sessionMaxSeconds'])return ['status'=>'excluded','reason'=>'session_expired','credited'=>(float)$s['credited'],'position'=>$position];
 if($event!=='pause'&&$wall>=1&&$wall<=$p['heartbeatMaxGap']&&$delta>0&&$delta<=$wall*1.25+1)$credit=min((float)$wall,$delta);
 return ['status'=>'playing','reason'=>null,'credited'=>(float)$s['credited']+$credit,'position'=>$position];
}
function np_progress_play(PDO $db,string $token,string $actor,float $position,string $event,bool $admin,?int $now=null):array{
 $now??=time();if(!preg_match('/^[a-f0-9]{64}$/D',$token))throw new DomainException('unknown_play');$lock='noa_play_'.substr($actor,0,40);
 if(!(int)$db->query("SELECT GET_LOCK('".$lock."',0)")->fetchColumn())throw new DomainException('play_busy');
 try{$db->beginTransaction();$q=$db->prepare('SELECT * FROM noa_play_sessions WHERE token=? AND actor=? FOR UPDATE');$q->execute([$token,$actor]);$s=$q->fetch(PDO::FETCH_ASSOC);if(!$s)throw new DomainException('unknown_play');$p=json_decode($s['policy'],true,512,JSON_THROW_ON_ERROR);
 if($admin)$r=['status'=>'excluded','reason'=>'admin_test','credited'=>(float)$s['credited'],'position'=>$position];else $r=np_play_progress($s,$position,$event,$now);
 if($s['status']==='counted'){$db->commit();return ['accepted'=>true,'duplicate'=>true];}
 if($r['status']==='playing'&&$r['credited']>=$p['minimumSeconds']){
  $q=$db->prepare('SELECT COUNT(*) FROM noa_valid_plays WHERE actor=? AND song_id=? AND accepted_at>?');$q->execute([$actor,$s['song_id'],$now-$p['songCooldownSeconds']]);$cool=(int)$q->fetchColumn();$q=$db->prepare('SELECT COUNT(*) FROM noa_valid_plays WHERE actor=? AND accepted_at>?');$q->execute([$actor,$now-3600]);$rate=(int)$q->fetchColumn();
  if($cool||$rate>=$p['actorHourlyLimit']){$r['status']='excluded';$r['reason']=$cool?'song_cooldown':'actor_rate_limit';}else{$q=$db->prepare('INSERT INTO noa_valid_plays(token,actor,song_id,accepted_at,seconds_played) VALUES(?,?,?,?,?)');$q->execute([$token,$actor,$s['song_id'],$now,$r['credited']]);$r['status']='counted';}
 }
 if($event==='ended'&&$r['status']==='playing'){$r['status']='excluded';$r['reason']='short_play';}
 $q=$db->prepare('UPDATE noa_play_sessions SET last_at=?,last_position=?,credited=?,status=?,reason=? WHERE token=?');$q->execute([$now,$r['position'],$r['credited'],$r['status'],$r['reason'],$token]);if($r['status']==='excluded'&&$s['status']!=='excluded')np_error($db,'play_rejected',$r['reason']);$db->commit();return ['accepted'=>$r['status']==='counted','status'=>$r['status'],'reason'=>$r['reason']];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}finally{$db->query("SELECT RELEASE_LOCK('".$lock."')");}
}
