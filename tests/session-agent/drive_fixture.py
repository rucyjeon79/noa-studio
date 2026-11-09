"""Disposable native OAuth page; dummy credentials only, no Google calls."""
from pathlib import Path
import shutil
import json
import subprocess

REPO = Path(__file__).resolve().parents[2]


def create(root):
    root = Path(root)
    html = root / 'html'
    html.mkdir(parents=True)
    (root / 'noa-ai-lab').mkdir()
    (root / 'sessions').mkdir()
    shutil.copytree(REPO / 'bridge', html / 'noa-bridge')
    (html / 'noa-app/engine').mkdir(parents=True)
    policy = json.loads((REPO / 'config/n80-daily-shorts.json').read_text())
    policy['mediaStorage'].update(provider='google_drive', temporaryParentFolderId='privateFolder111')
    (html / 'noa-app/engine/daily-shorts.json').write_text(json.dumps(policy))
    for file in ['noa-ui.css', 'noa-ui.js', 'noa-ai-lab.css', 'noa-design.json', 'noa-ui-words.json']:
        shutil.copy(REPO / 'deploy' / file, html / file)
    (html / 'common.php').write_text("""<?php
session_save_path(dirname(__DIR__).'/sessions');session_start();define('_GNUBOARD_',true);define('G5_PATH',__DIR__);
if(($_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8079')$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';
$role=$_COOKIE['qa_role']??'guest';$is_member=$role!=='guest';$is_admin=$role==='admin'?'super':'';$member=['mb_id'=>'fixture-owner'];
""")
    subprocess.run(['php', '-r', """define('_GNUBOARD_',true);define('G5_PATH',$argv[1].'/html');
require $argv[1].'/html/noa-bridge/lab-core.php';file_put_contents(lab_root().'/master.key',random_bytes(32));
lab_lock(function(&$s){$s['config']['oauthClientId']='fixture-client';$s['secrets']=lab_seal(['oauthClientSecret'=>'DUMMY_NOT_REAL_SECRET']);});
""", str(root)], check=True)
    return html


if __name__ == '__main__':
    import sys
    create(sys.argv[1])
