"""Verified media permission/hash/range checks and the original transfer loop are preserved."""
import re, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
path='deploy/noa-app/jukebox/stream.php'
old=subprocess.check_output(['git','show','4f83c9370fbf2a18a0953492205b02b61343c2b1:'+path],cwd=root,text=True)
new=(root/path).read_text()
old=old.replace('if(session_status()===PHP_SESSION_ACTIVE)session_write_close();','')
# The approved member/owner ACL replaces only the old public-listener gate.
# Every media identity, verifier, byte range, HEAD header and transfer invariant remains exact.
old_acl="$admin=!empty($is_member)&&($is_admin??'')==='super';if(!noa_sound_visible($doc,$admin))"
new_acl="$access=nam_access((array)($member??[]),(string)($is_admin??''));$admin=$access['admin'];$owner=$access['creator']&&nam_owner($doc,(array)($member??[]));if(($type==='audio'&&!$access['music']&&!$owner)||(!noa_sound_visible($doc,$admin)&&!$owner))"
assert new_acl in new, 'approved VIP/owner authorization changed'
compat=new.replace("require_once dirname(__DIR__,2).'/noa-bridge/member-access.php';\n",'',1).replace(new_acl,old_acl,1)
subprocess.run(['php','tests/member/access_test.php'],cwd=root,check=True)
normalize=lambda s:re.sub(r'\s+','',s)
assert normalize(old.split('fseek($file,$start)')[0])==normalize(compat.split('fseek($file,$start)')[0]),'media identity, permissions, SHA, ranges, HEAD or headers changed'
assert old[old.index('while($left>0'):].rstrip()==new[new.index('while($left>0'):].rstrip(), 'original transfer loop or failure handling changed'
assert new.index('echo $first;')<new.index('nj_track_verified_audio('), 'tracking must follow actual transfer'
assert new.index("==='HEAD'")<new.index('nj_track_verified_audio('), 'HEAD must not credit playback'
assert "X_N80_AVAILABILITY_CHECK" in new, 'N80 availability reads must be excluded'
print('VERIFIED_STREAM_AUTHORIZATION_HASH_RANGE_TRANSFER_PRESERVED')
