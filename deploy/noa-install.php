<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Cache-Control: private, no-store');
header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>앱 설치 | NOA STUDIO</title><link rel="manifest" href="/noa-manifest.json?v=fullbleed-20261027"><link rel="apple-touch-icon" href="/noa-assets/icon-touch-180.png?v=fullbleed-20261027"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="NOA STUDIO"><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main class="noa-install-page" data-noa-install-page>
<p class="noa-eyebrow">NOA STUDIO · APP</p><h1>노아를 홈 화면에</h1><p class="noa-muted">아이폰, 아이패드, 안드로이드와 PC에서 앱처럼 바로 열어 보세요. 시작 화면은 언제나 홈입니다.</p>
<p class="noa-install-status" data-noa-install-status role="status"></p>
<div class="noa-install-actions"><button class="noa-button primary" type="button" data-noa-install-prompt hidden data-noa-icon="download">앱 설치</button><a class="noa-button" data-noa-icon="home" href="/">홈으로</a></div>
<section class="noa-install-platform" id="apple" data-install-platform="ios"><h2>iPhone · iPad</h2><p>Safari에서 홈을 연 뒤 홈 화면에 추가하세요.</p><ol><li>아래 <strong>홈에서 설치 안내 보기</strong>를 누릅니다.</li><li>Safari의 공유 메뉴에서 <strong>홈 화면에 추가</strong>를 선택합니다.</li><li><strong>웹 앱으로 열기</strong>가 보이면 켜고, <strong>추가</strong>를 누릅니다.</li></ol><a class="noa-button" data-noa-icon="home" href="/?install=ios">홈에서 설치 안내 보기</a><p class="noa-muted">카카오톡 등 앱 안에서 열었다면 메뉴의 ‘Safari에서 열기’를 사용하세요. ‘홈 화면에 추가’가 없으면 공유 메뉴 아래의 ‘동작 편집’에서 추가할 수 있습니다.</p></section>
<section class="noa-install-platform" id="android" data-install-platform="android"><h2>Android</h2><p>Chrome 또는 삼성 인터넷의 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택하세요. 설치 버튼이 나타나면 이 화면에서 바로 진행할 수 있습니다.</p><a class="noa-button" data-noa-icon="home" href="/?install=android">홈에서 설치 안내 보기</a><details><summary>기존 Android APK 다운로드</summary><p class="noa-muted">기존에 APK로 설치한 분을 위한 다운로드입니다. 홈 화면 웹앱 설치와 별도로 제공됩니다.</p><a class="noa-button" data-noa-icon="download" href="/noa-download.php">Android APK 다운로드</a></details></section>
<section class="noa-install-platform" id="mac" data-install-platform="mac"><h2>Mac</h2><p>macOS Sonoma 14 이상에서 Safari로 홈을 열고, <strong>파일 → Dock에 추가</strong>를 선택하세요. 공유 메뉴에서도 추가할 수 있습니다.</p><a class="noa-button" data-noa-icon="home" href="/?install=mac">홈에서 설치 안내 보기</a></section>
<section class="noa-install-platform" id="desktop" data-install-platform="desktop"><h2>Windows · 다른 PC</h2><p>Chrome 또는 Edge로 홈을 열고 주소창의 설치 아이콘이나 브라우저 메뉴의 앱 설치를 선택하세요.</p><a class="noa-button" data-noa-icon="home" href="/?install=desktop">홈에서 설치 안내 보기</a></section>
<p class="noa-muted">설치 후 NOA STUDIO 아이콘을 누르면 홈으로 시작합니다. 음악과 게시판의 이용 권한은 기존 계정과 같습니다.</p>
</main></body></html>
