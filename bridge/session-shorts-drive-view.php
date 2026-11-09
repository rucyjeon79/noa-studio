<?php if(!defined('_GNUBOARD_')||!isset($status,$e,$url)){http_response_code(403);exit;} ?>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive 임시저장 연결 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ai-lab.css"><script src="/noa-ui.js" defer></script><style>main{max-width:760px;margin:auto;padding:32px 20px}h1{font-size:clamp(24px,5vw,36px)}p{line-height:1.7;overflow-wrap:anywhere}form{margin-top:20px}button{min-height:44px;max-width:100%;white-space:normal}nav{display:flex;flex-wrap:wrap;gap:20px;margin-top:28px}dl{display:grid;grid-template-columns:110px 1fr;gap:12px;margin:24px 0}dt,dd{margin:0;overflow-wrap:anywhere}</style></head>
<body class="noa-page"><main><p class="noa-eyebrow">NOA STUDIO / N80 AUTO</p><h1>Drive 임시저장 연결</h1>
<p>영상 제작 중 생성한 이미지와 영상만 작업별로 보관합니다. 기존 음원·곡정보·장르 규칙·Gem 캐릭터 자료는 그대로 사용합니다.</p>
<dl><dt>Google 연결</dt><dd><?=$status['connected']?'연결됨':'연결 필요'?></dd><dt>자동 저장</dt><dd><?=$status['workerVerifiedAt']?'실제 파일 저장 확인됨':'실제 파일 저장 확인 전'?></dd><dt>저장 위치</dt><dd><?=$e($status['folderName']?:'기존 NOA STUDIO 업로드 임시저장 폴더')?></dd></dl>
<?php if($notice):?><p role="status"><?=$e($notice)?></p><?php endif;?>
<?php if($reason):?><p role="alert"><?=$e(nsd_message($reason))?></p><?php endif;?>
<p>Google 권한 화면에서는 Drive 파일 보기·수정·생성·삭제 권한을 요청합니다. 기존 임시저장 폴더에 접근하기 위한 권한이며, N80 저장기는 지정 폴더와 해당 작업의 생성물만 처리합니다.</p>
<p>이 연결만으로 영상 생성·공개 게시·임시파일 삭제가 시작되지는 않습니다. 게시와 원곡 연결 확인이 끝나기 전까지 생성물을 보존합니다.</p>
<form method="post" action="<?=$e($url)?>"><input type="hidden" name="csrf" value="<?=$e($_SESSION['noa_lab_csrf'])?>"><input type="hidden" name="operation" value="connect"><button class="noa-button primary" type="submit"><?=$status['connected']?'Google Drive 다시 연결':'Google Drive 연결'?></button></form>
<?php if($retry):?><form method="post" action="<?=$e($url)?>"><input type="hidden" name="csrf" value="<?=$e($_SESSION['noa_lab_csrf'])?>"><input type="hidden" name="operation" value="retry"><button class="noa-button" type="submit">승인 결과 다시 확인</button></form><?php endif;?>
<nav><a href="/noa-ai-lab.php?tool=settings">연결 설정</a><a href="/noa-work-status.php">N80 작업 현황</a></nav></main></body></html>
