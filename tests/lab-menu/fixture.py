"""Render production hub and navigation components using real role capabilities."""
from pathlib import Path
import json
import subprocess

root=Path(__file__).resolve().parents[2]
out=root/'lab-menu-proof/fixture'
out.mkdir(parents=True,exist_ok=True)
for role in ['admin','eight','member']:
    caps=json.loads((root/f'menu-tree-proof/fixture/drawer-{role}-access.json').read_text())
    extra='<script id="noa-access" type="application/json">'+json.dumps(caps,ensure_ascii=False)+'</script><link rel="stylesheet" href="/noa-starlight.css">'
    for mode in ['hub','chat','listen','create','batch']:
        code='define("_GNUBOARD_",true);$access=json_decode($argv[1],true);'
        if mode=='hub':
            code+='require "deploy/noa-app/engine/lab-home.php";'
        else:
            code+='require "deploy/noa-app/engine/ai-lab.php";n80_lab_nav($access,$argv[2]);'
        html=subprocess.check_output(['php','-r',code,json.dumps(caps),mode],cwd=root,text=True)
        if mode!='hub':
            html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main><h1>AI LAB</h1>'+html+'</main></body></html>'
        (out/f'{role}-{mode}.html').write_text(html.replace('</head>',extra+'</head>'))
    (out/f'{role}.json').write_text(json.dumps(caps))
print('AI_LAB_REAL_HUB_AND_NAV_RENDERED')
