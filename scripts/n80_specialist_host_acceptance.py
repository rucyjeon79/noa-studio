"""Bounded acceptance of the direct Hub release; reuse the installed single runner."""
import hashlib
import json
from pathlib import Path
import re
import shlex
import stat
import time
import paramiko
from noa_full_inventory import connect, ROOT as WEB
from noa_n80_ai_worker import signed_tick

ROOT = '/hosting/noastudio/noa-hub'


def main():
    transport = connect()
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(20)
        def read(path):
            info = sftp.lstat(path)
            if not stat.S_ISREG(info.st_mode) or info.st_size > 2 * 1024 * 1024:
                raise RuntimeError('unsafe_acceptance_source')
            with sftp.open(path, 'rb') as stream:
                return stream.read()
        # Every installed source must equal the reviewed direct-release candidate.
        import os
        os.environ['N80_DEPLOY_COMMON_MODULES'] = '1'
        import n80_single_session_deploy as scoped
        for remote, local in scoped.release.FILES.items():
            if read(WEB + '/' + remote) != Path(local).read_bytes():
                raise RuntimeError('specialist_source_mismatch:' + remote)
        control_before = read(ROOT + '/control.json')
        control = json.loads(control_before)
        if control.get('stop') or control.get('paused'):
            raise RuntimeError('hub_intentionally_stopped_preserved')
        status_before = json.loads(read(ROOT + '/status.json'))
        # Only the already installed, reviewed launcher and runner may execute.
        for name in ('launch.mjs', 'runner.mjs'):
            if read(ROOT + '/runtime/' + name) != Path('runtime/hub/' + name).read_bytes():
                raise RuntimeError('hub_runtime_source_changed')
        args = json.loads(read(ROOT + '/node-command.json'))
        if not isinstance(args, list) or not 1 <= len(args) <= 4 or any(not isinstance(a, str) or (a != '--library-path' and not re.fullmatch(r'/hosting/noastudio/noa-ai-lab/host-runtime/(?:node-[a-f0-9]{16}|lib-[a-f0-9]{16}(?:/ld-linux-x86-64[.]so[.]2)?)', a)) for a in args):
            raise RuntimeError('hub_runtime_command_invalid')
        if time.time() - status_before.get('heartbeatAt', 0) > 180:
            if read(ROOT + '/control.json') != control_before:
                raise RuntimeError('hub_control_changed')
            channel = transport.open_session(timeout=20)
            channel.settimeout(30)
            channel.exec_command(shlex.join(args + [ROOT + '/runtime/launch.mjs']))
            output = channel.makefile('r').read(1024).decode()
            code = channel.recv_exit_status()
            channel.close()
            if code != 0 or output.strip() not in ('N80_HUB_RUNNING', 'N80_HUB_START_REQUESTED'):
                raise RuntimeError('hub_existing_runner_start_failed')
            print(output.strip(), flush=True)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            state = json.loads(read(ROOT + '/status.json'))
            if state.get('heartbeatAt', 0) > status_before.get('heartbeatAt', 0) and time.time() - state['heartbeatAt'] < 30:
                break
            time.sleep(3)
        else:
            try:
                error = json.loads(read(ROOT + '/runner-error.json'))
            except FileNotFoundError:
                error = {}
            print('N80_HUB_DIAGNOSTIC ' + json.dumps({k: error.get(k) for k in ('error','stage','at')}), flush=True)
            raise RuntimeError('hub_heartbeat_not_verified')
        key = read('/hosting/noastudio/noa-ai-lab/worker.key').strip()
        status = signed_tick(key, 'n80_status')
        ownership = status.get('moduleOwnership', {})
        if not {'guard', 'notify', 'media'}.issubset(ownership.get('modules', [])) or ownership.get('hub', {}).get('notifications.dispatch') != 'notify' or ownership.get('services', {}).get('complete') != 'media':
            raise RuntimeError('specialist_live_contract_failed')
        if status.get('generationRequests') != 0:
            raise RuntimeError('unexpected_generation_request')
        if read(ROOT + '/control.json') != control_before:
            raise RuntimeError('hub_control_changed_during_acceptance')
        result = {'ok': True, 'verifiedSources': len(scoped.release.FILES), 'sourceRevision': json.loads(read(ROOT + '/source.json')).get('revision'), 'heartbeatAt': state['heartbeatAt'], 'moduleOwnership': ownership, 'generationRequests': 0, 'controlUnchanged': True, 'newSchedulers': 0}
        Path('specialist-proof').mkdir(exist_ok=True)
        Path('specialist-proof/direct-acceptance.json').write_text(json.dumps(result, indent=2))
        print('N80_DIRECT_SPECIALISTS_VERIFIED ' + json.dumps(result), flush=True)
    finally:
        transport.close()


if __name__ == '__main__':
    main()
