<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
const NT_CHANNEL='UCwYy9xsAqDFat6AV5UKrfgA';
function nt_json(mixed $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function nt_ep(string $s):?int{
 if(preg_match('/EP[.\s]*\d+\s*(?:~|〜|–|-)\s*(?:EP[.\s]*)?\d+/iu',$s))return null;
 preg_match_all('/(?<![A-Za-z])EP[.\s]*([0-9]{1,3})(?![0-9])/iu',$s,$m);$n=array_unique(array_map('intval',$m[1]));return count($n)===1&&$n[0]>0?$n[0]:null;
}
function nt_normalize(string $s):string{
 if(class_exists('Normalizer'))$s=Normalizer::normalize($s,Normalizer::FORM_KC)?:$s;
 $s=mb_strtolower($s,'UTF-8');$s=preg_replace('/^\s*(?:\[[^\]]{1,60}\]\s*)*/u','',$s);
 $s=preg_replace('/^\s*EP[.\s]*[0-9]{1,3}\s*[:|·.\-]?\s*/iu','',$s);
 return preg_replace('/[^\p{L}\p{N}]+/u','',$s);
}
function nt_titles(string $s):array{
 $out=[];foreach(array_slice(preg_split('/[|｜]/u',$s),0,3)as $piece){
  if(preg_match('/^\s*(?:\[[^\]]+\]\s*)?EP[.\s]*\d+\s*$/iu',$piece))continue;
  foreach([$piece,preg_split('/\s+-\s+/u',$piece)[0],preg_replace('/\([^)]*(?:OST|Ver[.]?)[^)]*\)/iu','',preg_split('/\s+-\s+/u',$piece)[0]),preg_replace('/\s*\([^)]{1,100}\)\s*$/u','',preg_split('/\s+-\s+/u',$piece)[0])]as $p){$n=nt_normalize(trim($p));if(mb_strlen($n)>=2)$out[$n]=true;}
  if($out)break;
 }return array_keys($out);
}
function nt_language(string $title,string $description=''):?string{
 $s=$title.' '.substr($description,0,2000);$found=[];foreach(['ko'=>'KR','ja'=>'JP','en'=>'EN','th'=>'TH'] as $language=>$code)if(preg_match('/\('.$code.'\)/i',$title))$found[$language]=true;
 foreach(['ja'=>'/J[ -]?POP|Japanese\s*(?:Ver|Edition|Original)/iu','en'=>'/(?<![A-Za-z-])POP\s*(?:Original|Edition)|English\s*(?:POP|Ver|Edition)/iu','th'=>'/Thai\s*(?:Original|Ver|Edition)/iu','ko'=>'/K[ -]?POP\s*(?:Original|Ver|Edition)|Korean\s*(?:POP|Ver|Edition)/iu']as $lang=>$re)if(preg_match($re,$title))$found[$lang]=true;
 if(count($found)>1)return null;if($found)return array_key_first($found);
 if(preg_match('/[\x{3040}-\x{30ff}]/u',$title))return 'ja';if(preg_match('/[\x{0e00}-\x{0e7f}]/u',$title))return 'th';if(preg_match('/[가-힣]/u',$title))return 'ko';return null;
}
function nt_regex(string $pattern,string $value):bool{
 if(strlen($pattern)>240||str_contains($pattern,'~'))throw new InvalidArgumentException('invalid_rule_pattern');
 $r=preg_match('~(*LIMIT_MATCH=10000)(*LIMIT_RECURSION=100)'.$pattern.'~iu',$value);if($r===false)throw new InvalidArgumentException('invalid_rule_pattern');return $r===1;
}
function nt_rule_valid(array $c):void{
 if(!in_array($c['kind']??'',['playlist_id','playlist_title','catalog_genre','video_title'],true)||!is_array($c['values']??null)||!$c['values']||count($c['values'])>40)throw new InvalidArgumentException('invalid_rule_condition');
 foreach($c['values']as $v){if(!is_string($v)||strlen($v)>240)throw new InvalidArgumentException('invalid_rule_value');if(in_array($c['kind'],['playlist_title','video_title'],true))nt_regex($v,'validation');}
 if(isset($c['language'])&&!in_array($c['language'],['ko','ja','en','th'],true))throw new InvalidArgumentException('invalid_rule_language');
}
/** One primary branch; many playlists/evidence entries are retained separately. */
function nt_classify(array $v,?array $song,array $lists,array $rules):array{
 $hits=[];$title=(string)($v['snippet']['title']??'');$language=nt_language($title);
 foreach($rules as $r){if(empty($r['enabled']))continue;$c=$r['condition'];nt_rule_valid($c);$kind=$c['kind'];$matched=[];
  if(isset($c['language'])&&($song['language']??$language)!==$c['language'])continue;
  foreach($c['values']as $value){
   if($kind==='catalog_genre'&&($song['genre_id']??'')===$value)$matched[]=$value;
   if($kind==='video_title'&&nt_regex($value,$title))$matched[]=$value;
   foreach($lists as $p)if(($kind==='playlist_id'&&($p['id']??'')===$value)||($kind==='playlist_title'&&nt_regex($value,(string)($p['snippet']['title']??''))))$matched[]=$p['id'];
  }
  if($matched){$tier=['playlist_id'=>10,'playlist_title'=>20,'catalog_genre'=>30,'video_title'=>40][$kind];$hits[]=['category'=>$r['category_id'],'tier'=>$tier,'priority'=>(int)$r['priority'],'rule'=>$r['rule_id'],'kind'=>$kind,'evidence'=>array_values(array_unique($matched))];}
 }
 usort($hits,fn($a,$b)=>($a['tier']<=>$b['tier'])?:($a['priority']<=>$b['priority']));
 if(!$hits)return ['status'=>'unclassified','reason'=>!empty($song['genre_id'])&&$song['genre_id']!=='unclassified'?'outside_enabled_category_policy':'no_category_evidence','categories'=>[],'evidence'=>[]];
 $top=array_values(array_filter($hits,fn($h)=>$h['tier']===$hits[0]['tier']&&$h['priority']===$hits[0]['priority']));
 $roots=[];foreach($top as $h)$roots[in_array($h['category'],['original','collection'],true)?'kpop-original':$h['category']]=true;
 if(count($roots)>1)return ['status'=>'review','reason'=>'category_conflict','categories'=>[],'evidence'=>$hits];
 $categories=array_values(array_unique(array_column($top,'category')));
 if(in_array('original',$categories,true)&&in_array('collection',$categories,true))return ['status'=>'review','reason'=>'subcategory_conflict','categories'=>[],'evidence'=>$hits];
 return ['status'=>'classified','categories'=>$categories,'evidence'=>$hits];
}
function nt_match(array $v,array $songs,array $classification):array{
 $existing=$v['match']??[];if(($existing['status']??'')==='rejected')return ['status'=>'rejected','songId'=>null,'reason'=>'administrator_rejected'];
 if(!empty($existing['songId']))return ['status'=>'preserved','songId'=>$existing['songId'],'reason'=>'existing_confirmed_link'];
 $title=(string)($v['snippet']['title']??'');if(preg_match('/\b(?:ACT\s*[. ]*\d+[^\r\n]*Playlist|Playlist\b)|연속\s*듣기|連続再生|Continuous\s*Listening/iu',$title))return ['status'=>'not_applicable','songId'=>null,'reason'=>'compilation'];
 $keys=nt_titles($title);$ep=nt_ep($title);$language=nt_language($title);$categories=$classification['categories'];$genre=null;
 if(($classification['status']??'')==='review')return ['status'=>'review','songId'=>null,'reason'=>'category_conflict','candidates'=>[]];
 foreach(['your-story','cover-reborn','original']as $g)if(in_array($g,$categories,true))$genre=$g==='original'?'kpop-original':$g;
 $declared=nt_declared_genres($title);if(count($declared)>1)return ['status'=>'review','songId'=>null,'reason'=>'declared_genre_conflict','candidates'=>[]];if(count($declared)===1){if($genre!==null&&$genre!==$declared[0])return ['status'=>'review','songId'=>null,'reason'=>'category_title_genre_conflict','candidates'=>[]];$genre=$declared[0];}
 $officialMv=in_array('PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY',$v['_ownerPlaylistIds']??[],true)&&preg_match('/Official\s*MV/iu',$title)&&preg_match('/Original\s*Song/iu',$title);
 if($officialMv&&$language!==null){$expected=['ko'=>'kpop-original','ja'=>'jpop-original','en'=>'pop-original','th'=>'thai-original'][$language];if($genre!==null&&$genre!==$expected)return ['status'=>'review','songId'=>null,'reason'=>'official_mv_genre_conflict','candidates'=>[]];$genre=$expected;}
 $candidates=[];$evidence=[];
 foreach($songs as $id=>$s){if(!empty($s['owner_id']))continue;$fields=$s['fields']??[];$songTitle=(string)(($fields['confirmedTitle']??'')?:($fields['title']??''));if(!array_intersect($keys,nt_titles($songTitle)))continue;
  if($ep!==null&&(int)($s['ep']??0)!==$ep)continue;
  if($language!==null&&($s['language']??'und')!==$language)continue;
  if($genre!==null&&($s['genre_id']??'')!==$genre)continue;
  // A remaster/reborn/alternate is a separate identity. Do not silently select it.
  $variant=(string)($s['version_name']??'');$marked=(bool)preg_match('/mastered|remaster|reborn|rebirth/iu',$title);
  if($variant!==''&&!in_array(mb_strtolower($variant),['original','default','unspecified','기본','원곡'],true)&&!str_contains(mb_strtolower($title),mb_strtolower($variant)))continue;
  if($marked&&($variant===''||in_array(mb_strtolower($variant),['original','default','unspecified','기본','원곡'],true))&&!preg_match('/mastered|remaster|reborn|rebirth/iu',$songTitle))continue;
  $candidates[]=$id;$evidence=['normalized_title'];if($ep!==null)$evidence[]='ep';if($language!==null)$evidence[]='language';if($genre!==null)$evidence[]='category';
 }
 $strong=$language!==null&&($ep!==null||$genre!==null);
 if(count($candidates)===1&&$strong)return ['status'=>'confirmed','songId'=>$candidates[0],'reason'=>'unique_multiple_evidence','evidence'=>$evidence];
 return ['status'=>count($candidates)?'review':'unmatched','songId'=>null,'reason'=>count($candidates)>1?'ambiguous_candidates':(count($candidates)?'insufficient_evidence':'no_exact_candidate'),'candidates'=>array_slice($candidates,0,20),'evidence'=>$evidence];
}
function nt_declared_genres(string $text):array{
 $patterns=['kpop-original'=>'K[ -]?POP\s*(?:Original|원곡)|Korean\s*POP','jpop-original'=>'J[ -]?POP\s*Original','pop-original'=>'(?<![A-Za-z-])POP\s*Original|English\s*POP','thai-original'=>'Thai\s*Original','joseon-ballad'=>'Joseon\s*Ballad|조선\s*발라드','panpop'=>'PANPOP','echoes-of-joseon'=>'Echoes\s*of\s*Joseon','groovy-airy-pop'=>'Groovy\s*Airy\s*POP','narrative-piano-indie'=>'Narrative\s*Piano\s*Indie','dreamy-deep-house'=>'Dreamy\s*Deep\s*House','fantasy-ambient-edm'=>'Fantasy\s*Ambient\s*EDM','edm-kpop-club'=>'EDM\s*K[ -]?POP\s*Club|K[ -]?POP\s*Club\s*Remix','latin-afrobeats-edm'=>'Latin\s*Afrobeats\s*EDM'];$found=[];foreach($patterns as $g=>$p)if(preg_match('~'.$p.'~iu',$text))$found[]=$g;return $found;
}
function nt_match_playlist(array $content,array $catalog):array{
 $title=(string)($content['snippet']['title']??'');if(!preg_match('/\bACT\s*[.]?\s*([0-9]{1,3})\b/iu',$title,$m))return ['status'=>'not_applicable','reason'=>'genre_overview_not_act_playlist','playlistId'=>null];
 $genres=nt_declared_genres($title);if(count($genres)!==1)return ['status'=>'review','reason'=>'playlist_genre_ambiguous','playlistId'=>null];$act=(int)$m[1];$lang=nt_language($title);$candidates=[];
 foreach($catalog as $id=>$p){if(($p['genre_id']??'')!==$genres[0]||(int)$p['act_number']!==$act||!empty($p['owner_id']))continue;$identity=json_decode($p['identity_json'],true,512,JSON_THROW_ON_ERROR);if($lang!==null&&($identity[2]??'')!==$lang)continue;if(preg_match('/mastered|remaster|reborn/iu',$title)&&!preg_match('/mastered|remaster|reborn/iu',(string)($identity[3]??'')))continue;$candidates[]=$id;}
 return count($candidates)===1?['status'=>'confirmed','reason'=>'unique_act_genre_language','playlistId'=>$candidates[0],'evidence'=>['act'=>$act,'genre'=>$genres[0],'language'=>$lang]]:['status'=>'review','reason'=>count($candidates)?'multiple_catalog_playlists':'no_exact_catalog_playlist','playlistId'=>null,'candidates'=>$candidates];
}
