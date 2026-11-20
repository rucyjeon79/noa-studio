"""Read-only 부산지부 알림 UI/API inventory. No member content or credentials."""
import base64,hashlib,hmac,json,os,re,socket,stat
import paramiko
from busan_readonly_check import ROOT,PORT,configuration,fingerprint

PRIVATE='/hosting/rucyjeon79/busan-assistant-private'
BASE=ROOT+'/busan-assistant'
SAFE_NAMES=[
    BASE+'/notification-api.php',
    BASE+'/notification-lib.php',
    BASE+'/notification-client.js',
    BASE+'/notification.js',
    BASE+'/notifications.js',
    BASE+'/push.js',
    BASE+'/widget.js',
    BASE+'/busan-on.js',
    ROOT+'/extend/busan-on.extend.php',
    ROOT+'/extend/busan-push.extend.php',
    ROOT+'/extend/busan-notification.extend.php',
    ROOT+'/sw.js',
    ROOT+'/busan-sw.js'
]
IMPORTANT=re.compile(r'notification|알림|push|vapid|subscribe|serviceworker|requestpermission|mb_|member|csrf|token|login|session|CREATE.TABLE|SELECT|UPDATE|INSERT|enabled',re.I)
SECRET=re.compile(r'password|private.key|secret|access_token|refresh_token|Authorization|dbconfig|bearer|base64.decode',re.I)
def safe_regular(s,p):
    try:
        v=s.lstat(p)
        if not stat.S_ISREG(v.st_mode) or v.st_size>300000: return None
        with s.open(p,'rb') as fh:
            return fh.read(300001)
    except (FileNotFoundError,PermissionError):
        return None

def main():
    host,user,password,pin=configuration(os.environ)
    report={'scope':'read_only','created':0,'db_queries':0,'member_rows_read':0,'paths':{},'directories':{}}
    with socket.create_connection((host,PORT),timeout=15) as sock:
        with paramiko.Transport(sock) as tr:
            tr.get_security_options().key_types=('ssh-ed25519',)
            tr.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(tr.get_remote_server_key()),pin): raise RuntimeError('host_key_mismatch')
            tr.auth_password(user,password,fallback=False)
            with paramiko.SFTPClient.from_transport(tr) as s:
                s.get_channel().settimeout(25)
                if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
                for directory in (BASE,ROOT+'/extend',ROOT+'/js',ROOT+'/bbs',PRIVATE):
                    try:
                        rows=s.listdir_attr(directory)
                    except (FileNotFoundError,PermissionError):
                        report['directories'][directory]='unavailable'
                        continue
                    report['directories'][directory]=[
                        row.filename for row in rows
                        if re.search('notif|push|sw[.]js|on[.]extend|member|user|account|service|subscribe',row.filename,re.I)
                    ][:70]
                for p in SAFE_NAMES:
                    content=safe_regular(s,p)
                    if content is None:continue
                    lines=content.decode('utf-8','replace').splitlines()
                    fragments=[]
                    for number,line in enumerate(lines,1):
                        if not IMPORTANT.search(line) or SECRET.search(line):continue
                        line=line.strip()
                        if len(line)>300:line=line[:300]+'…'
                        fragments.append({'line':number,'code':line})
                    report['paths'][p]={'sha256':hashlib.sha256(content).hexdigest(),
                                         'bytes':len(content),'lines':len(lines),
                                         'excerpt':fragments[:100]}
    print('BUSAN_NOTIFICATION_SOURCE_INVENTORY',json.dumps(report,ensure_ascii=False))
if __name__=='__main__':
    main()
