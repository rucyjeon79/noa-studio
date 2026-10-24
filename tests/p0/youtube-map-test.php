<?php
// Run the operating view's actual pure functions against isolated SQL-shaped rows.
declare(strict_types=1);define('_GNUBOARD_',true);$root=dirname(__DIR__,2);require $root.'/bridge/youtube-core.php';require $root.'/bridge/sound-core.php';
/** Extract a complete named function, ignoring braces in comments/string tokens.
 * Runtime control-flow/layout changes cannot introduce endpoint code into eval.
 */
function youtube_test_function(string $source,string $name):string{
 $tokens=token_get_all($source);$text=static fn($token)=>is_array($token)?$token[1]:$token;
 for($i=0;$i<count($tokens);$i++){
  if(!is_array($tokens[$i])||$tokens[$i][0]!==T_FUNCTION)continue;
  $j=$i+1;while(isset($tokens[$j])&&((is_array($tokens[$j])&&in_array($tokens[$j][0],[T_WHITESPACE,T_COMMENT,T_DOC_COMMENT],true))||$tokens[$j]==='&'))$j++;
  if(!isset($tokens[$j])||!is_array($tokens[$j])||$tokens[$j][0]!==T_STRING||$tokens[$j][1]!==$name)continue;
  $code='';$depth=0;$body=false;
  for($k=$i;$k<count($tokens);$k++){
   $token=$tokens[$k];$code.=$text($token);
   if($token==='{'){$depth++;$body=true;}
   elseif(is_array($token)&&in_array($token[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true))$depth++;
   elseif($token==='}'&&$body&&--$depth===0)return $code;
  }
  throw new RuntimeException('incomplete_runtime_function:'.$name);
 }
 throw new RuntimeException('missing_runtime_function:'.$name);
}
$source=file_get_contents($root.'/deploy/noa-youtube.php');
foreach(['noa_video_legacy_lyrics','noa_video_detail']as $name)eval(youtube_test_function($source,$name));
function row(string $key,string $id,string $lyrics,array $extra=[]):array{return ['doc_key'=>$key,'payload'=>json_encode($extra+['body'=>['youtubeUrl'=>'https://www.youtube.com/watch?v='.$id,'lyricsBlock'=>$lyrics]])];}
$raw="[Verse]\n원문\n\n[Chorus]\n후렴";$rows=[row('one','AAAAAAAAAAA',$raw),row('two','BBBBBBBBBBB','different'),row('private','CCCCCCCCCCC','private',['visibility'=>'private']),row('dup1','DDDDDDDDDDD','one'),row('dup2','DDDDDDDDDDD','two')];
$map=noa_video_legacy_lyrics($rows,false);if($map['AAAAAAAAAAA']['one']!==$raw||isset($map['CCCCCCCCCCC'])||count($map['DDDDDDDDDDD'])!==2)throw new RuntimeException('legacy mapping/visibility/original preservation failed');
$videos=[];foreach(['AAAAAAAAAAA'=>'review','BBBBBBBBBBB'=>'rejected','DDDDDDDDDDD'=>'review','EEEEEEEEEEE'=>'conflict'] as $id=>$status)$videos[$id]=['status'=>['privacyStatus'=>'public','embeddable'=>true],'match'=>['status'=>$status]];
$mediaDetails=[];foreach($videos as $id=>$video)$mediaDetails[$id]=noa_video_detail($id,$video,[],$map,false);
if($mediaDetails['AAAAAAAAAAA']['lyrics']!==$raw||$mediaDetails['BBBBBBBBBBB']['lyrics']!==''||$mediaDetails['DDDDDDDDDDD']['lyrics']!==''||$mediaDetails['EEEEEEEEEEE']['lyrics']!=='')throw new RuntimeException('exact ID/rejection/ambiguity mapping failed');
// Exercise canonical precedence, matched/approved authorization and original bytes.
$canonical=$raw."\ncanonical";$video=['snippet'=>['description'=>'Exact description'],'status'=>['privacyStatus'=>'public','embeddable'=>true],'match'=>['status'=>'matched','songId'=>'song1']];$songs=['song1'=>['public_verified'=>true,'fields'=>['lyricsBlock'=>$canonical]]];
$detail=noa_video_detail('AAAAAAAAAAA',$video,$songs,$map,false);
if($detail!==['videoId'=>'AAAAAAAAAAA','description'=>'Exact description','lyrics'=>$canonical])throw new RuntimeException('canonical original-text precedence failed');
$video['match']['status']='approved';if(noa_video_detail('AAAAAAAAAAA',$video,$songs,$map,false)['lyrics']!==$canonical)throw new RuntimeException('approved mapping lost');
foreach(['rejected','conflict']as $status){$video['match']['status']=$status;if(noa_video_detail('AAAAAAAAAAA',$video,$songs,$map,false)['lyrics']!=='')throw new RuntimeException('explicit decision overridden');}
$video['match']['status']='matched';$songs['song1']['public_verified']=false;
if(noa_video_detail('FFFFFFFFFFF',$video,$songs,[],false)['lyrics']!==''||noa_video_detail('FFFFFFFFFFF',$video,$songs,[],true)['lyrics']!==$canonical)throw new RuntimeException('canonical publication/admin guard failed');
$songs['song1']['public_verified']=true;$songs['song1']['fields']['visibility']='private';
if(noa_video_detail('FFFFFFFFFFF',$video,$songs,[],false)['lyrics']!=='')throw new RuntimeException('private canonical lyrics leaked');
$video['status']['privacyStatus']='private';if(noa_video_detail('AAAAAAAAAAA',$video,$songs,$map,false)!==null)throw new RuntimeException('private video detail exposed');
$video['status']=['privacyStatus'=>'public','embeddable'=>false];if(noa_video_detail('AAAAAAAAAAA',$video,$songs,$map,false)!==null)throw new RuntimeException('blocked video detail exposed');
echo "YOUTUBE_ORIGINAL_LYRIC_MAPPING_OK\n";
