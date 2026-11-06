"""Exercise AI LAB page routing with synthetic roles, without creating jobs."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as temp:
    site = Path(temp)
    shutil.copytree(root / 'deploy', site, dirs_exist_ok=True)
    shutil.copytree(root / 'bridge', site / 'noa-bridge')
    (site / 'common.php').write_text("""<?php
define('_GNUBOARD_',true);
$role=getenv('ROLE');
$is_member=$role!=='guest';
$member=$is_member?['mb_id'=>'qa','mb_level'=>$role==='creator'?8:4]:[];
$is_admin=$role==='admin'?'super':'';
$_GET=['tool'=>getenv('TOOL')];
""")
    for role, tool, expected, excluded in [
        ('guest', '', '로그인이 필요', 'lab-config-form'),
        ('member', '', 'lab-chat-open', 'lab-config-form'),
        ('creator', '', 'ncai-form', 'lab-config-form'),
        ('creator', 'song', '관리자 전용', 'lab-record'),
        ('member', 'channel', '관리자 전용', 'ncai-form'),
        ('member', 'listen', 'data-noa-listening', 'lab-config-form'),
        ('admin', '', 'lab-config-form', 'id="batch-run"'),
        ('admin', 'song', 'lab-record', 'lab-config-form'),
        ('admin', 'batch', '<option value="ai">', '<option value="audio">'),
    ]:
        result = subprocess.run(['php', str(site / 'noa-ai-lab.php')], cwd=site,
                                env={'ROLE': role, 'TOOL': tool}, capture_output=True, text=True, check=True)
        assert expected in result.stdout and excluded not in result.stdout, (role, tool, result.stderr)
    print('AI LAB role and tool routes passed')
