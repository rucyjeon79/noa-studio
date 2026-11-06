<?php
declare(strict_types=1);
define('_GNUBOARD_', true);
require_once __DIR__.'/../../bridge/storage.php';
require_once __DIR__.'/../../bridge/creator-core.php';
$db = noa_bridge_pdo();
if ($db->query('SELECT DATABASE()')->fetchColumn() !== 'noa_test') {
    throw new RuntimeException('isolated browser fixture required');
}
$owner = 'qa_owner_a';
$genre = 'groovy-airy-pop';
for ($act=1; $act<=2; $act++) {
    $members = [];
    for ($ep=($act-1)*10+1; $ep<=$act*10; $ep++) {
        $key = 'single:batch-ui:'.$ep;
        $title = $ep < 3 ? '같은 멜로디' : '테스트 노래 '.$ep;
        $body = $ep <= 3 ? ['youtubeTitle'=>'사용자가 저장한 제목 '.$ep] : [];
        nc_store($db,$key,'single',['ownerId'=>$owner,'genreId'=>$genre,'title'=>$title,
            'ep'=>$ep,'visibility'=>'private','body'=>$body],0,$owner);
        $members[] = ['key'=>$key,'ep'=>$ep];
    }
    nc_store($db,'playlist:batch-ui:'.$act,'playlist',['ownerId'=>$owner,'genreId'=>$genre,
        'title'=>'묶음 검증 ACT '.$act,'act'=>$act,'body'=>['members'=>$members]],0,$owner);
}
$schema = require __DIR__.'/../../bridge/taxonomy-schema.php';
$db->exec('CREATE TABLE IF NOT EXISTS noa_production_rules '.$schema['noa_production_rules']);
$body='{"language":"ko"}';
$db->prepare("INSERT IGNORE INTO noa_production_rules
    (rule_id,scope,format,body,sha256,source_path,source_sha256,updated_by)
    VALUES('batch-ui:common','common','json',?,?,'fixture',?,'fixture')")
    ->execute([$body,hash('sha256',$body),hash('sha256',$body)]);
echo "BATCH_BROWSER_FIXTURE_OK\n";
