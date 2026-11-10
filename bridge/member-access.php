<?php
declare(strict_types=1);
if(is_file(__DIR__.'/music-proof-auth.php'))require_once __DIR__.'/music-proof-auth.php';
$n80=dirname(__DIR__).'/noa-app/engine/sign.php';
require_once is_file($n80)?$n80:dirname(__DIR__).'/deploy/noa-app/engine/sign.php';
unset($n80);
function nam_access(array $member=[],string $admin=''):array{return n80_sign_access($member,$admin);}
function nam_owner(array $document,array $member):bool{return n80_sign_owner($document,$member);}
function nam_requirement(string $path,string $method='GET',array $query=[]):?string{return n80_sign_requirement($path,$method,$query);}
function nam_allowed(array $access,?string $need):bool{return n80_sign_allowed($access,$need);}
