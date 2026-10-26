<?php
declare(strict_types=1);
/** Additive N80 text automation; media publishers and the legacy engine facade are unchanged. */
require_once dirname(__DIR__,2).'/noa-bridge/ainoa-core.php';
require_once dirname(__DIR__,2).'/noa-bridge/ainoa-automation.php';
function n80_ai_snapshot(PDO $db,string $owner):array {
 return ['engine'=>'N80','storage'=>'mysql','scope'=>'text_drafts_and_admin_conversation','generation'=>na_generation_status(),
  'tasks'=>array_map('n80_ai_public',n80_ai_tasks($db,$owner)), 'automaticSongSave'=>false,'mediaPublication'=>false,'chatgptInternalControl'=>false];
}
