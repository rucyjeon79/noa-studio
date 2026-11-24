"""Read-only technical inventory of live Busan Gnuboard; NEVER print member data or credentials."""
from __future__ import annotations
import hmac
import json
import os
from pathlib import Path
import re
import socket
import stat
import paramiko
from busan_readonly_check import ROOT, PORT, configuration, fingerprint

SOURCES = [
    "bbs/good.php", "bbs/write_comment_update.php","bbs/write_update.php",
    "bbs/register_form.php","bbs/register_form_update.php",
    "bbs/profile.php","bbs/member_confirm.php","bbs/board.php",
    "bbs/download.php","bbs/member_leave.php",
    "lib/common.lib.php","common.php","config.php",
    "adm/board_form_update.php","adm/config_form_update.php",
]
PATTERN = re.compile(r"run_(?:event|replace)\s*\(|insert_point\s*\(|delete_point\s*\(|"
                     r"get_member\s*\(|mb_recommend|mb_ref|bo_use_good|good|member_profile|profile|"
                     r"register_form|comment|reply|refer|invite|point|"
                     r"include_once\s*\(",re.I)
def allowed_dir(f):
    try:
        entries=f.listdir_attr(ROOT+'/extend')
        return sorted([e.filename for e in entries if stat.S_ISREG(e.st_mode) and
                       re.fullmatch(r'[A-Za-z0-9_.-]{1,90}\.php',e.filename)])[:130]
    except (FileNotFoundError,PermissionError):
        return []
def read(s,path,size=350000):
    full=ROOT+'/'+path
    try:
        attrs=s.lstat(full)
        if s.normalize(full)!=full or not stat.S_ISREG(attrs.st_mode) or attrs.st_size>size:
            return None
        with s.open(full,'rb') as f:return f.read(size+1).decode('utf-8','replace')
    except (FileNotFoundError,PermissionError):
        return None
def inventory(s):
    result={"site":"busan","read_only":True,"files":[],"extend_names":allowed_dir(s)}
    for p in SOURCES:
        txt=read(s,p)
        if txt is None:
            result["files"].append({"path":p,"status":"absent"});continue
        lines=txt.splitlines()
        out=[]
        for i,ln in enumerate(lines):
            # Do not output source lines themselves. Only hook names + called functions.
            if re.search(r"\brun_(?:event|replace)\s*\(",ln):
                names=re.findall(r"run_(?:event|replace)\s*\(\s*['\"]([^'\"]+)",ln)
                out.append({"line":i+1,"hook":names[0][:96] if names else "dynamic"})
            elif re.search(r"\binsert_point\s*\(",ln):
                out.append({"line":i+1,"call":"insert_point"})
            elif re.search(r"\bdelete_point\s*\(",ln):
                out.append({"line":i+1,"call":"delete_point"})
        result["files"].append({"path":p,"status":"present","bytes":len(txt.encode()),"events":out[:100]})
    return result
def main():
    try:
        host,user,password,pin=configuration(os.environ)
    except Exception as exc:
        if str(exc)=='busan_target_mismatch':
            print('BUSAN_POINTS_HOST_MAPPING',json.dumps({
                'hostname_matches_known':os.environ.get('BUSAN_SSH_HOST')=='112.175.184.79',
                'account_matches_known':os.environ.get('BUSAN_SSH_USER')=='rucyjeon79',
                'password_present':bool(os.environ.get('BUSAN_SSH_PASSWORD')),
                'pin_present':bool(os.environ.get('BUSAN_SSH_HOST_FINGERPRINT'))}))
        raise
    with socket.create_connection((host,PORT),timeout=15) as sock:
        with paramiko.Transport(sock) as t:
            t.banner_timeout=15;t.auth_timeout=15;t.get_security_options().key_types=('ssh-ed25519',)
            t.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin):
                raise RuntimeError('host_key_mismatch')
            t.auth_password(user,password,fallback=False)
            with paramiko.SFTPClient.from_transport(t) as s:
                s.get_channel().settimeout(25)
                print('BUSAN_POINTS_SITE_INVENTORY',json.dumps(inventory(s),ensure_ascii=False))
if __name__=='__main__':main()
