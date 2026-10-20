<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
// Additive archival storage. Archived locks/settings never alter active permissions.
function noa_import_source(PDO $db): array {
    $source = require __DIR__.'/source-archive.php';
    if (count($source['files'] ?? []) !== 731) throw new RuntimeException('Unexpected source inventory');
    $exists=$db->query("SHOW TABLES LIKE 'noa_source_files'")->fetchColumn();
    if ($exists) {
        $columns=$db->query('SHOW COLUMNS FROM noa_source_files')->fetchAll(PDO::FETCH_COLUMN);
        if(array_diff(['path_hash','source_path','sha256','source_bytes','imported_at'],$columns))
            throw new RuntimeException('Source archive schema conflict');
    } else {
        $db->exec('CREATE TABLE noa_source_files (
          path_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
          source_path VARCHAR(512) NOT NULL,
          sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          source_bytes MEDIUMBLOB NOT NULL,
          imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }
    $get=$db->prepare('SELECT sha256,source_bytes FROM noa_source_files WHERE path_hash=?');
    $put=$db->prepare('INSERT INTO noa_source_files(path_hash,source_path,sha256,source_bytes) VALUES(?,?,?,?)');
    $created=0;$same=0;$conflicts=[];$verified=0;
    $db->beginTransaction();
    try {
        foreach($source['files'] as $file) {
            $bytes=base64_decode($file['base64'],true);
            if($bytes===false || hash('sha256',$bytes)!==$file['sha256']) throw new RuntimeException('Source integrity failure');
            $key=hash('sha256',$file['path']);$get->execute([$key]);$current=$get->fetch(PDO::FETCH_ASSOC);
            if($current) {
                if($current['sha256']!==$file['sha256'] || hash('sha256',$current['source_bytes'])!==$file['sha256']) {
                    $conflicts[]=$file['path'];continue;
                }
                $same++;
            } else {
                $put->execute([$key,$file['path'],$file['sha256'],$bytes]);$created++;
            }
            $get->execute([$key]);$saved=$get->fetch(PDO::FETCH_ASSOC);
            if(hash('sha256',$saved['source_bytes'])!==$file['sha256']) throw new RuntimeException('Archive verification failed');
            $verified++;
        }
        $db->commit();
    } catch(Throwable $e) {if($db->inTransaction())$db->rollBack();throw $e;}
    return ['source_files'=>731,'added'=>$created,'unchanged'=>$same,'verified'=>$verified,'conflicts'=>$conflicts];
}
