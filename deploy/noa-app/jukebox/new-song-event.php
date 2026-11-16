<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}

/** Called only after nj_import has verified the optimized MP3 and its analysis. */
function nj_new_song_event_eligible(string $key,array $doc,array $asset,?array $old,array $result):bool{
 return $key!==''&&strlen($key)<=191&&!str_starts_with($key,'jukebox:qa:')
  &&in_array($doc['_kind']??'',['single','story'],true)&&noa_sound_visible($doc,false)
  &&($asset['status']??'')==='ready'&&empty($old['audio_sha256'])
  &&!empty($result['audio_path'])&&preg_match('/^[a-f0-9]{64}$/D',(string)($asset['audio_sha256']??''))===1;
}
/** A tiny durable outbox entry shares the publication transaction. No push/network here.
 * Positive history id = pending; negative = fanout committed. Keep the key permanently
 * so remastering and notification retention cannot turn an old song into a new release.
 */
function nj_new_song_event(PDO $db,string $key,int $historyId):void{
 if(!$db->inTransaction()||$historyId<1)throw new LogicException('new_song_event_requires_publication_transaction');
 $q=$db->prepare('INSERT IGNORE INTO noa_notification_cursor (source,position) VALUES (?,?)');
 $q->execute(['music-ready:'.hash('sha256',$key),$historyId]);
}
