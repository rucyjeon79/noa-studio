<?php
declare(strict_types=1);
/** Request-time entitlement overlay; no GnuBoard member rows are rewritten. */
function ns_member_key(string $owner):string{return 'subscription:member:'.hash('sha256',$owner);}
function ns_family(int $level):?int{return in_array($level,[3,4],true)?3:(in_array($level,[5,6],true)?5:null);}
function ns_effective_level(int $raw,?array $grant,int $now):int{
 $base=ns_family($raw);if($base===null||!$grant||($grant['baseLevel']??null)!==$base)return $raw;
 return ($grant['status']??'')==='active'&&is_int($grant['until']??null)&&$grant['until']>$now?($base===5?6:4):$base;
}
function ns_read_grant(PDO $db,string $owner):?array{
 $q=$db->prepare("SELECT payload FROM noa_documents WHERE doc_key=? AND kind='prefs'");$q->execute([ns_member_key($owner)]);$raw=$q->fetchColumn();if($raw===false)return null;
 $g=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($g)||!hash_equals($owner,(string)($g['ownerId']??'')))throw new RuntimeException('subscription_owner_mismatch');return $g;
}
function ns_apply_member(PDO $db,array $member,int $now):array{
 if(empty($member['mb_id'])||ns_family((int)($member['mb_level']??1))===null)return $member;
 $raw=(int)$member['mb_level'];$g=ns_read_grant($db,(string)$member['mb_id']);$member['noa_raw_level']=$raw;$member['mb_level']=ns_effective_level($raw,$g,$now);return $member;
}
function ns_month_end(int $start,?int $anchor=null):int{
 $d=(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('Asia/Seoul'));$day=$anchor??(int)$d->format('j');$next=$d->modify('first day of next month');return $next->setDate((int)$next->format('Y'),(int)$next->format('n'),min(max(1,$day),(int)$next->format('t')))->setTime((int)$d->format('H'),(int)$d->format('i'),(int)$d->format('s'))->getTimestamp();
}
