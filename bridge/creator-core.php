<?php
declare(strict_types=1);
require_once __DIR__.'/member-access.php';require_once __DIR__.'/package-record.php';
const NC_GENRES=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];
function nc_channel_key(string $owner):string{return 'creator-channel:'.hash('sha256',$owner);}
function nc_row(PDO $db,string $key):?array{
 $q=$db->prepare('SELECT doc_key,kind,payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)return null;$r['document']=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$r['revision']=(int)$r['revision'];return $r;
}
function nc_own(PDO $db,string $key,array $member):array{
 $r=nc_row($db,$key);if(!$r||$r['kind']!=='story'||!str_starts_with($key,'creator:')||!nam_owner($r['document'],$member))throw new DomainException('own_song_required');return $r;
}
function nc_channel(array $body):array{
 $title=trim((string)($body['title']??''));$description=trim((string)($body['description']??''));if($title===''||mb_strlen($title)>80||mb_strlen($description)>2000)throw new InvalidArgumentException('invalid_channel');return ['title'=>$title,'description'=>$description];
}
function nc_patch(array $document,array $body):array{
 $fields=$body['fields']??[];if(!is_array($fields)||array_diff(array_keys($fields),['title','lyrics','vocal','cast','description','geminiPrompt','communityPost','youtubeUrl','mvUrl']))throw new InvalidArgumentException('invalid_song_fields');
 $d=nup_patch($document,'story',$fields);$genre=$body['genre']??($d['genreId']??'your-story');if(!is_string($genre)||!in_array($genre,NC_GENRES,true))throw new InvalidArgumentException('invalid_genre');$d['genreId']=$genre;
 if(mb_strlen($d['title']??'')<1)throw new InvalidArgumentException('title_required');
 $artist=$body['originalArtist']??($d['body']['originalArtist']??'');if(!is_string($artist)||mb_strlen($artist)>200||($genre==='cover-reborn'&&trim($artist)===''))throw new InvalidArgumentException('cover_original_artist_required');$d['body']['originalArtist']=$artist;
 $visibility=$body['visibility']??($d['visibility']??'private');if(!in_array($visibility,['private','public'],true))throw new InvalidArgumentException('invalid_visibility');$d['visibility']=$visibility;
 return nup_normalize($d,'story');
}
function nc_store(PDO $db,string $key,string $kind,array $d,int $revision,string $actor):int{
 $db->beginTransaction();try{$next=nup_store($db,$key,$kind,$d,$revision,$actor);$db->commit();return $next;}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
