"""Install the official Playwright headless browser in N80's private host runtime."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile

ROOT = '/hosting/noastudio/noa-ai-lab/host-runtime'
START = r'''const {spawn}=require('node:child_process');
const fs=require('node:fs');
const hostEnvironment={rootUser:process.getuid?.()===0};
for(const [name,file] of [['userNamespaceLimit','/proc/sys/user/max_user_namespaces'],['unprivilegedUsernsClone','/proc/sys/kernel/unprivileged_userns_clone'],['apparmorUsernsRestricted','/proc/sys/kernel/apparmor_restrict_unprivileged_userns']]){
 try{const value=fs.readFileSync(file,'utf8').trim();if(/^\d{1,10}$/.test(value))hostEnvironment[name]=Number(value)}catch{}
}
try{const status=fs.readFileSync('/proc/self/status','utf8');for(const name of ['Seccomp','NoNewPrivs']){const value=status.match(new RegExp('^'+name+':\\s*(\\d+)$','m'));if(value)hostEnvironment[name]=Number(value[1])}}catch{}
const [loader,libs,browser,profile,mode='page']=process.argv.slice(2);
const args=mode==='version'?['--version']:['--headless','--enable-logging=stderr','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--user-data-dir='+profile,'--dump-dom','about:blank'];
const child=spawn(browser,args,{cwd:require('node:path').dirname(browser),env:{...process.env,LD_LIBRARY_PATH:libs},detached:true,stdio:['ignore','pipe','pipe']});
let output='',error='',timedOut=false,finished=false,spawnError=null;
const stop=()=>{if(child.pid)try{process.kill(-child.pid,'SIGKILL')}catch{}};
const timer=setTimeout(()=>{timedOut=true;stop()},20000);
child.stdout.on('data',b=>{output+=b.toString();if(output.length>32768)stop()});
child.stderr.on('data',b=>{error+=b.toString();if(error.length>32768)stop()});
const done=(code,signal=null)=>{if(finished)return;finished=true;clearTimeout(timer);stop();
 let reason=timedOut?'browser_start_timeout':'browser_start_failed';
 if(/No usable sandbox|sandbox helper|namespace.*(?:failed|permitted)|Operation not permitted|Running as root/.test(error))reason='host_browser_sandbox_unavailable';
 else if(/shared libraries|GLIBC_/.test(error))reason='browser_library_missing';
 else if(/Permission denied/.test(error))reason='browser_execution_denied';
 const executableStarted=mode==='version'&&code===0&&/\b(?:Chromium|Chrome|HeadlessChrome)\b.*\b\d+\.\d+\.\d+\.\d+\b/.test(output);
 const started=mode==='page'&&code===0&&output.includes('<html')&&output.includes('</html>');
 const diagnostic=error.replace(/\/[^\s:]+/g,'<path>').replace(/\b\d{6,}\b/g,'<number>').slice(-1200);
 console.log(JSON.stringify({state:started?'host_browser_started':executableStarted?'host_browser_executable_started':reason,browserStarted:started,executableStarted,exitCode:code,signal,spawnError,stdoutBytes:Buffer.byteLength(output),stderrBytes:Buffer.byteLength(error),diagnostic,hostEnvironment}));
 process.exitCode=started||executableStarted?0:1;
};
child.on('error',failure=>{spawnError=['EPERM','EACCES','ENOENT','ENOEXEC','ENOMEM','EAGAIN','ETXTBSY'].includes(failure.code)?failure.code:'spawn_failed';done(null)});child.on('close',done);
'''
VERIFY = r'''const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
(async()=>{try{
 const [folder,manifest,expected]=process.argv.slice(2),raw=fs.readFileSync(manifest);
 if(crypto.createHash('sha256').update(raw).digest('hex')!==expected)throw Error();
 const files=JSON.parse(raw),root=fs.realpathSync(folder);
 if(Object.keys(files).length>250)throw Error();
 for(const [name,meta] of Object.entries(files)){
  if(!/^[a-zA-Z0-9_./+\-]+$/.test(name)||name.startsWith('/')||name.split('/').includes('..'))throw Error();
  const file=path.join(root,name),info=fs.lstatSync(file);
  if(!info.isFile()||info.size!==meta.bytes||!fs.realpathSync(file).startsWith(root+'/'))throw Error();
  const hash=crypto.createHash('sha256');for await(const block of fs.createReadStream(file))hash.update(block);
  if(hash.digest('hex')!==meta.sha256)throw Error();
 }
 console.log(JSON.stringify({verified:true,files:Object.keys(files).length}));
}catch{console.log(JSON.stringify({verified:false}));process.exitCode=1}})();
'''


def package_result(output, exit_code):
    try:
        value = json.loads(output)
        valid = isinstance(value, dict) and value.get('verified') is True and exit_code == 0
    except (ValueError, UnicodeError):
        valid = False
    return {'verified': valid}


def host_prerequisite_result(output, exit_code):
    value = json.loads(output)
    if exit_code != 0 or not isinstance(value, dict):
        raise ValueError('host_prerequisite_result_invalid')
    names = ('procDirectory', 'procSelfExecutable', 'procStatusReadable')
    result = {name:value[name] for name in names if type(value.get(name)) is bool}
    errors = value.get('errors', {})
    result['errors'] = {name:errors[name] for name in names if isinstance(errors, dict) and errors.get(name) in {'ENOENT','EACCES','EPERM','ENOTDIR','EINVAL'}}
    result['state'] = ('host_proc_unavailable' if any(result.get(name) is False for name in names)
                       else 'host_filesystem_verified' if all(result.get(name) is True for name in names)
                       else 'host_filesystem_unverified')
    return result


def host_prerequisites(transport, node):
    from noa_host_media_runtime import execute
    import shlex
    # Read only fixed procfs prerequisites; never change the host's mounts or policy.
    script = r'''const fs=require('node:fs'),result={errors:{}};
for(const [name,read] of [['procDirectory',()=>fs.statSync('/proc').isDirectory()],['procSelfExecutable',()=>!!fs.readlinkSync('/proc/self/exe')],['procStatusReadable',()=>fs.readFileSync('/proc/self/status').length>0]]){
 try{result[name]=read()}catch(error){result[name]=false;result.errors[name]=['ENOENT','EACCES','EPERM','ENOTDIR','EINVAL'].includes(error.code)?error.code:'UNKNOWN'}
}console.log(JSON.stringify(result));'''
    path = ROOT+'/node-'+node['sha256'][:16]
    libs = ROOT+'/lib-'+node['sha256'][:16]
    args = [libs+'/ld-linux-x86-64.so.2','--library-path',libs,path] if node.get('privateLibraries') else [path]
    return execute(transport, command=shlex.join(args+['-e',script]), parser=host_prerequisite_result, deadline_seconds=15)


def browser_result(output, exit_code):
    try:
        value = json.loads(output)
    except (ValueError, UnicodeError):
        return {'state': 'host_browser_result_invalid', 'browserStarted': False}
    allowed = {'host_browser_started', 'host_browser_executable_started', 'browser_start_timeout', 'browser_start_failed',
               'host_browser_sandbox_unavailable', 'browser_library_missing', 'browser_execution_denied'}
    if not isinstance(value, dict) or value.get('state') not in allowed:
        return {'state': 'host_browser_result_invalid', 'browserStarted': False}
    started = exit_code == 0 and value.get('browserStarted') is True and value.get('state') == 'host_browser_started'
    result = {'state': 'host_browser_started' if started else (value['state'] if value['state'] != 'host_browser_started' else 'browser_start_failed'),
              'browserStarted': started}
    result['executableStarted'] = exit_code == 0 and value.get('executableStarted') is True and value['state'] == 'host_browser_executable_started'
    if isinstance(value.get('diagnostic'), str):
        result['diagnostic'] = value['diagnostic'][:1200]
    code = value.get('exitCode')
    if code is None or type(code) is int and -255 <= code <= 255:
        result['exitCode'] = code
    if value.get('signal') in {'SIGABRT','SIGBUS','SIGILL','SIGKILL','SIGSEGV','SIGSYS','SIGTERM','SIGTRAP','SIGXCPU','SIGXFSZ','SIGQUIT','SIGHUP','SIGINT','SIGPIPE'}:
        result['signal'] = value['signal']
    if value.get('spawnError') in {'EPERM','EACCES','ENOENT','ENOEXEC','ENOMEM','EAGAIN','ETXTBSY','spawn_failed'}:
        result['spawnError'] = value['spawnError']
    for name in ('stdoutBytes', 'stderrBytes'):
        if type(value.get(name)) is int and 0 <= value[name] <= 262144:
            result[name] = value[name]
    environment = value.get('hostEnvironment')
    if isinstance(environment, dict):
        safe = {name: environment[name] for name in ('userNamespaceLimit', 'unprivilegedUsernsClone', 'apparmorUsernsRestricted', 'Seccomp', 'NoNewPrivs')
                if type(environment.get(name)) is int and 0 <= environment[name] <= 4294967295}
        if type(environment.get('rootUser')) is bool:
            safe['rootUser'] = environment['rootUser']
        result['hostEnvironment'] = safe
    return result


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
    source_hashes = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name,path in files.items()}
    bundle_sha = hashlib.sha256(json.dumps({'files':source_hashes,'interpreter':'private-elf-v1'}, sort_keys=True).encode()).hexdigest()
    folder = ROOT+'/browser-'+bundle_sha[:16]
    # Directly running ld-linux makes /proc/self/exe point at the loader; Chrome
    # then cannot find ICU/resources or its own subprocess executable. Give each
    # executable the private interpreter in its ELF header instead.
    patched = tempfile.TemporaryDirectory(prefix='n80-browser-elf-')
    for name, path in list(files.items()):
        if not name.startswith('browser/'):
            continue
        with path.open('rb') as source:
            if source.read(4) != b'\x7fELF':
                continue
        check = subprocess.run(['patchelf','--print-interpreter',str(path)], capture_output=True, timeout=10)
        if check.returncode != 0:
            continue
        target = Path(patched.name)/name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        subprocess.run(['patchelf','--set-interpreter',folder+'/lib/ld-linux-x86-64.so.2',str(target)], check=True, timeout=30, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        files[name] = target
    if files['browser/'+binary.name] == binary:
        patched.cleanup()
        raise ValueError('browser_interpreter_not_patched')
    hashes = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name,path in files.items()}
    total = sum(path.stat().st_size for path in files.values())
    starter = ROOT+'/browser-start-'+hashlib.sha256(START.encode()).hexdigest()[:16]+'.cjs'
    verifier = ROOT+'/browser-verify-'+hashlib.sha256(VERIFY.encode()).hexdigest()[:16]+'.cjs'
    manifest = json.dumps({name: {'bytes': path.stat().st_size, 'sha256': hashes[name]} for name,path in files.items()}, sort_keys=True).encode()
    manifest_sha = hashlib.sha256(manifest).hexdigest()
    manifest_path = ROOT+'/browser-manifest-'+manifest_sha[:16]+'.json'
    profile = ROOT+'/browser-check-'+os.urandom(8).hex()
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.get_channel().settimeout(45)
    added, directories = [], []
    profile_created = False
    started = False
    package_verified = False

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
        if local is None:
            with sftp.open(path, 'rb') as source:
                if hashlib.sha256(source.read(size+1)).hexdigest() != expected:
                    raise ValueError('browser_checksum_mismatch')
        sftp.chmod(path, 0o700)

    try:
        print('N80_HOST_STAGE browser_transfer_started', len(files), total, flush=True)
        mkdir(folder)
        for index, (name, path) in enumerate(sorted(files.items()), 1):
            parts = Path(name).parts[:-1]
            parent = folder
            for part in parts:
                parent += '/'+part
                mkdir(parent)
            put(folder+'/'+name, local=(name,path))
            if index % 10 == 0 or index == len(files):
                print('N80_BROWSER_FILES_STAGED', index, len(files), flush=True)
        put(starter, content=START.encode())
        put(verifier, content=VERIFY.encode())
        put(manifest_path, content=manifest)
        sftp.mkdir(profile, 0o700)
        profile_created = True
        node_path = ROOT+'/node-'+node['sha256'][:16]
        node_libs = ROOT+'/lib-'+node['sha256'][:16]
        node_command = node_path
        if node.get('privateLibraries'):
            node_command = node_libs+'/ld-linux-x86-64.so.2 --library-path '+node_libs+' '+node_path
        print('N80_HOST_STAGE browser_integrity_started', flush=True)
        verified = execute(transport, command=' '.join([node_command, verifier, folder, manifest_path, manifest_sha]), parser=package_result, deadline_seconds=45)
        if verified.get('verified') is not True:
            raise ValueError('host_browser_checksum_mismatch')
        package_verified = True
        print('N80_BROWSER_BUNDLE_VERIFIED', flush=True)
        command = ' '.join([node_command, starter, folder+'/lib/ld-linux-x86-64.so.2', folder+'/lib', folder+'/browser/'+binary.name, profile])
        print('N80_HOST_STAGE browser_version_started', flush=True)
        version = execute(transport, command=command+' version', parser=browser_result, deadline_seconds=30)
        print('N80_BROWSER_VERSION_RESULT', json.dumps(version), flush=True)
        if version.get('executableStarted') is True:
            print('N80_HOST_STAGE browser_launch_started', flush=True)
            result = execute(transport, command=command, parser=browser_result, deadline_seconds=30)
            result['versionProbe'] = version
        else:
            result = dict(version, stage='executable_version')
        started = result.get('browserStarted') is True
        result.update(bundleSha256=bundle_sha, bytes=total, installed=started, packageVerified=True, retainedForDiagnostics=not started)
        return result
    finally:
        if profile_created:
            remove_profile(sftp, profile, profile)
        if not package_verified:
            for path in reversed(added):
                sftp.remove(path)
            for path in sorted(set(directories), key=len, reverse=True):
                sftp.rmdir(path)
        sftp.close()
        patched.cleanup()
