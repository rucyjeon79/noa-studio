<?php
declare(strict_types=1);
$root=sys_get_temp_dir().'/noa-home-render';@mkdir($root.'/noa-app',0700,true);@mkdir($root.'/noa-bridge',0700,true);
copy(__DIR__.'/../../deploy/noa-app/home.php',$root.'/noa-app/home.php');copy(__DIR__.'/../../bridge/notices.php',$root.'/noa-bridge/notices.php');file_put_contents($root.'/noa-sitemap.php','');
$common=<<<'CODE'
<?php
define('_GNUBOARD_',true);$is_member=false;$member=[];$is_admin='';$g5=['board_table'=>'g5_board','group_table'=>'g5_group','write_prefix'=>'g5_write_'];
function sql_fetch($sql,$error=false){return ['bo_list_level'=>1,'bo_read_level'=>1,'gr_use_access'=>0,'bo_use_cert'=>''];}
function sql_query($sql,$error=false){return true;}
function sql_fetch_array($r){static $i=5;if($i<1)return false;$id=$i--;return ['wr_id'=>$id,'wr_subject'=>$id===5?'NOA STUDIO 공지사항을 안내합니다':'이전 공지사항 '.$id,'wr_content'=>str_repeat("<p>공지사항 본문입니다. 음악과 함께하는 소식을 확인하세요.</p>",40), 'wr_datetime'=>'2026-10-26 18:00:00','wr_option'=>'html1','wr_is_comment'=>0];}
require __DIR__.'/noa-app/home.php';
CODE;
file_put_contents($root.'/index.php',$common);$html=shell_exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg($root.'/index.php'));if(!str_contains($html,'noa-notice-5'))throw new RuntimeException('home_render_failed');$html=str_replace('</head>','<link rel="stylesheet" href="/noa-account.css"><script src="/noa-account.js" defer></script></head>',$html);@mkdir('membership-proof',0700,true);file_put_contents('membership-proof/home.html',$html);echo "HOME_REAL_TEMPLATE_FIVE_NOTICE_FIXTURES_RENDERED\n";
