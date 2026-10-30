<?php
// Validate the real summary parser, including empty and untrusted data.
define('_GNUBOARD_',true);
require dirname(__DIR__,2).'/deploy/noa-design.extend.php';
foreach([
 ['오늘:123,어제:45,최대:999,전체:123456',['today'=>'123','yesterday'=>'45','total'=>'123456']],
 ['오늘:0,어제:0,최대:0,전체:0',['today'=>'0','yesterday'=>'0','total'=>'0']],
 ['',null],['오늘:<script>,어제:0,최대:0,전체:0',null]
] as [$summary,$expected]){
 $GLOBALS['config']=['cf_visit'=>$summary];
 $html=noa_policy_script_revision('<html><head></head><body></body></html>');
 preg_match('~id="noa-visitor-counts">(.*?)</script>~s',$html,$match);
 if(json_decode($match[1]??'',true)!==$expected)throw new RuntimeException('Invalid visitor output');
 if(substr_count(noa_policy_script_revision($html),'id="noa-visitor-counts"')!==1)throw new RuntimeException('Duplicate counter data');
}
echo "VISITOR_SUMMARY_OK\n";
