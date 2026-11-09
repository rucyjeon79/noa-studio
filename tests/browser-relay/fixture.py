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
    for name in ['noa-browser-connect.php','noa-browser-connect.js','noa-ui.css','noa-ai-lab.css']:
        shutil.copy(ROOT/'deploy'/name, html/name)
    (html/'noa-app/engine/worker-wake.php').write_text('<?php function n80_ai_wake(){return ["fixture"=>true];}')
    (html/'common.php').write_text('''<?php
session_save_path(dirname(__DIR__).'/sessions');session_start();define('_GNUBOARD_',true);define('G5_PATH',__DIR__);
$role=$_COOKIE['qa_role']??'guest';$is_member=$role!=='guest';$is_admin=$role==='admin'?'super':'';$member=['mb_id'=>'fixture-owner'];
''')
    subprocess.run(['php','-r',"define('_GNUBOARD_',true);define('G5_PATH',$argv[1].'/html');require $argv[1].'/html/noa-bridge/lab-core.php';file_put_contents(lab_root().'/master.key',random_bytes(32));lab_lock(fn(&$s)=>null);",str(folder)],check=True)
    return html
if __name__ == '__main__':
    import sys
    create(sys.argv[1])
