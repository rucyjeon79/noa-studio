<?php
declare(strict_types=1);require dirname(__DIR__,2).'/common.php';
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit;}
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JUKEBOX 모바일 폭 검증</title><style>body{background:#111216;color:#efdab1;font-family:system-ui;margin:24px}iframe{display:block;width:390px;height:844px;max-width:100%;border:1px solid #9f844e;border-radius:16px}a{color:#efdab1}</style></head><body><h1>JUKEBOX · 모바일 폭 검증</h1><p>정식 사이트의 390px 화면입니다. 실제 Android 기기의 백그라운드 재생 검증과 구분합니다.</p><a href="/noa-app/jukebox/?qa=1">관리자 검증 카드</a><iframe title="390px JUKEBOX 화면" src="/noa-music.php?qa=1&amp;track=jukebox%3Aqa%3Aupload-pipeline" allow="autoplay"></iframe></body></html>
