<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')&&!defined('NOA_SITEMAP_REGISTRY_ONLY')){http_response_code(403);exit;}
require_once __DIR__.'/noa-app/engine/workspaces.php';
function noa_workspace_groups():array{return n80_workspace_groups('admin');}
function noa_workspace_render():void{n80_workspace_render('admin',['admin'=>true]);}
