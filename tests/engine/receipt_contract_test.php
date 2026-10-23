<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/receipt-contract.php';
$e=['id'=>'evt1','type'=>'audio.ready','source'=>'jukebox','correlationId'=>'corr1'];
$o=['ok'=>true,'consumer'=>'music','status'=>'catalog_present','mutation'=>false,'correlationId'=>'corr1'];
$a=n80_receipt_validate($e,$o);
if(!$a['ok']||$a['effect']!=='catalog_observation_only')exit(1);
$o['correlationId']='other';
if(n80_receipt_validate($e,$o)['ok'])exit(2);
$o['correlationId']='corr1';$o['mutation']=true;
if(n80_receipt_validate($e,$o)['ok'])exit(3);
echo "N80_RECEIPT_CONTRACT_OK\n";
