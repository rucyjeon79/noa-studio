#!/usr/bin/env python3
"""Build a source-locked N80 Hub UI package from CURRENT production CSS only.
Read-only SFTP. NEVER deploy, write host state, access members or payment data.
The package requires a fresh N80 Hub source revision when approved for release.
"""
import base64, difflib, hashlib, json, os, stat, re
from pathlib import Path
import paramiko

HOST_ROOT='/hosting/noastudio/html'
FINGERPRINT='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
OUT=Path('n80-ui-repair-candidate')
CHECKED_SOURCE_HASHES={
 'noa-account.css':'e145a81663ba38279fada1de09548f8ec38a717e8e58bc6ecf538a01f4b78b98',
 'noa-creator.css':'9b32071f88a8ea9c009c150f1fcb674cab3d2a0f4488a1d8b2ac4bf20ff5574',
 'noa-notebooklm.css':'12af9233d5b7a48',
 'noa-ai-lab.css':'cb66b2199f0aaa6'
}
# The shorter hashes above are only discovery hints. For safety, verify full hashes
# through the read-only N80 audit report when adding those files to the actual package.
SAFE_HASHES={k:v for k,v in CHECKED_SOURCE_HASHES.items() if len(v)==64}
SCOPED_PATCHES={
 'noa-account.css': r'''
/* N80 MOBILE ACCOUNT STRUCTURE — 2026-11-16.
   Prevent the long membership entitlement from splitting in a narrow half-column. */
@media (max-width: 640px) {
  html.noa-member-ui body.noa-page #noa-my-account .noa-my-account-grid,
  html body.noa-page #noa-my-account .noa-my-account-grid {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 16px;
    column-gap: 0;
  }
  html body.noa-page #noa-my-account .noa-my-account-grid > * {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  html body.noa-page #noa-my-account .noa-my-account-grid dd {
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
  html body.noa-page #noa-my-account .noa-my-account-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: stretch;
  }
  html body.noa-page #noa-my-account .noa-my-account-actions > a {
    flex: 1 1 140px;
    min-width: 0;
    min-height: 44px;
  }
}
''',
 'noa-creator.css': r'''
/* N80 MOBILE CREATOR HIERARCHY — 2026-11-16.
   Retain 44px hit targets while aligning group names and counts. */
@media (max-width: 640px) {
  body.noa-page .creator-tree,
  body.noa-page .creator-tree ul {
    box-sizing: border-box;
    max-width: 100%;
    min-width: 0;
  }
  body.noa-page .creator-tree-tools {
    gap: 8px;
    margin-block: 0 12px;
    align-items: center;
  }
  body.noa-page .creator-tree-tools > button {
    box-sizing: border-box;
    min-height: 44px;
    max-width: 100%;
    white-space: normal;
    padding: 8px 12px;
  }
  body.noa-page .creator-tree-line {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    gap: 8px;
    min-height: 52px;
    padding-block: 4px;
  }
  body.noa-page .creator-tree-line > .creator-tree-label {
    min-width: 0;
    flex: 1 1 auto;
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: keep-all;
  }
  body.noa-page .creator-tree-line > small {
    flex: 0 0 auto;
    max-width: 48px;
    line-height: 1.4;
    text-align: end;
    white-space: nowrap;
  }
  body.noa-page .creator-tree :is(input[type=search], input:not([type=checkbox]):not([type=radio])) {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
  }
}
'''
}
def sha(data):return hashlib.sha256(data).hexdigest()
def read_exact(sftp,name):
    if name not in SAFE_HASHES: raise ValueError('unreviewed_source')
    path=HOST_ROOT+'/'+name
    st=sftp.lstat(path)
    if not stat.S_ISREG(st.st_mode) or st.st_size>260000:
        raise ValueError('unsafe_source')
    with sftp.open(path,'rb') as stream: blob=stream.read(260001)
    if len(blob)>260000 or sha(blob)!=SAFE_HASHES[name]:
        raise RuntimeError('production_source_changed:'+name)
    blob.decode('utf-8')
    return blob

def main():
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',)
        transport.start_client(timeout=20)
        server=transport.get_remote_server_key()
        pin='SHA256:'+base64.b64encode(hashlib.sha256(server.asbytes()).digest()).decode().rstrip('=')
        if pin!=FINGERPRINT:raise RuntimeError('host_fingerprint_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        sftp=paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(30)
        if sftp.normalize(HOST_ROOT)!=HOST_ROOT:raise RuntimeError('production_root_mismatch')
        rows=[];patches=[];safe_source_paths=[]
        for name,patch in SCOPED_PATCHES.items():
            before=read_exact(sftp,name)
            if 'N80 MOBILE ACCOUNT STRUCTURE' in before.decode('utf-8') or 'N80 MOBILE CREATOR HIERARCHY' in before.decode('utf-8'):
                raise RuntimeError('patch_already_present:'+name)
            # Append-only to protect the original source and preserve all functions.
            candidate=before.rstrip(b'\n')+b'\n\n'+patch.strip().encode('utf-8')+b'\n'
            if candidate.count(b'{')!=candidate.count(b'}'):
                raise RuntimeError('css_braces_invalid:'+name)
            if patch.count('{')!=patch.count('}') or '!important' in patch or '@import' in patch:
                raise RuntimeError('css_scope_or_important_invalid:'+name)
            row={'path':name,'beforeSha256':sha(before),'sha256':sha(candidate),
                 'bytes':len(candidate),'data':base64.b64encode(candidate).decode('ascii')}
            rows.append(row)
            safe_source_paths.append(name)
            additions='\n'.join(difflib.unified_diff(
                before.decode('utf-8').splitlines(),candidate.decode('utf-8').splitlines(),
                fromfile='production/'+name,tofile='candidate/'+name,lineterm=''))
            patches.append(additions)
        package={'version':1,'id':sha(json.dumps([r['sha256'] for r in rows]).encode())[:32],'files':rows}
        report={
            'status':'CANDIDATE_ONLY_NOT_DEPLOYED','source':'pinned_sftp_current_host',
            'target':'N80 Hub guarded release after connector restoration',
            'sourceRevision':'MUST_REFRESH_BEFORE_APPLY',
            'files':[{'path':r['path'],'beforeSha256':r['beforeSha256'],
                      'candidateSha256':r['sha256'],'bytes':r['bytes']} for r in rows],
            'checks':{'byte_sha256':True,'CSS_append_only':True,'no_important_added':True,
                      'no_secret_or_database_reads':True,'serverWrites':0},
            'pendingChecks':['current Hub revision','N80 UI gate','PHP/JS site render',
                             'authenticated mobile screenshots','owner acceptance'],
        }
        OUT.mkdir(parents=True,exist_ok=True)
        (OUT/'hub-package.json').write_text(json.dumps(package,ensure_ascii=False,indent=2))
        (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        (OUT/'changes.diff').write_text('\n\n'.join(patches),encoding='utf-8')
        print('N80_UI_PATCH_CANDIDATE '+json.dumps({
            'status':report['status'],'files':safe_source_paths,
            'serverWrites':0,'checks':report['checks']},ensure_ascii=False))
    finally:
        transport.close()
if __name__=='__main__':main()
