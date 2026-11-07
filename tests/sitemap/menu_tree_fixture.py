"""Render the real sitemap template with actual capabilities, no database or credentials."""
import json, os, shutil, subprocess
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
out = repo / 'menu-tree-proof' / 'fixture'
out.mkdir(parents=True, exist_ok=True)
php = os.environ.get('PHP_BIN', 'php')
subprocess.run([php, str(repo/'tests/sitemap/drawer_access.php'), str(out)], check=True)
root = out/'drawer-root'
for src, dest in {
    'deploy/noa-sitemap.php': 'noa-sitemap.php',
    'deploy/noa-app/engine/workspaces.php': 'noa-app/engine/workspaces.php',
    'deploy/noa-app/engine/ai-lab.php': 'noa-app/engine/ai-lab.php',
    'bridge/member-access.php': 'noa-bridge/member-access.php',
    'bridge/community-navigation.php': 'noa-bridge/community-navigation.php',
}.items():
    target = root/dest
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(repo/src, target)
(root/'common.php').write_text('''<?php
require_once __DIR__.'/noa-bridge/member-access.php';
$role=getenv('NOA_FIXTURE_ROLE');
$level=['guest'=>1,'member'=>3,'seven'=>7,'eight'=>8,'admin'=>10][$role];
$member=$level>1?['mb_id'=>'fixture','mb_level'=>$level]:[];
$is_member=!!$member;$is_admin=$role==='admin'?'super':'';$g5=[];
$GLOBALS['noa_access']=nam_access($member,$is_admin);
''')
for role in ['guest','member','seven','eight','admin']:
    access=json.loads((out/f'drawer-{role}-access.json').read_text())
    html=subprocess.check_output([php,'-r','$_GET["view"]="mine";require $argv[1];',str(root/'noa-sitemap.php')],env={**os.environ,'NOA_FIXTURE_ROLE':role},text=True)
    assert html.startswith('<!doctype html>'), html[:400]
    # Production extensions provide the access context and the shared stylesheet cascade.
    extra='<script type="application/json" id="noa-access">'+json.dumps(access,ensure_ascii=False)+'</script>'
    extra+=''.join(f'<link rel="stylesheet" href="/{file}">' for file in ['noa-starlight.css','noa-member-badges.css','noa-member-surfaces.css','noa-account.css'])
    extra+='<script src="/noa-account.js" defer></script>'
    (out/f'menu-{role}.html').write_text(html.replace('</head>',extra+'</head>'))
print('MENU_TREE_REAL_TEMPLATE_OK five roles, metadata-only rendering')
