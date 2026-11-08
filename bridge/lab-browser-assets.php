<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }

/** Browser results belong to the existing ai_lab store. This does not launch a provider. */
function lab_browser_boxes(string $data, int $start, int $end): array {
    $boxes = [];
    while ($start < $end) {
        if ($end - $start < 8 || count($boxes) >= 4096) throw new InvalidArgumentException('invalid_clip_container');
        $size = unpack('N', substr($data, $start, 4))[1];
        $type = substr($data, $start + 4, 4);
        // Bounded non-fragmented MP4 only; oversized/extended atoms are not accepted.
        if ($size < 8 || $size > $end - $start) throw new InvalidArgumentException('invalid_clip_container');
        $boxes[] = ['type'=>$type, 'start'=>$start, 'p'=>$start+8, 'end'=>$start+$size];
        $start += $size;
    }
    return $boxes;
}
function lab_browser_box(array $boxes, string $type): array {
    $found = array_values(array_filter($boxes, fn($b)=>$b['type']===$type));
    if (count($found)!==1) throw new InvalidArgumentException('invalid_clip_container');
    return $found[0];
}
function lab_browser_children(string $data, array $box): array {
    return lab_browser_boxes($data, $box['p'], $box['end']);
}
function lab_browser_probe(string $path): array {
    $size = filesize($path);
    if ($size===false || $size<256 || $size>32*1048576 || is_link($path)) throw new InvalidArgumentException('invalid_clip_size');
    if ((new finfo(FILEINFO_MIME_TYPE))->file($path)!=='video/mp4') throw new InvalidArgumentException('invalid_clip_container');
    $data = file_get_contents($path);
    if ($data===false || strlen($data)!==$size) throw new RuntimeException('clip_read_failed');
    $top = lab_browser_boxes($data, 0, $size);
    lab_browser_box($top, 'ftyp');
    $moov = lab_browser_box($top, 'moov');
    $media = array_filter($top, fn($b)=>$b['type']==='mdat' && $b['end']>$b['p']);
    if (!$media || array_filter($top, fn($b)=>$b['type']==='moof')) throw new InvalidArgumentException('invalid_clip_container');
    $video = [];
    foreach (lab_browser_children($data,$moov) as $trak) {
        if ($trak['type']!=='trak') continue;
        $mdia=lab_browser_box(lab_browser_children($data,$trak),'mdia');
        $children=lab_browser_children($data,$mdia);
        $hdlr=lab_browser_box($children,'hdlr');
        if ($hdlr['end']-$hdlr['p']<12) throw new InvalidArgumentException('invalid_clip_container');
        if (substr($data,$hdlr['p']+8,4)!=='vide') continue;
        $mdhd=lab_browser_box($children,'mdhd');
        $p=$mdhd['p'];
        if ($mdhd['end']-$p<24 || ord($data[$p])!==0) throw new InvalidArgumentException('unsupported_clip_container');
        $scale=unpack('N',substr($data,$p+12,4))[1];
        $ticks=unpack('N',substr($data,$p+16,4))[1];
        if (!$scale || !$ticks) throw new InvalidArgumentException('invalid_clip_duration');
        $minf=lab_browser_box($children,'minf');
        $minfChildren=lab_browser_children($data,$minf);
        $dinf=lab_browser_box($minfChildren,'dinf');$dref=lab_browser_box(lab_browser_children($data,$dinf),'dref');
        if ($dref['end']-$dref['p']<8 || unpack('N',substr($data,$dref['p']+4,4))[1]!==1) throw new InvalidArgumentException('external_clip_reference');
        $ref=lab_browser_box(lab_browser_boxes($data,$dref['p']+8,$dref['end']),'url ');
        if ($ref['end']-$ref['p']!==4 || substr($data,$ref['p'],4)!=="\0\0\0\1") throw new InvalidArgumentException('external_clip_reference');
        $stbl=lab_browser_box($minfChildren,'stbl');
        $stsd=lab_browser_box(lab_browser_children($data,$stbl),'stsd');
        if ($stsd['end']-$stsd['p']<8 || unpack('N',substr($data,$stsd['p']+4,4))[1]!==1) throw new InvalidArgumentException('unsupported_clip_codec');
        $entry=lab_browser_box(lab_browser_boxes($data,$stsd['p']+8,$stsd['end']),'avc1');
        if ($entry['end']-$entry['p']<78) throw new InvalidArgumentException('invalid_clip_container');
        $width=unpack('n',substr($data,$entry['p']+24,2))[1];
        $height=unpack('n',substr($data,$entry['p']+26,2))[1];
        $duration=$ticks/$scale;
        if ($duration<=0 || $duration>30.05 || $width<128 || $height<128 || max($width,$height)>3840 || min($width,$height)>2160) throw new InvalidArgumentException('invalid_clip_dimensions');
        $video[]=['width'=>$width,'height'=>$height,'duration'=>$duration,'codec'=>'h264'];
    }
    if (count($video)!==1) throw new InvalidArgumentException('invalid_clip_container');
    return $video[0]+['bytes'=>$size,'sha256'=>hash('sha256',$data),'checks'=>['containerValid'=>true,'decodedByServer'=>false,'fullMusicVideo'=>false]];
}
function lab_browser_source(string $url): string {
    if (!preg_match('~^https://flow[.]google[.]com/project/[a-f0-9-]{36}/edit/[a-f0-9-]{36}$~D',$url)) throw new InvalidArgumentException('invalid_clip_source');
    return $url;
}
function lab_browser_import(array &$s, array $input, string $temp, string $owner, ?array $source=null): array {
    $request=lab_id((string)($input['requestId']??''));
    $url=lab_browser_source((string)($input['sourceUrl']??''));
    $key=(string)($input['trackKey']??'');
    if ($key!=='' && (!$source || $source['key']!==$key || (string)$source['revision']!==(string)($input['sourceRevision']??''))) throw new DomainException('source_revision_conflict');
    $probe=lab_browser_probe($temp);
    if (!is_string($input['sha256']??null) || !hash_equals($probe['sha256'],$input['sha256'])) throw new DomainException('clip_checksum_mismatch');
    $fingerprint=hash('sha256',json_encode([$owner,$key,$source['revision']??0,$url,$probe['sha256']],JSON_THROW_ON_ERROR));
    foreach ($s['jobs'] as $j) {
        if (($j['requestId']??'')===$request && ($j['browser']['fingerprint']??'')!==$fingerprint) throw new DomainException('request_id_reused');
        if (($j['browser']['fingerprint']??'')===$fingerprint) {
            $stored=lab_job_dir($j['id']).'/'.$j['outputs'][0]['file'];
            if (!is_file($stored) || is_link($stored) || !hash_equals($probe['sha256'],hash_file('sha256',$stored))) throw new DomainException('clip_checksum_mismatch');
            return ['job'=>lab_public_job($j),'replayed'=>true,'fileVerified'=>true];
        }
    }
    if (count($s['jobs'])>=200) throw new DomainException('job_limit');
    $id=substr(hash('sha256','n80-browser-clip:'.$fingerprint),0,32);$dir=lab_job_dir($id);
    if (isset($s['jobs'][$id]) || is_link($dir)) throw new DomainException('clip_identity_conflict');
    $createdDir=!is_dir($dir);
    if ($createdDir && !mkdir($dir,0700)) throw new RuntimeException('job_directory');
    $format=$probe['width']>=$probe['height']?'landscape':'shorts';
    $name=$format.'-'.$probe['sha256'].'.mp4';$target=$dir.'/'.$name;
    try {
        // A lost state-write response can reuse the exact owned bytes, never another file.
        if (is_link($target) || (is_file($target) && !hash_equals($probe['sha256'],hash_file('sha256',$target)))) throw new DomainException('clip_checksum_mismatch');
        if (!is_file($target) && !copy($temp,$target)) throw new RuntimeException('clip_store_failed');
        if (!chmod($target,0600) || !hash_equals($probe['sha256'],hash_file('sha256',$target))) throw new RuntimeException('clip_store_failed');
        $now=gmdate('c');
        $j=['id'=>$id,'requestId'=>$request,'type'=>'browser_clip','trackKey'=>$key,'title'=>$source?($source['title'].' · 제작 장면'):'영상 연결 테스트 · 노아 카페',
            'sourceRevision'=>$source['revision']??0,'genre'=>$source['genre']??'','cast'=>$source['cast']??'female','state'=>'clip_ready','revision'=>1,
            'createdAt'=>$now,'updatedAt'=>$now,'settings'=>['posting'=>'save','formats'=>[$format]],'attempts'=>0,
            'browser'=>['provider'=>'google_flow','sourceUrl'=>$url,'fingerprint'=>$fingerprint,'receivedBy'=>$owner,'receivedAt'=>$now,'linkedSong'=>$key!==''],
            'outputs'=>[array_merge($probe,['file'=>$name,'format'=>$format])]];
        $s['jobs'][$id]=$j;lab_event($s,'browser_clip_received',$id,$owner);
        return ['job'=>lab_public_job($j),'replayed'=>false,'fileVerified'=>true];
    } catch (Throwable $e) { if ($createdDir) { if (is_file($target)) unlink($target);rmdir($dir); }throw $e; }
}
