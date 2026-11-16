#!/usr/bin/env python3
"""N80 read-only current-host UI geometry inventory.
No production writes, no downloads of credentials, database, media, member files.
Writes a bounded, sanitized geometry report only to the GitHub runner.
"""
import base64, hashlib, json, os, re, stat
from pathlib import Path
import paramiko

ROOT='/hosting/noastudio/html'
PIN='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
OUT=Path('n80-live-ui-inventory')
CSS_CANDIDATES=[
 'noa-ui.css','noa-account.css','noa-starlight.css','noa-ainoa.css',
 'noa-my.css','noa-creative.css','noa-music.css','noa-listening.css',
 'noa-gnuboard.css','noa-music-vinyl.css','noa-ecosystem.css',
 'noa-ai-lab.css','noa-support.css','noa-pay.css','noa-checkout.css',
 'noa-channel-view.css','noa-record-form.css','noa-app/jukebox/upload.css',
 'noa-creator.css','noa-settings.css','noa-taxonomy-browse.css','noa-app/engine/system.css',
 'noa-member-surfaces.css','noa-member-badges.css','noa-notebooklm.css',
 'noa-membership-wallet.css','noa-creator-apply.css'
]
PHP_CANDIDATES=[
 'noa-my.php','noa-support.php','noa-settings.php','noa-ai-lab.php',
 'noa-creator.php','noa-music.php','noa-hub.php','noa-work-status.php',
 'noa-channel-explorer.php','noa-payment-settings.php','noa-kcp-test.php',
 'noa-creator-lab.php','noa-notebooklm.php','noa-lab-song.php','noa-library.php'
]
JS_CANDIDATES=[
 'noa-ui.js','noa-account.js','noa-my.js','noa-kcp-test.js',
 'noa-ai-lab.js','noa-creator.js','noa-lab-chat.js','noa-browse-edit.js','noa-notebooklm.js',
 'noa-channel-batch.js','noa-channel-explorer.js','noa-member-surfaces.js',
 'noa-creator-apply.js','noa-membership.js'
]
NAME_PATTERN=re.compile(r'(noa|studio|pay|kcp|toss|music|my|lab|settle|creator|batch|channel|setting|account|hub|css)',re.I)
SEL_PATTERN=re.compile(r'(noa|np-|nl-|creator|payment|checkout|kcp|toss|pay-|settings|batch|bulk|tree|my-|channel|action|button|field|account|float)',re.I)
PROP_PATTERN=re.compile(r'^\s*(display|position|inset|left|right|top|bottom|z-index|(?:min-|max-)?(?:inline-|block-)?(?:width|height|size)|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|gap|row-gap|column-gap|grid-template-(?:columns|rows)|grid-auto-flow|flex(?:-[a-z]+)?|align-items|justify-content|align-self|white-space|word-break|overflow(?:-[xy])?|overflow-wrap|text-overflow|font-size|line-height|box-sizing|border-radius|transform|translate|scroll-padding(?:-[a-z]+)?|scroll-margin(?:-[a-z]+)?|visibility)\s*:',re.I)
HINTS=('토스페이먼츠','결제','KCP','Google Play','일괄 처리','YouTube 채널','NOA STUDIO Assistant','NotebookLM','ChatGPT에서','구독','플레이리스트','MY MEMBERSHIP','OpenAI','작업','카테고리','설정')

def sanitized_css_rules(css,limit=350):
    # This extracts geometry/property names and excludes color, URLs, content, and JS.
    css=re.sub(r'/\*.*?\*/',' ',css,flags=re.S)
    found=[]
    for raw_sel,raw_body in re.findall(r'([^{}]{1,420})\{([^{}]{0,2500})\}',css,re.S):
        sel=raw_sel.strip()
        if not SEL_PATTERN.search(sel):continue
        props=[]
        for chunk in raw_body.split(';'):
            if PROP_PATTERN.match(chunk):
                chunk=chunk.strip()
                chunk=re.sub(r'url\([^)]*\)','[URL]',chunk,flags=re.I)
                if len(chunk)<=260: props.append(chunk)
        if props:
            found.append({'selector':sel[-250:].replace('\n',' '),'geometry':props[:18]})
        if len(found)>=limit:break
    return found

def select_tags(text,limit=95):
    out=[]
    for i,line in enumerate(text.splitlines(),1):
        if not any(k in line for k in HINTS):continue
        line=re.sub(r'<\?[\s\S]*?\?>','[PHP]',line)
        tags=[]
        for m in re.finditer(r'<(a|button|label|input|select|div|section|form|p|span|h[1-4])\b[^>]{0,480}>',line,re.I):
            tag=m.group()
            klass=re.search(r'\bclass=["\']([^"\']{1,140})',tag,re.I)
            idmatch=re.search(r'\bid=["\']([^"\']{1,80})',tag,re.I)
            role=re.search(r'\brole=["\']([^"\']{1,40})',tag,re.I)
            if klass or idmatch:
                tags.append({'tag':m.group(1),'class':klass.group(1) if klass else None,
                             'id':idmatch.group(1) if idmatch else None,
                             'role':role.group(1) if role else None})
        if tags:out.append({'line':i,'tags':tags[:12]})
        if len(out)>=limit:break
    return out

def markup_layout_risks(text,limit=90):
    """Expose only parent tag/class + nested action tag/class, never raw content."""
    from html.parser import HTMLParser
    scrubbed=re.sub(r'<\?(?:php|=)?[\s\S]*?\?>','',text,flags=re.I)
    class Reader(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.stack=[];self.risks=[]
        def handle_starttag(self,tag,attrs):
            attrs=dict(attrs)
            label=(attrs.get('class') or '')[:110]
            ident=(attrs.get('id') or '')[:80]
            if tag in ('a','button','input','select'):
                parents=self.stack[-5:]
                for p in parents:
                    if p['tag'] in ('p','label','h1','h2','h3','h4') and tag in ('a','button'):
                        self.risks.append({
                            'pattern':'action_inside_prose',
                            'parentTag':p['tag'],'parentClass':p['class'],
                            'actionTag':tag,'actionClass':label,'actionId':ident
                        })
                        break
            if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):
                self.stack.append({'tag':tag,'class':label,'id':ident})
        def handle_endtag(self,tag):
            for i in range(len(self.stack)-1,-1,-1):
                if self.stack[i]['tag']==tag:
                    self.stack=self.stack[:i]
                    break
    p=Reader()
    try:p.feed(scrubbed)
    except Exception:return []
    uniq={}
    for row in p.risks:
        key=(row['pattern'],row['parentTag'],row['parentClass'],row['actionTag'],row['actionClass'],row['actionId'])
        uniq[key]=row
        if len(uniq)>=limit:break
    return list(uniq.values())

def select_js_classes(text,limit=130):
    matches=[]
    for i,line in enumerate(text.splitlines(),1):
        names=[]
        for pat in (r'\bclassName\s*=\s*[\'"]([^\'"]{1,100})',
                    r'classList\.(?:add|toggle)\(\s*[\'"]([^\'"]{1,100})',
                    r'\b(?:getElementById|querySelector)\(\s*[\'"]([^\'"]{1,100})'):
            names.extend(re.findall(pat,line))
        names=[name[:100] for name in names if SEL_PATTERN.search(name)]
        if names:matches.append({'line':i,'selectors':names[:9]})
        if len(matches)>=limit:break
    return matches

def main():
    host=os.environ['NOA_SSH_HOST'];user=os.environ['NOA_SSH_USER'];password=os.environ['NOA_SSH_PASSWORD']
    transport=paramiko.Transport((host,2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',)
        transport.start_client(timeout=20)
        server_key=transport.get_remote_server_key()
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(server_key.asbytes()).digest()).decode().rstrip('=')
        if fingerprint!=PIN:raise RuntimeError('NOA SSH host identity mismatch; authentication refused')
        transport.auth_password(user,password)
        sftp=paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(35)
        if sftp.normalize(ROOT)!=ROOT:raise RuntimeError('NOA production root identity mismatch')
        files=[]
        for folder in ['', 'noa-app','noa-app/engine','noa-bridge']:
            d=ROOT+'/'+folder if folder else ROOT
            try:
                for item in sftp.listdir_attr(d):
                    if stat.S_ISREG(item.st_mode) and NAME_PATTERN.search(item.filename):
                        files.append({'dir':folder,'name':item.filename,'size':item.st_size})
            except OSError:
                pass
        report={'read_only':True,'root_verified':True,'css':{},'templates':{},'client':{},
                'available_file_names':files[:500]}
        def read(name,maxbytes=260000):
            p=ROOT+'/'+name
            st=sftp.lstat(p)
            if not stat.S_ISREG(st.st_mode) or st.st_size>maxbytes:
                raise ValueError('not a bounded regular UI source')
            with sftp.open(p,'rb') as f:b=f.read(maxbytes+1)
            if len(b)>maxbytes:raise ValueError('oversize')
            return b
        for name in CSS_CANDIDATES:
            try:
                b=read(name)
                body=b.decode('utf-8')
                report['css'][name]={'sha256':hashlib.sha256(b).hexdigest(),
                   'bytes':len(b),'geometry':sanitized_css_rules(body)}
            except (OSError,ValueError,UnicodeDecodeError):
                report['css'][name]={'available':False}
        for name in PHP_CANDIDATES:
            try:
                b=read(name)
                report['templates'][name]={'sha256':hashlib.sha256(b).hexdigest(),
                  'bytes':len(b),'related_tags':select_tags(b.decode('utf-8')),
                  'markup_layout_risks':markup_layout_risks(b.decode('utf-8'))}
            except (OSError,ValueError,UnicodeDecodeError):
                report['templates'][name]={'available':False}
        for name in JS_CANDIDATES:
            try:
                b=read(name)
                report['client'][name]={'sha256':hashlib.sha256(b).hexdigest(),
                  'bytes':len(b),'selectors':select_js_classes(b.decode('utf-8'))}
            except (OSError,ValueError,UnicodeDecodeError):
                report['client'][name]={'available':False}
        OUT.mkdir(parents=True,exist_ok=True)
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print('N80_READONLY_INVENTORY '+json.dumps({
            'files_scanned':len(report['css'])+len(report['templates'])+len(report['client']),
            'css_readable':sum(bool(x.get('sha256')) for x in report['css'].values()),
            'templates_readable':sum(bool(x.get('sha256')) for x in report['templates'].values()),
            'js_readable':sum(bool(x.get('sha256')) for x in report['client'].values()),
            'geometries':sum(len(x.get('geometry',[])) for x in report['css'].values()),
            'production_writes':0,'credentials_in_report':False},ensure_ascii=False))
    finally:
        transport.close()
if __name__=='__main__':main()
