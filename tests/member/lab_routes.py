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
        ('admin', 'removed_tool', '찾을 수 없는', 'lab-config-form'),
        ('member', 'muvy', '권한이 없습니다', 'mu-key'),
        ('member', 'batch', '권한이 없습니다', 'batch-fields'),
        ('creator', 'listen', 'data-noa-lab-listening', '?tool=batch'),
        ('guest', '', '로그인이 필요', 'lab-config-form'),
        ('member', '', 'lab-chat-open', 'lab-config-form'),
        ('creator', '', 'ncai-form', 'lab-config-form'),
        ('creator', 'song', '권한이 없습니다', 'lab-record'),
        ('member', 'channel', '권한이 없습니다', 'ncai-form'),
        ('member', 'listen', 'data-noa-listening', 'lab-config-form'),
        ('admin', '', 'lab-config-form', 'id="batch-run"'),
        ('admin', 'song', 'lab-record', 'lab-config-form'),
        ('admin', 'batch', '<option value="ai">', '<option value="audio">'),
    ]:
        result = subprocess.run(['php', str(site / 'noa-ai-lab.php')], cwd=site,
                                env={'ROLE': role, 'TOOL': tool}, capture_output=True, text=True, check=True)
        assert expected in result.stdout and excluded not in result.stdout, (role, tool, result.stderr)
    check = '''
    require 'noa-app/engine/health.php';
    require 'noa-bridge/member-access.php';
    $modules=noa_engine_modules();
    foreach(n80_lab_tools() as $id=>$tool){
        if(nam_requirement('/noa-ai-lab.php','GET',['tool'=>$id])!==$tool['access'])exit(1);
        if(!in_array($id,$modules['ai_lab']['tools'],true))exit(2);
        if(isset($tool['page'])&&!is_file($tool['page']))exit(3);
    }
    $health=array_column(noa_engine_health_snapshot(getcwd())['modules'],null,'id');
    if($health['ai_lab']['sourcePresence']!=='present')exit(4);
    '''
    subprocess.run(['php','-r',check],cwd=site,check=True)
    print('AI LAB registry, role and tool routes passed')
