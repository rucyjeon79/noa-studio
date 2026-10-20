<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/common.php';
require_once __DIR__ . '/storage.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (empty($is_member) || ($is_admin ?? '') !== 'super') {
    http_response_code(403); exit('최고관리자 로그인이 필요합니다.');
}
$expected = ['noa_documents'=>['doc_key','kind','payload','revision','updated_by','updated_at'],
'noa_document_history'=>['doc_key','revision','payload','changed_by','changed_at'],
'noa_request_log'=>['request_id','doc_key','request_hash','revision','created_at']];
if (empty($_SESSION['noa_setup_token'])) $_SESSION['noa_setup_token'] = bin2hex(random_bytes(32));
$notice = ''; $state = []; $db = null; $sourceReport=null;
$mediaReport=is_file(__DIR__.'/media-status.php')?require __DIR__.'/media-status.php':null;
try {
    $db = noa_bridge_pdo();
    foreach ($expected as $name=>$columns) {
        $query=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');
        $query->execute([$name]);
        $state[$name] = (int)$query->fetchColumn() > 0;
        if ($state[$name]) {
            $actual=$db->query('SHOW COLUMNS FROM `'.$name.'`')->fetchAll(PDO::FETCH_COLUMN);
            if (array_diff($columns,$actual)) throw new RuntimeException('Existing NOA table schema differs');
        }
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        if (!is_string($_POST['token'] ?? null) || !hash_equals($_SESSION['noa_setup_token'],$_POST['token'])
            || ($_SERVER['HTTP_ORIGIN'] ?? '') !== 'https://noastudio.ai.kr') {
            http_response_code(403); exit('요청 검증에 실패했습니다.');
        }
        $schema = <<<'NOA_SCHEMA'
-- Additive schema. Never modifies existing GnuBoard g5_* tables.
CREATE TABLE IF NOT EXISTS noa_documents (
 doc_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 kind VARCHAR(32) NOT NULL,
 payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 updated_by VARCHAR(20) NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT noa_document_json CHECK (JSON_VALID(payload))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS noa_document_history (
 doc_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 changed_by VARCHAR(20) NOT NULL,
 changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(doc_key,revision),
 CONSTRAINT noa_history_json CHECK (JSON_VALID(payload))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS noa_request_log (
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 doc_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
NOA_SCHEMA;
        foreach (explode(';',$schema) as $statement) {
            if (trim($statement) !== '') $db->exec($statement);
        }
        foreach ($expected as $name=>$columns) {
            $db->query('SELECT 1 FROM `'.$name.'` LIMIT 0'); $state[$name]=true;
        }
        $notice='NOA 전용 저장소 연결을 확인했습니다. 기존 그누보드 데이터는 변경하지 않았습니다.';
        if (($_POST['action'] ?? '') === 'archive') {
            require_once __DIR__.'/source-import.php';
            $report=noa_import_source($db);
            $notice='원본 파일 '.$report['verified'].'개 무결성 확인 · '.$report['added'].'개 추가 · 충돌 '.count($report['conflicts']).'개. 기존 음악과 설정을 덮어쓰지 않았습니다.';
        }
        if (($_POST['action'] ?? '') === 'import') {
            $seed = require __DIR__ . '/seed.php';
            if (count($seed['items'] ?? []) !== 653) throw new RuntimeException('Invalid import source');
            $known = array_fill_keys($db->query('SELECT doc_key FROM noa_documents')->fetchAll(PDO::FETCH_COLUMN),true);
            $insert=$db->prepare('INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,?,1,?)');
            $history=$db->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,1,?,?)');
            $created=0; $skipped=0; $db->beginTransaction();
            foreach ($seed['items'] as $item) {
                if (isset($known[$item['key']])) { $skipped++; continue; }
                $json=json_encode($item['payload'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
                $insert->execute([$item['key'],$item['kind'],$json,(string)$member['mb_id']]);
                $history->execute([$item['key'],$json,(string)$member['mb_id']]);
                $known[$item['key']]=true; $created++;
            }
            $db->commit();
            $notice='원본 문서 '.$created.'개 추가 완료 · 기존 키 '.$skipped.'개 보존. 저장소에 있는 원본 스냅샷 기준이며 Grok 실시간 동기화는 아닙니다.';
        }
    }
    if(!in_array(false,$state,true)&&is_file(__DIR__.'/source-import.php')){require_once __DIR__.'/source-import.php';$sourceReport=noa_source_status($db);}
} catch (Throwable $e) {
    if ($db && $db->inTransaction()) $db->rollBack();
    error_log('[noa-setup] '.get_class($e));
    $notice='저장소를 확인하지 못했습니다. 서버 로그 점검이 필요합니다.';
}
function noa_setup_e(string $text): string { return htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOA 저장소 연결</title>
<style>body{background:#090a0e;color:#eee;font:16px/1.7 system-ui;margin:40px auto;max-width:800px;padding:20px}a,h1{color:#d7ad62}button{padding:14px;background:#d7ad62;border:0;border-radius:8px;font:inherit;cursor:pointer}li{margin:12px 0}</style></head><body>
<a href="/noa-library.php">라이브러리로 돌아가기</a><h1>NOA 저장소 연결</h1>
<p>기존 그누보드 DB 설정을 사용합니다. 회원·게시판 테이블은 변경하지 않습니다.</p>
<p><?=noa_setup_e($notice)?></p>
<?php if($sourceReport):?><section aria-label="원본 검증 결과"><h2>GitHub 원본 검증 결과</h2><p>원본 파일 <?=$sourceReport['expected']?>개 · DB 보존 <?=$sourceReport['saved']?>개 · SHA-256 일치 <?=$sourceReport['verified']?>개</p><p>음악 문서 원본 일치 <?=$sourceReport['matching']?>개 · 누락 <?=$sourceReport['missing']?>개 · 변경 차이 <?=$sourceReport['different']?>개</p></section><?php endif;?><?php if($mediaReport): $mediaCounts=array_count_values(array_map(static fn($v)=>$v['status'],$mediaReport['videos']));?><section aria-label="재생 주소 검증 결과"><h2>재생 주소 검증 결과</h2><p>YouTube 공개 확인 <?=$mediaCounts['public']??0?>개 · 비공개·삭제·제한 등 확인 불가 <?=$mediaCounts['not_public_or_unavailable']??0?>개 · 원본 주소 형식 오류 <?=$mediaReport['malformed_source_urls']?>개</p><p>GitHub 원본 음원 파일 <?=$mediaReport['local_audio_files']?>개 · 공개 확인은 실제 음성 재생 성공과 별도로 검증합니다.</p></section><?php endif;?>
<ul><?php foreach($state as $name=>$ready): ?><li><?=noa_setup_e($name)?>: <?=$ready?'연결됨':'전용 테이블 생성 필요'?></li><?php endforeach; ?></ul>
<?php if ($db && count($state)===3 && in_array(false,$state,true)): ?>
<form method="post"><input type="hidden" name="token" value="<?=noa_setup_e($_SESSION['noa_setup_token'])?>"><p>없는 NOA 전용 테이블 3종만 추가합니다. 기존 곡을 자동으로 가져오지는 않습니다.</p><button type="submit">NOA 전용 저장소 연결</button></form>
<?php endif; ?>
<?php if ($db && count($state)===3 && !in_array(false,$state,true) && is_file(__DIR__.'/seed.php')): ?>
<form method="post"><input type="hidden" name="token" value="<?=noa_setup_e($_SESSION['noa_setup_token'])?>"><input type="hidden" name="action" value="import"><p>저장소 원본 JSON 653개를 이관합니다. 같은 키는 건너뛰며 기존 내용을 덮어쓰지 않습니다.</p><button type="submit">기존 음악 문서 이관</button></form>
<?php endif; ?><?php if ($db && is_file(__DIR__.'/source-archive.php')): ?>
<form method="post"><input type="hidden" name="token" value="<?=noa_setup_e($_SESSION['noa_setup_token'])?>"><input type="hidden" name="action" value="archive"><p>음악·설정·원곡 가사·번역 등 원본 731개 파일을 별도 보존합니다. 기존 음악과 활성 설정은 변경하지 않습니다.</p><button type="submit">전체 원본 보존 및 검증</button></form>
<?php endif; ?></body></html>
