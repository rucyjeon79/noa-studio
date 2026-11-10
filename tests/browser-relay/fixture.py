"""Isolated administrator browser UI. Dummy inputs; no Google or production writes."""
from pathlib import Path
import shutil
import subprocess
ROOT = Path(__file__).resolve().parents[2]
def create(folder):
    folder = Path(folder); html = folder/'html'
    html.mkdir(parents=True); (folder/'noa-ai-lab').mkdir(); (folder/'sessions').mkdir()
    shutil.copytree(ROOT/'bridge', html/'noa-bridge')
    shutil.copytree(ROOT/'deploy/noa-app/engine', html/'noa-app/engine')
    for file in (ROOT/'deploy').glob('noa-*'):
        if file.suffix in ('.css','.js','.json') or file.name=='noa-browser-connect.php':
            shutil.copy(file,html/file.name)
    (html/'extend').mkdir()
    shutil.copy(ROOT/'deploy/noa-design.extend.php',html/'extend/noa-design.extend.php')
    (html/'noa-assets').mkdir()
    for name in ['papa-logo.png','favicon.png','icon-touch-180.png']:
        shutil.copy(ROOT/'public'/name,html/'noa-assets'/name)
    shutil.copy(ROOT/'public/ainoa/ainoa-symbol.png',html/'noa-assets/ainoa-symbol.png')
    shutil.copytree(ROOT/'public/noa-theme-scenes',html/'noa-theme-scenes')
    (html/'noa-app/engine/worker-wake.php').write_text('<?php function n80_ai_wake(){file_put_contents(dirname(G5_PATH)."/wake-count", "wake\\n", FILE_APPEND);return ["fixture"=>true];}')
    (html/'common.php').write_text('''<?php
session_save_path(dirname(__DIR__).'/sessions');session_start();define('_GNUBOARD_',true);define('G5_PATH',__DIR__);
$role=$_COOKIE['qa_role']??'guest';$is_member=$role!=='guest';$is_admin=$role==='admin'?'super':'';$member=['mb_id'=>'fixture-owner'];
// Exercise the operating style pipeline and the membership header asset order.
ob_start(static fn($html)=>str_contains($html,'</head>')?str_replace('</head>','<link rel="stylesheet" href="/noa-account.css"><script src="/noa-account.js" defer></script></head>',$html):$html);
require __DIR__.'/extend/noa-design.extend.php';noa_design_assets();
''')
    subprocess.run(['php','-r',"define('_GNUBOARD_',true);define('G5_PATH',$argv[1].'/html');require $argv[1].'/html/noa-bridge/lab-core.php';file_put_contents(lab_root().'/master.key',random_bytes(32));lab_lock(fn(&$s)=>null);",str(folder)],check=True)
    return html
if __name__ == '__main__':
    import sys
    create(sys.argv[1])
