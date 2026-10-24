<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
$root=sys_get_temp_dir().'/noa-cache-'.bin2hex(random_bytes(8));
mkdir($root.'/extend',0700,true);
copy(dirname(__DIR__,2).'/deploy/noa-design.extend.php',$root.'/extend/noa.design.php');
try {
 file_put_contents($root.'/noa-browse.js','old script');
 require $root.'/extend/noa.design.php';
 $html='<script src="/noa-browse.js?v=20261024-category-complete" defer></script><p>unchanged</p>';
 $first=noa_policy_script_revision($html);
 if(!str_contains($first,'?v='.hash('sha256','old script')))throw new RuntimeException('installed_source_hash_missing');
 file_put_contents($root.'/noa-browse.js','new four level script');
 $next=noa_policy_script_revision($html);
 if(!str_contains($next,'?v='.hash('sha256','new four level script'))||$next===$first)throw new RuntimeException('stale_cache_key_reused');
 if(noa_policy_script_revision($next)!==$next||!str_contains($next,'<p>unchanged</p>'))throw new RuntimeException('rewrite_not_idempotent');
 echo "NOA_DEPLOYED_CONTENT_CACHE_REVISION_OK\n";
}finally{unlink($root.'/noa-browse.js');unlink($root.'/extend/noa.design.php');rmdir($root.'/extend');rmdir($root);}
