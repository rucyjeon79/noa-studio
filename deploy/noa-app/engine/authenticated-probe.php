<?php
declare(strict_types=1);
require_once __DIR__.'/music-adapter.php';
require_once __DIR__.'/bridge.php';
/**
 * N80 authenticated read-only dispatch probe.
 * The caller must be trusted server code which has already authenticated
 * the principal. A client-supplied identity string is NOT authentication.
 * No durable ACK is emitted and no worker is activated.
 */
function n80_music_probe_authorized(PDO $db,array $event,array $serverContext): array {
    if(($serverContext['authenticatedByServer']??false)!==true)
        return ['ok'=>false,'error'=>'unauthenticated'];
    if(($serverContext['principal']??'')!=='jukebox_worker')
        return ['ok'=>false,'error'=>'principal_not_allowed'];
    if(($serverContext['permission']??'')!=='catalog:read')
        return ['ok'=>false,'error'=>'permission_denied'];
    $route=n80_bridge_plan($event);
    if(!$route['ok'])return ['ok'=>false,'error'=>$route['error']];
    if(!in_array('music',array_column($route['links'],'to'),true))
        return ['ok'=>false,'error'=>'not_routed_to_music'];
    return n80_music_catalog_probe($db,$event);
}
