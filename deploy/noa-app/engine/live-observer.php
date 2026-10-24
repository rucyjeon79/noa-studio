<?php
declare(strict_types=1);
require_once __DIR__.'/readonly-pipeline.php';
require_once __DIR__.'/receipt-contract.php';
require_once __DIR__.'/guardian.php';
/** Bounded SELECT-only live observation; never claim jobs or issue business ACKs. */
function n80_live_observe(PDO $db,string $root,int $limit): array {
    if($limit<1||$limit>25)throw new InvalidArgumentException('invalid_limit');
    $jobs=$db->query("SELECT j.id FROM noa_jukebox_audio_jobs j
        JOIN noa_jukebox_uploads u ON u.id=j.upload_id
        WHERE j.status='ready' AND u.status='ready'
        AND u.song_key NOT LIKE 'jukebox:qa:%'
        AND j.id=(SELECT MAX(j2.id) FROM noa_jukebox_audio_jobs j2
          JOIN noa_jukebox_uploads u2 ON u2.id=j2.upload_id WHERE u2.song_key=u.song_key)
        ORDER BY j.id DESC LIMIT ".$limit)->fetchAll(PDO::FETCH_COLUMN);
    $receipts=[];$rejected=[];
    foreach($jobs as $id){
        $ready=n80_ready_event_from_job($db,(int)$id);
        if(!$ready['ok']){$rejected[]=['jobId'=>(int)$id,'error'=>$ready['error']];continue;}
        $observation=n80_music_catalog_probe($db,$ready['event']);
        $receipt=n80_receipt_validate($ready['event'],$observation);
        if(!$receipt['ok']){$rejected[]=['jobId'=>(int)$id,'error'=>$observation['status']??$receipt['error']];continue;}
        $receipts[]=$receipt+['jobId'=>(int)$id,'ackEligible'=>false];
    }
    $guardian=n80_guardian_audit($root);
    return ['engine'=>'N80 ENGINE','runtime'=>'live_observer','principal'=>'n80_observer',
        'checkedAt'=>gmdate('c'),'sampleLimit'=>$limit,'sampledJobs'=>count($jobs),
        'observed'=>count($receipts),'rejected'=>$rejected,'receipts'=>$receipts,
        'guardian'=>$guardian,'automaticDispatch'=>false,'businessAck'=>false,
        'queueMutation'=>false,'productionWrites'=>0,'hostTemporaryFiles'=>0];
}
