<?php
declare(strict_types=1);
/** Compatibility names delegate to the Media owner; Hub retains retry storage custody. */
require_once __DIR__.'/media-covers.php';
function n80_hub_cover_identity(array $row):string{return n80_media_cover_identity($row);}
function n80_hub_cover_retry(array &$state,array $row,int $now):void{n80_media_cover_retry($state,$row,$now);}
function n80_hub_cover_inventory(PDO $db):array{return n80_media_cover_inventory($db);}
function n80_hub_cover_apply(PDO $db,array $row,array $prepared):array{return n80_media_cover_apply($db,$row,$prepared);}
function n80_hub_covers(PDO $db,string $root,?callable $prepare=null):array{return n80_media_covers($db,$root,$prepare);}
