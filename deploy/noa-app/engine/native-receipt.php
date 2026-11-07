<?php
declare(strict_types=1);
function n80_native_receipt_valid(string $consumer,array $receipt):bool {
 $effects=['playlist'=>['playlist_read_model_verified','referencesVerified'],'world'=>['world_read_model_verified','officialPlaylistVerified'],'admin'=>['admin_integrity_audit_verified','integrityVerified']];
 if(!isset($effects[$consumer]))return false;[$effect,$gate]=$effects[$consumer];$proof=$receipt['proof']??[];
 return ($receipt['consumer']??'')===$consumer&&($receipt['effect']??'')===$effect&&($proof['effect']??'')===$effect&&($proof[$gate]??null)===true&&($proof['mutation']??null)===false&&is_string($proof['projectionSha256']??null)&&preg_match('/^[a-f0-9]{64}$/D',$proof['projectionSha256'])===1;
}
