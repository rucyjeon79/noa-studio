"""Isolated native HTTP fixture; no operating credentials or data are used."""
import os,shutil
from pathlib import Path
root=Path(os.environ['RUNNER_TEMP'])/'noa-inline-edit-fixture'
root.mkdir(exist_ok=True)
(root/'noa-bridge').mkdir(exist_ok=True)
(root/'noa-app/jukebox').mkdir(parents=True, exist_ok=True)
shutil.copyfile('deploy/noa-app/jukebox/core.php',root/'noa-app/jukebox/core.php')
for p in Path('bridge').glob('*.php'):shutil.copyfile(p,root/'noa-bridge'/p.name)
shutil.copyfile('deploy/noa-ainoa-admin.js',root/'noa-ainoa-admin.js')
shutil.copyfile('deploy/noa-inline-edit.php',root/'noa-inline-edit.php')
(root/'common.php').write_text("<?php define('_GNUBOARD_',true);session_start();if(($_GET['auth']??'')==='admin')$_SESSION['fixture_admin']=true;$is_member=!empty($_SESSION['fixture_admin']);$is_admin=$is_member?'super':'';$member=['mb_id'=>'isolated-admin'];")

(root/'noa-app/engine').mkdir(exist_ok=True)
shutil.copyfile('deploy/noa-app/engine/task-status.php',root/'noa-app/engine/task-status.php')
