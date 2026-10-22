"""Build an immutable, allowlisted DotHome release manifest without touching production."""
import argparse, hashlib, json, pathlib, re, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
EXCLUDED_PREFIXES=('noa-assets/','noa-app/jukebox/','data/','bbs/','adm/','plugin/','theme/','extend/','install/','vendor/')
EXCLUDED_EXACT={'common.php','config.php','_common.php','head.php','tail.php','version.php','noa-bridge/catalog.php','noa-jukebox/.htaccess','noa-bridge/seed.php','noa-bridge/source-archive.php','noa-bridge/catalog-seed.php'}

def allowed(remote):
    p=pathlib.PurePosixPath(remote)
    return bool(remote) and not p.is_absolute() and '..' not in p.parts and not any(remote.startswith(x) for x in EXCLUDED_PREFIXES) and remote not in EXCLUDED_EXACT and bool(re.fullmatch(r'[a-zA-Z0-9_./-]+',remote))

def build(commit, mapping, host_id):
    if not re.fullmatch('[a-f0-9]{40}',commit): raise ValueError('invalid commit')
    from noa_deploy_hosts import HOST_ID
    if not HOST_ID.fullmatch(host_id): raise ValueError('invalid host id')
    files=[]
    for remote, local in sorted(mapping.items()):
        if not allowed(remote): continue
        path=ROOT/local
        if not path.is_file() or path.is_symlink(): raise ValueError('missing or symlink '+local)
        content=path.read_bytes()
        files.append({'path':remote,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)})
    return {'schema':1,'release':commit,'host_id':host_id,'files':files,'requires_server_preflight':True,'activate':False}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',required=True)
    parser.add_argument('--host-id',required=True)
    args=parser.parse_args()
    import sys
    sys.path.insert(0,str(ROOT/'scripts'))
    from noa_full_inventory import mappings
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    manifest=build(commit,mappings(),args.host_id)
    target=pathlib.Path(args.output)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(manifest,indent=2)+'\n')
    print('DOT_HOME_MANIFEST_PREPARED',len(manifest['files']),commit)
if __name__=='__main__': main()
