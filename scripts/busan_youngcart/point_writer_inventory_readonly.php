<?php
declare(strict_types=1);
/* CLI read-only candidate inventory; heuristic, not proof of complete coverage.
 * Emits relative paths, line numbers, classifications and hashes only.
 * No source text, member data, credentials, remote requests or file writes.
 */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$root=realpath('/hosting/rucyjeon79/html');
if($root===false){echo '{"status":"blocked","reason":"root_unavailable"}'.PHP_EOL;exit(2);}
$skip=['data','vendor','node_modules','.git','cache','backup','backups','uploads'];
$patterns=[
    'native_point_function'=>'/\b(?:insert_point|delete_point|delete_point_by_id|get_point_sum|delete_expire_point|insert_use_point|delete_use_point)\s*\(/i',
    'point_table_reference'=>'/\b(?:g5_point|point_table|po_use_point|po_expired|po_expire_date|po_mb_point)\b/i',
    'member_balance_reference'=>'/\bmb_point\b/i',
    'point_gift_or_ai_candidate'=>'/(?:point[_-]?(?:gift|transfer|deduct|charge|refund)|(?:gift|transfer|deduct|charge|refund)[_-]?point)/i'
];
$hits=[];$errors=[];$excluded=[];$scanned=0;
$it=new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS);
$filter=new RecursiveCallbackFilterIterator($it,function($f)use($skip,&$excluded,$root){
    if($f->isLink()||($f->isDir()&&in_array(strtolower($f->getFilename()),$skip,true))){
        $excluded[]=substr($f->getPathname(),strlen($root)+1);return false;
    }
    return $f->isDir()||($f->isFile()&&preg_match('/\.(?:php[0-9]?|inc|phtml)$/i',$f->getFilename()));
});
foreach(new RecursiveIteratorIterator($filter,RecursiveIteratorIterator::LEAVES_ONLY,RecursiveIteratorIterator::CATCH_GET_CHILD) as $f){
    $rel=substr($f->getPathname(),strlen($root)+1);
    if($f->getSize()>4*1024*1024){$errors[]=['path'=>$rel,'reason'=>'size_limit'];continue;}
    $src=@file_get_contents($f->getPathname());
    if($src===false){$errors[]=['path'=>$rel,'reason'=>'unreadable'];continue;}
    $scanned++;$candidate=[];
    foreach($patterns as $kind=>$regex){
        if(preg_match_all($regex,$src,$matches,PREG_OFFSET_CAPTURE)){
            $lines=[];
            foreach($matches[0] as $m)$lines[]=substr_count(substr($src,0,$m[1]),"\n")+1;
            $candidate[$kind]=array_values(array_unique($lines));
        }
    }
    if($candidate)$hits[]=['path'=>$rel,'sha256'=>hash('sha256',$src),'matches'=>$candidate];
}
echo json_encode(['status'=>'candidate_inventory','files_scanned'=>$scanned,'matches'=>$hits,
    'excluded'=>$excluded,'errors'=>$errors,'coverage_complete'=>false,
    'checkout_ready'=>false],JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR).PHP_EOL;
