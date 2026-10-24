"""Verified media permission/hash/range checks and the original transfer loop are preserved."""
import re, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
path='deploy/noa-app/jukebox/stream.php'
old=subprocess.check_output(['git','show','4f83c9370fbf2a18a0953492205b02b61343c2b1:'+path],cwd=root,text=True)
new=(root/path).read_text()
old=old.replace('if(session_status()===PHP_SESSION_ACTIVE)session_write_close();','')
normalize=lambda s:re.sub(r'\s+','',s)
assert normalize(old.split('fseek($file,$start)')[0])==normalize(new.split('fseek($file,$start)')[0]),'media identity, permissions, SHA, ranges, HEAD or headers changed'
assert old[old.index('while($left>0'):]==new[new.index('while($left>0'):], 'original transfer loop or failure handling changed'
assert new.index('echo $first;')<new.index('nj_track_verified_audio('), 'tracking must follow actual transfer'
assert new.index("==='HEAD'")<new.index('nj_track_verified_audio('), 'HEAD must not credit playback'
assert "X_N80_AVAILABILITY_CHECK" in new, 'N80 availability reads must be excluded'
print('VERIFIED_STREAM_AUTHORIZATION_HASH_RANGE_TRANSFER_PRESERVED')
