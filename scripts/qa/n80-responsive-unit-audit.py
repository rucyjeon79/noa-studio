#!/usr/bin/env python3
"""Read-only live N80 responsive-unit audit. SSH is pinned; no host mutation.
The report contains selectors and dimensional properties only: no secrets,
markup, scripts, user data, or stylesheet URLs.
"""
import base64, collections, hashlib, json, os, re, stat
from pathlib import Path
import paramiko
import tinycss2

ROOT='/hosting/noastudio/html'
FINGERPRINT='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
OUT=Path('n80-responsive-unit-audit')
FILES=[
'noa-ui.css','noa-account.css','noa-starlight.css','noa-ainoa.css',
'noa-member-surfaces.css','noa-creator.css','noa-creative.css',
'noa-music.css','noa-music-vinyl.css','noa-listening.css','noa-ai-lab.css',
'noa-notebooklm.css','noa-channel-view.css','noa-support.css',
'noa-ecosystem.css','noa-membership-wallet.css','noa-creator-apply.css',
'noa-record-form.css','noa-gnuboard.css','noa-app/jukebox/upload.css'
]
DIMENSIONS={
 'width','min-width','max-width','height','min-height','max-height',
 'inline-size','min-inline-size','max-inline-size','block-size',
 'min-block-size','max-block-size','flex','flex-basis','grid-template-columns',
 'grid-template-rows','left','right','top','bottom','inset',
 'margin-left','margin-right','padding-left','padding-right','gap',
 'row-gap','column-gap','aspect-ratio'
}
LAYOUT={'display','flex-wrap','flex-direction','align-items','justify-content','position','box-sizing','overflow','overflow-x','overflow-y','white-space'}
WIDE_RE=re.compile(r'\b(200|2[1-9]\d|[3-9]\d{2}|\d{4,})px\b',re.I)
PERCENT_RE=re.compile(r'(?:\d+(?:\.\d+)?)%',re.I)
UNIT_RE=re.compile(r'(?:\d+(?:\.\d+)?)px\b',re.I)
FIXED_RE=re.compile(r'(?i)(?:width|inline-size|min-width|min-inline-size)\s*:\s*(?:[2-9]\d{2}|\d{4,})px\b')
SELECTORS_OF_INTEREST=[
 'noa-my-account-grid','nnb-row','ng-actions','.creator-tree',
 'creator-row','creator-actions','noa-account-bar','noa-version-button',
 'noa-pwa-float-nav','ainoa-symbol','channel-search','noa-creative',
 'creative-controls','noa-support','noa-settings-row','noa-record',
 'noa-music-context-nav','noa-browse-grid','noa-home','noa-shell','noa-mobile-nav',
 'noa-hero-actions','lab-','noa-payment','noa-pay','sod_frm','.ec-', 'noa-collection',
 'batch-controls','batch-fields','noa-dialog','noa-login-form','ncea-', 'nl-listen-row',
 'noa-primary','noa-btn','.noa-button','action-group','noa-card-grid'
]
def read(sftp,name):
    full=ROOT+'/'+name
    try:
        st=sftp.lstat(full)
        if not stat.S_ISREG(st.st_mode) or st.st_size>250000: return None
        with sftp.open(full,'rb') as f:b=f.read(250001)
        if len(b)>250000:return None
        return b
    except (OSError,IOError):return None
def safe_value(value):
    value=re.sub(r'url\([^)]*\)','[URL]',value,flags=re.I)
    value=re.sub(r'["\'][^"\']{40,}["\']','[TEXT]',value)
    return re.sub(r'\s+',' ',value).strip()[:180]

def analyze(css):
    all_rules=[]
    def walk(items,condition='global'):
        for r in items:
            if r.type=='at-rule' and r.content is not None and r.lower_at_keyword in ('media','supports','container','layer'):
                cond=safe_value(tinycss2.serialize(r.prelude))
                if len(cond)>100:cond=cond[:100]
                try: nested=tinycss2.parse_rule_list(r.content,skip_whitespace=True,skip_comments=True)
                except Exception:continue
                walk(nested,condition+' @'+r.lower_at_keyword+' '+cond)
            if r.type!='qualified-rule' or r.content is None:continue
            selector=safe_value(tinycss2.serialize(r.prelude))
            if len(selector)>220:selector=selector[-220:]
            try: declarations=tinycss2.parse_declaration_list(r.content,skip_whitespace=True,skip_comments=True)
            except Exception:continue
            props={}
            for d in declarations:
                if d.type!='declaration' or d.lower_name not in DIMENSIONS|LAYOUT:continue
                value=safe_value(tinycss2.serialize(d.value))
                if value: props[d.lower_name]=value+(' !important' if d.important else '')
            if not props:continue
            all_rules.append({'line':r.source_line,'selector':selector,'media':condition,'props':props})
    walk(tinycss2.parse_stylesheet(css,skip_whitespace=True,skip_comments=True))
    return all_rules

def findings_for(name,rules):
    candidates=[]
    for r in rules:
        p=r['props']; sel=r['selector'];ctx=(name+' '+sel).lower()
        if not any(s in ctx for s in SELECTORS_OF_INTEREST):continue
        mobile=('max-width' in r['media'] or 'max-inline-size' in r['media'] or 'max-device-width' in r['media'])
        # Percentage dimensions on intrinsic-size controls must be checked against their parents.
        if any(k in p and PERCENT_RE.search(p[k]) for k in ('width','height','inline-size','block-size','flex-basis')) and re.search(r'(?:^|[.# ])(?:button|btn|icon|toggle|float|menu|checkbox|radio|version|tool)',sel,re.I):
            candidates.append({**r,'direction':'percentage_in_control','reason':'Check if percent sizing is intended for the full row or mistakenly scales an intrinsic control'})
        if any(k in p and WIDE_RE.search(p[k]) for k in ('width','min-width','inline-size','min-inline-size','grid-template-columns','flex','flex-basis')):
            if re.search(r'(?:^|[.#! ])(?:row|grid|container|panel|dialog|actions|toolbar|card|form|tree|layout|main|channel|input|label|account|membership|creator|shop|support|settings|batch)',sel,re.I):
                candidates.append({**r,'direction':'rigid_px_in_fluid_region','reason':'Verify viewport constraint and min-width:0 / max-width:100% or mobile wrap'})
        if re.search(r'noa-my-account-grid',sel) and 'grid-template-columns' in p:
            candidates.append({**r,'direction':'mobile_grid_column_check','reason':'MY account columns must collapse as width decreases'})
        if re.search(r'nnb-row.*button|ng-actions|noa-settings-row label',sel) and ('width' in p or 'min-width' in p):
            candidates.append({**r,'direction':'mixed_text_action_row','reason':'Review fixed/flexible allocation when text and buttons share the same row'})
        if re.search(r'ainoa-symbol|noa-pwa-float-nav',sel) and any(k in p for k in ('width','height','left','bottom','right')):
            candidates.append({**r,'direction':'fixed_float_geometry','reason':'Fixed control size may be correct; ensure overlay never hides content'})
    uniq={}
    for r in candidates:
        key=(r['line'],r['selector'],r['direction'])
        uniq[key]=r
    return list(uniq.values())[:150]

def main():
    t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        public=t.get_remote_server_key()
        pin='SHA256:'+base64.b64encode(hashlib.sha256(public.asbytes()).digest()).decode().rstrip('=')
        if pin!=FINGERPRINT:raise RuntimeError('host_identity_changed')
        t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        sftp=paramiko.SFTPClient.from_transport(t)
        sftp.get_channel().settimeout(35)
        if sftp.normalize(ROOT)!=ROOT:raise RuntimeError('root_identity_changed')
        out={'checkedSource':'live_pinned_SFTP','readOnly':True,'hostWrites':0,
             'files':{},'candidateFindings':[], 'notes':['Static flags are review candidates, not all confirmed defects'] }
        for name in FILES:
            b=read(sftp,name)
            if b is None:out['files'][name]={'available':False};continue
            try: css=b.decode('utf-8')
            except UnicodeDecodeError:out['files'][name]={'invalidUtf8':True};continue
            rules=analyze(css)
            hits=findings_for(name,rules)
            out['files'][name]={'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),
                'rules':len(rules),'flags':len(hits),
                'interestingRules':[r for r in rules if any(z in r['selector'] for z in ('noa-my-account-grid','nnb-row','ng-actions','noa-pwa-float-nav','ainoa-symbol','creator-tree-line','noa-settings-row','channel-search'))][:75]}
            out['candidateFindings'] += [{'file':name,**row} for row in hits]
        OUT.mkdir(parents=True,exist_ok=True)
        (OUT/'unit-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
        print('N80_UNIT_AUDIT',json.dumps({'files':len(out['files']),'readable':sum('sha256' in x for x in out['files'].values()),
            'reviewCandidates':len(out['candidateFindings']),'hostWrites':0},ensure_ascii=False))
    finally:t.close()
if __name__=='__main__':main()
