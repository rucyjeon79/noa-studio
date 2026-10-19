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
$notice = ''; $state = []; $db = null;
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
    }
} catch (Throwable $e) {
    error_log('[noa-setup] '.get_class($e));
    $notice='저장소를 확인하지 못했습니다. 서버 로그 점검이 필요합니다.';
}
function noa_setup_e(string $text): string { return htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOA 저장소 연결</title>
<style>body{background:#090a0e;color:#eee;font:16px/1.7 system-ui;margin:40px auto;max-width:800px;padding:20px}a,h1{color:#d7ad62}button{padding:14px;background:#d7ad62;border:0;border-radius:8px;font:inherit;cursor:pointer}li{margin:12px 0}</style></head><body>
<a href="/noa-library.php">라이브러리로 돌아가기</a><h1>NOA 저장소 연결</h1>
<p>기존 그누보드 DB 설정을 사용합니다. 회원·게시판 테이블은 변경하지 않습니다.</p>
<p><?=noa_setup_e($notice)?></p><ul><?php foreach($state as $name=>$ready): ?><li><?=noa_setup_e($name)?>: <?=$ready?'연결됨':'전용 테이블 생성 필요'?></li><?php endforeach; ?></ul>
<?php if ($db && count($state)===3 && in_array(false,$state,true)): ?>
<form method="post"><input type="hidden" name="token" value="<?=noa_setup_e($_SESSION['noa_setup_token'])?>"><p>없는 NOA 전용 테이블 3종만 추가합니다. 기존 곡을 자동으로 가져오지는 않습니다.</p><button type="submit">NOA 전용 저장소 연결</button></form>
<?php endif; ?></body></html>
