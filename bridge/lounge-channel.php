<?php
declare(strict_types=1);
const CHANNEL = 'UCwYy9xsAqDFat6AV5UKrfgA';
function fetchChannel(string $url): string {
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>9,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_USERAGENT=>'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',CURLOPT_HTTPHEADER=>['Accept-Language: ko-KR,ko;q=0.9']]);
    $body=curl_exec($ch);
    if (!is_string($body)||curl_getinfo($ch,CURLINFO_RESPONSE_CODE)!==200) throw new RuntimeException('source');
    return $body;
}
function collectPosts(array $node, array &$rows): void {
    foreach($node as $key=>$child){
        if(!is_array($child))continue;
        if(in_array($key,['backstagePostRenderer','postRenderer','sharedPostRenderer'],true)){
            $id=$child['postId']??'';
            if(!preg_match('/^[A-Za-z0-9_-]{8,128}$/D',$id))continue;
            $body=$child['contentText']??[];$text=$body['simpleText']??implode('',array_column($body['runs']??[],'text'));
            $rows[$id]=['title'=>$text?:'노아의 커뮤니티 게시물','url'=>'https://www.youtube.com/post/'.$id];
        }else collectPosts($child,$rows);
    }
}
function channelItems(string $kind): array {
    if($kind==='diary'){
        $page=fetchChannel('https://www.youtube.com/channel/'.CHANNEL.'/posts?hl=ko');
        if(!preg_match('/(?:var ytInitialData\s*=\s*)(\{.*?\});\s*<\/script>/s',$page,$match))throw new RuntimeException('posts');
        $data=json_decode($match[1],true,512,JSON_THROW_ON_ERROR);$rows=[];
        foreach($data['contents']['twoColumnBrowseResultsRenderer']['tabs']??[] as $tab){
            $renderer=$tab['tabRenderer']??[];
            if(empty($renderer['selected'])||!preg_match('~/posts/?$|/community/?$~',$renderer['endpoint']['commandMetadata']['webCommandMetadata']['url']??''))continue;
            collectPosts($renderer['content']??[],$rows);return array_slice(array_values($rows),0,12);
        }
        throw new RuntimeException('tab');
    }
    try{
        require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/youtube-store.php';
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        $token=ny_token(lab_read(),CHANNEL);
        $uploads=ny_get($token,'playlistItems',['part'=>'contentDetails','playlistId'=>'UU'.substr(CHANNEL,2),'maxResults'=>50]);
        $ids=array_filter(array_column(array_column($uploads['items']??[],'contentDetails'),'videoId'));
        if(!$ids)return [];
        $videos=ny_get($token,'videos',['part'=>'snippet,status','id'=>implode(',',$ids)]);
        $rows=[];
        foreach($videos['items']??[] as $video){
            $snippet=$video['snippet'];
            if($snippet['channelId']!==CHANNEL||$video['status']['privacyStatus']!=='public')continue;
            $rows[]=['title'=>$snippet['title'],'at'=>strtotime($snippet['publishedAt']),'url'=>'https://www.youtube.com/watch?v='.$video['id']];
        }
        return $rows;
    }catch(Throwable $unavailable){}
    $feed=simplexml_load_string(fetchChannel('https://www.youtube.com/feeds/videos.xml?channel_id='.CHANNEL),SimpleXMLElement::class,LIBXML_NONET);
    if(!$feed || (string)$feed->children('http://www.youtube.com/xml/schemas/2015')->channelId!==CHANNEL)throw new RuntimeException('feed');
    $items=[];
    foreach($feed->children('http://www.w3.org/2005/Atom')->entry as $entry){
        $id=(string)$entry->children('http://www.youtube.com/xml/schemas/2015')->videoId;
        if(preg_match('/^[\w-]{11}$/D',$id))$items[]=['title'=>(string)$entry->title,'at'=>strtotime((string)$entry->published),'url'=>'https://www.youtube.com/watch?v='.$id];
    }
    return $items;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$kind=$_GET['kind']??'';
if(!in_array($kind,['diary','music'],true)){http_response_code(400);echo '{"ok":false}';exit;}
$file=sys_get_temp_dir().'/noa-channel-'.CHANNEL.'-'.$kind.'.json';
$cache=json_decode((string)@file_get_contents($file),true);
try{
    if(($cache['at']??0)<time()-300){
        $items=channelItems($kind);
        $cache=['at'=>time(),'items'=>$items];
        $tmp=tempnam(sys_get_temp_dir(),'noa-feed-');if($tmp){file_put_contents($tmp,json_encode($cache));rename($tmp,$file);}
    }
    $ok=true;
}catch(Throwable $e){$ok=false;}
$items=$cache['items']??[];
if($kind==='music'){
    if(!$ok){
        try{
            require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/youtube-store.php';
            $db=noa_bridge_pdo();$run=ny_latest($db);
            if(($run['channel_id']??'')===CHANNEL){
                foreach(ny_videos($db,$run,false) as $v){
                    if(($v['status']['privacyStatus']??'')!=='public'||($v['snippet']['channelId']??'')!==CHANNEL)continue;
                    $items[]=['title'=>$v['snippet']['title'],'at'=>strtotime($v['snippet']['publishedAt']),'url'=>'https://www.youtube.com/watch?v='.$v['id']];
                }
            }
        }catch(Throwable $e){}
    }
    $now=time();$items=array_values(array_filter(array_column($items,null,'url'),fn($i)=>$i['at']<=$now&&$i['at']>$now-86400));usort($items,fn($a,$b)=>$b['at']<=>$a['at']);
}
echo json_encode(['ok'=>$ok,'items'=>$items],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
