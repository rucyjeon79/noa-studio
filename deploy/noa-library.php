<?php
/**
 * NOA STUDIO administrator library page.
 * Production location: /html/noa-library.php
 * Read-only, no legacy GnuBoard table changes.
 */
declare(strict_types=1);
require_once __DIR__ . '/common.php';
if (empty($is_member) || ($is_admin ?? '') !== 'super') {
    http_response_code(403);
    exit('관리자 로그인이 필요합니다.');
}
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
function noa_escape(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
$kind = $_GET['kind'] ?? '';
$after = $_GET['after'] ?? '';
$allowed = ['single','playlist','story','meta','prefs'];
if (!is_string($kind) || ($kind !== '' && !in_array($kind, $allowed, true))
    || !is_string($after) || ($after !== '' && !preg_match('/^[a-z0-9][a-z0-9:_-]{0,190}$/', $after))) {
    http_response_code(400);
    exit('잘못된 조회 조건입니다.');
}
$items = [];
$next = null;
$error = null;
require_once __DIR__ . '/noa-bridge/storage.php';
{
    try {
        $db = noa_bridge_pdo();
        $sql = 'SELECT doc_key,kind,revision,updated_at FROM noa_documents WHERE doc_key > :cursor';
        if ($kind !== '') $sql .= ' AND kind = :kind';
        $sql .= ' ORDER BY doc_key ASC LIMIT 51';
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':cursor', $after, PDO::PARAM_STR);
        if ($kind !== '') $stmt->bindValue(':kind', $kind, PDO::PARAM_STR);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($items) > 50) {
            array_pop($items);
            $next = $items[count($items)-1]['doc_key'];
        }
    } catch (Throwable $e) {
        error_log('[noa-library-page] ' . get_class($e));
        $error = '라이브러리를 읽지 못했습니다. 서버 설정을 확인해 주세요.';
    }
}
?>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NOA STUDIO | 라이브러리</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090a0e;color:#f3eee4;font:15px/1.6 system-ui,"Malgun Gothic",sans-serif}
main{max-width:1100px;margin:auto;padding:32px 20px}a{color:#d7ad62}h1{color:#d7ad62;font-family:Georgia,serif}
nav{display:flex;flex-wrap:wrap;gap:14px;margin:25px 0}nav a{padding:8px 12px;border:1px solid #4c412f;border-radius:8px;text-decoration:none}
table{width:100%;border-collapse:collapse;background:#15161b;border-radius:12px;overflow:hidden}td,th{text-align:left;padding:14px;border-bottom:1px solid #303036}
th{color:#d7ad62}.scroll{overflow-x:auto}.error{padding:16px;border:1px solid #785333;border-radius:8px;color:#efc69c}
p{color:#aaa}.next{display:inline-block;margin-top:22px;padding:10px 20px;border:1px solid #d7ad62;border-radius:8px}
</style><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main>
<a href="/noa2.php">← NOA STUDIO</a><h1>Music Library</h1><p><a href="/noa-catalog-admin.php">음악 SQL 통합 · 충돌 검토</a> · <a href="/noa-catalog.php">통합 라이브러리</a> · <a href="/noa-ai-lab.php">NOA AI LAB · 영상 제작과 YouTube 성장</a></p><a href="/noa-bridge/setup.php">저장소 연결 상태 확인</a><p>관리자 전용 · 변경 이력 및 충돌 방지 저장</p><a href="/noa-editor.php">새 음악 등록</a>
<nav aria-label="콘텐츠 분류">
<?php foreach (array_merge([''=>'전체'], array_combine($allowed, ['EP 싱글','ACT 플레이리스트','사연곡','메타','설정'])) as $value=>$label): ?>
<a href="?<?=noa_escape(http_build_query(['kind'=>$value]))?>"><?=noa_escape($label)?></a>
<?php endforeach; ?></nav>
<?php if ($error !== null): ?><div class="error"><?=noa_escape($error)?></div>
<?php elseif (!$items): ?><p>이 분류에는 등록된 문서가 없습니다.</p>
<?php else: ?><div class="scroll"><table><thead><tr><th>문서 키</th><th>분류</th><th>버전</th><th>수정일</th></tr></thead><tbody>
<?php foreach ($items as $item): ?><tr><td><a href="<?=noa_escape(($item['doc_key']==='ui:policy'?'/noa-theme-admin.php':(in_array($item['kind'],['single','playlist','story'],true)?'/noa-editor.php?key=':'/noa-bridge/index.php?key=').rawurlencode((string)$item['doc_key'])))?>"><?=noa_escape((string)$item['doc_key'])?></a></td><td><?=noa_escape((string)$item['kind'])?></td><td><?=noa_escape((string)$item['revision'])?></td><td><?=noa_escape((string)$item['updated_at'])?></td></tr><?php endforeach; ?>
</tbody></table></div>
<?php if ($next !== null): ?><a class="next" href="?<?=noa_escape(http_build_query(['kind'=>$kind,'after'=>$next]))?>">다음 50개 →</a><?php endif; ?>
<?php endif; ?>
</main></body></html>
