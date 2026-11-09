"""Install the official Playwright headless browser in N80's private host runtime."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat

ROOT = '/hosting/noastudio/noa-ai-lab/host-runtime'
START = r'''const {spawn}=require('node:child_process');
const [loader,libs,browser,profile]=process.argv.slice(2);
const child=spawn(loader,['--library-path',libs,browser,'--headless','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--user-data-dir='+profile,'--dump-dom','about:blank'],{detached:true,stdio:['ignore','pipe','pipe']});
let output='',error='',timedOut=false,finished=false;
const stop=()=>{if(child.pid)try{process.kill(-child.pid,'SIGKILL')}catch{}};
const timer=setTimeout(()=>{timedOut=true;stop()},20000);
child.stdout.on('data',b=>{output+=b.toString();if(output.length>32768)stop()});
child.stderr.on('data',b=>{error+=b.toString();if(error.length>32768)stop()});
const done=code=>{if(finished)return;finished=true;clearTimeout(timer);stop();
 let reason=timedOut?'browser_start_timeout':'browser_start_failed';
 if(/No usable sandbox|namespace.*(?:failed|permitted)|Operation not permitted|Running as root/.test(error))reason='host_browser_sandbox_unavailable';
 else if(/shared libraries|GLIBC_/.test(error))reason='browser_library_missing';
 else if(/Permission denied/.test(error))reason='browser_execution_denied';
 const started=code===0&&output.includes('<html')&&output.includes('</html>');
 console.log(JSON.stringify({state:started?'host_browser_started':reason,browserStarted:started,exitCode:code}));
 process.exitCode=started?0:1;
};
child.on('error',()=>done(null));child.on('close',done);
'''


def browser_result(output, exit_code):
    try:
        value = json.loads(output)
    except (ValueError, UnicodeError):
        return {'state': 'host_browser_result_invalid', 'browserStarted': False}
    allowed = {'host_browser_started', 'browser_start_timeout', 'browser_start_failed',
               'host_browser_sandbox_unavailable', 'browser_library_missing', 'browser_execution_denied'}
    if not isinstance(value, dict) or value.get('state') not in allowed:
        return {'state': 'host_browser_result_invalid', 'browserStarted': False}
    started = exit_code == 0 and value.get('browserStarted') is True and value.get('state') == 'host_browser_started'
    return {'state': 'host_browser_started' if started else (value['state'] if value['state'] != 'host_browser_started' else 'browser_start_failed'),
            'browserStarted': started}


def remove_profile(sftp, path, expected):
    if path != expected and not path.startswith(expected+'/'):
        raise ValueError('profile_cleanup_scope')
    for item in sftp.listdir_attr(path):
        if item.filename in ('.', '..') or '/' in item.filename:
            raise ValueError('invalid_profile_entry')
        child = path+'/'+item.filename
        if stat.S_ISDIR(item.st_mode):
            remove_profile(sftp, child, expected)
        else:
            sftp.remove(child)
    sftp.rmdir(path)


def browser_package(cache):
    from noa_host_media_runtime import runtime_libraries
    cache = Path(cache).resolve()
    candidates = [p for name in ('chrome-headless-shell', 'headless_shell') for p in cache.rglob(name) if p.is_file() and not p.is_symlink()]
    if len(candidates) != 1:
        raise ValueError('runner_browser_package_missing')
    binary = candidates[0]
    files = {}
    for path in binary.parent.rglob('*'):
        if path.is_symlink():
            raise ValueError('browser_package_symlink')
        if path.is_file():
            rel = path.relative_to(binary.parent).as_posix()
            if Path(rel).parts[0] == 'locales' and not path.name.startswith(('en-US.', 'ko.')):
                continue
            if not re.fullmatch(r'[a-zA-Z0-9_./+\-]+', rel) or '..' in Path(rel).parts:
                raise ValueError('invalid_browser_package_name')
            files['browser/'+rel] = path
    for name, path in runtime_libraries(binary).items():
        files['lib/'+name] = path
    total = sum(path.stat().st_size for path in files.values())
    if not 1_000_000 < total < 600_000_000 or len(files) > 250:
        raise ValueError(f'browser_package_limit: files={len(files)}, bytes={total}')
    return binary, files


def install_browser(transport, node):
    from noa_host_media_runtime import execute
    import paramiko
    binary, files = browser_package(os.environ['NOA_HOST_BROWSER_CACHE'])
    total = sum(path.stat().st_size for path in files.values())
    hashes = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name,path in files.items()}
    bundle_sha = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
    folder = ROOT+'/browser-'+bundle_sha[:16]
    starter = ROOT+'/browser-start-'+hashlib.sha256(START.encode()).hexdigest()[:16]+'.cjs'
    profile = ROOT+'/browser-check-'+os.urandom(8).hex()
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.get_channel().settimeout(45)
    added, directories = [], []
    profile_created = False
    started = False

    def mkdir(path):
        try:
            existing = sftp.lstat(path)
            if not stat.S_ISDIR(existing.st_mode) or sftp.normalize(path) != path:
                raise ValueError('unsafe_browser_directory')
        except FileNotFoundError:
            sftp.mkdir(path, 0o700)
            directories.append(path)

    def put(path, local=None, content=None):
        expected = hashes[local[0]] if local else hashlib.sha256(content).hexdigest()
        size = local[1].stat().st_size if local else len(content)
        try:
            sftp.lstat(path)
        except FileNotFoundError:
            with sftp.open(path, 'wx') as dest:
                added.append(path)
                dest.set_pipelined(True)
                if local:
                    with local[1].open('rb') as source:
                        shutil.copyfileobj(source, dest, length=262144)
                else:
                    dest.write(content)
        info = sftp.lstat(path)
        if not stat.S_ISREG(info.st_mode) or info.st_size != size:
            raise ValueError('browser_size_mismatch')
        actual = hashlib.sha256()
        with sftp.open(path, 'rb') as source:
            source.prefetch(file_size=size, max_concurrent_requests=16)
            while block := source.read(262144):
                actual.update(block)
        if actual.hexdigest() != expected:
            raise ValueError('browser_checksum_mismatch')
        sftp.chmod(path, 0o700)

    try:
        mkdir(folder)
        for name, path in sorted(files.items()):
            parts = Path(name).parts[:-1]
            parent = folder
            for part in parts:
                parent += '/'+part
                mkdir(parent)
            put(folder+'/'+name, local=(name,path))
        put(starter, content=START.encode())
        sftp.mkdir(profile, 0o700)
        profile_created = True
        node_path = ROOT+'/node-'+node['sha256'][:16]
        node_libs = ROOT+'/lib-'+node['sha256'][:16]
        node_command = node_path
        if node.get('privateLibraries'):
            node_command = node_libs+'/ld-linux-x86-64.so.2 --library-path '+node_libs+' '+node_path
        command = ' '.join([node_command, starter, folder+'/lib/ld-linux-x86-64.so.2', folder+'/lib', folder+'/browser/'+binary.name, profile])
        result = execute(transport, command=command, parser=browser_result, deadline_seconds=30)
        started = result.get('browserStarted') is True
        result.update(bundleSha256=bundle_sha, bytes=total, installed=started)
        return result
    finally:
        if profile_created:
            remove_profile(sftp, profile, profile)
        if not started:
            for path in reversed(added):
                sftp.remove(path)
            for path in sorted(set(directories), key=len, reverse=True):
                sftp.rmdir(path)
        sftp.close()
