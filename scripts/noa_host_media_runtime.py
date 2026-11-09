"""Try the existing DotHome host before choosing a media execution location.

One bounded N80 operation, using the existing pinned SSH connection. It never
reads login profiles or installs a second scheduler. A browser is reported as
started only after a real, local about:blank launch on the hosting machine.
"""
import json
import hashlib
import hmac
import os
from pathlib import Path
import secrets
import socket
import time
import urllib.request

MARKER = 'N80_HOST_EXEC_V1'
COMMAND = r'''printf 'N80_HOST_EXEC_V1\n'
for tool in node nodejs python3 php chromium chromium-browser google-chrome ffmpeg timeout; do
  if command -v "$tool" >/dev/null 2>&1; then printf 'tool=%s\n' "$tool"; fi
done
if command -v node >/dev/null 2>&1; then node -e 'console.log("node_started=1")' 2>/dev/null; fi
if command -v timeout >/dev/null 2>&1; then
  for browser in chromium chromium-browser google-chrome; do
    if command -v "$browser" >/dev/null 2>&1; then
      profile=$(mktemp -d /tmp/n80-browser-check.XXXXXXXX) || exit 1
      trap 'rm -rf -- "$profile"' EXIT HUP INT TERM
      page=$(timeout 12 "$browser" --headless --disable-gpu --disable-dev-shm-usage --user-data-dir="$profile" --dump-dom about:blank 2>/dev/null)
      status=$?
      if [ "$status" = 0 ] && printf '%s' "$page" | grep -q '<html'; then
        printf 'browser_started=1\n'
      fi
      break
    fi
  done
fi
printf 'N80_HOST_EXEC_END\n'
'''
TOOLS = {'node', 'nodejs', 'python3', 'php', 'chromium', 'chromium-browser', 'google-chrome', 'ffmpeg', 'timeout'}


def interpret(output, exit_code):
    lines = output.decode('utf-8', errors='replace').splitlines()
    if MARKER not in lines:
        # Forced-command SFTP hosts can accept the channel but reject its command.
        state = 'host_sftp_only' if 'sftp' in output.decode('utf-8', errors='replace').lower() else 'host_command_not_executed'
        return {'state': state, 'shellExecuted': False, 'browserStarted': False}
    complete = 'N80_HOST_EXEC_END' in lines and exit_code == 0
    browser = complete and 'browser_started=1' in lines
    return {
        'state': 'host_browser_started' if browser else ('host_browser_runtime_missing' if complete else 'host_command_incomplete'),
        'shellExecuted': True, 'commandCompleted': complete,
        'tools': sorted({line[5:] for line in lines if line.startswith('tool=') and line[5:] in TOOLS}),
        'nodeStarted': complete and 'node_started=1' in lines,
        'browserStarted': browser,
    }


def execute(transport, *, deadline_seconds=25):
    channel = None
    try:
        channel = transport.open_session(timeout=10)
        channel.settimeout(10)
        channel.exec_command(COMMAND)
        deadline = time.monotonic() + deadline_seconds
        data = bytearray()
        while True:
            if channel.recv_ready():
                data.extend(channel.recv(4096))
            if channel.recv_stderr_ready():
                data.extend(channel.recv_stderr(4096))
            if len(data) > 16384:
                return {'state': 'host_output_limit', 'shellExecuted': False, 'browserStarted': False}
            if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
                return interpret(bytes(data), channel.recv_exit_status())
            if time.monotonic() >= deadline:
                return {'state': 'host_command_timeout', 'shellExecuted': MARKER.encode() in data, 'browserStarted': False}
            time.sleep(0.05)
    except socket.timeout:
        return {'state': 'host_command_timeout', 'shellExecuted': False, 'browserStarted': False}
    except Exception as error:
        # No remote output, credentials, hostnames, or exception text in public CI.
        return {'state': 'host_exec_channel_rejected', 'errorType': type(error).__name__, 'shellExecuted': False, 'browserStarted': False}
    finally:
        if channel is not None:
            channel.close()


def web_runtime_capabilities():
    # Reuse the existing host's signed, read-only capabilities operation.
    from noa_n80_ai_worker import worker_key
    key = worker_key()
    body = b'{"action":"capabilities","payload":{}}'
    timestamp, nonce = str(int(time.time())), secrets.token_hex(16)
    message = '\n'.join(['NOA-JUKEBOX-1', 'POST', hashlib.sha256(body).hexdigest(), timestamp, nonce])
    request = urllib.request.Request('https://noastudio.ai.kr/noa-app/jukebox/service.php', data=body, headers={
        'Content-Type': 'application/json', 'X-NOA-Timestamp': timestamp, 'X-NOA-Nonce': nonce,
        'X-NOA-Signature': hmac.new(key, message.encode(), hashlib.sha256).hexdigest()})
    with urllib.request.urlopen(request, timeout=10) as response:
        envelope = json.loads(response.read(16384))
    if envelope.get('ok') is not True or not isinstance(envelope.get('result'), dict):
        raise ValueError('invalid_host_capabilities')
    result = envelope['result']
    return {name: result.get(name) is True for name in ('shell_exec_callable', 'proc_open_callable')}


def main():
    from noa_full_inventory import connect
    result = {'authority': 'N80 Engine', 'executionTarget': 'existing_noa_host',
              'authenticatedProvider': False, 'productionReady': False,
              'applicationFilesChanged': False, 'providerGenerationRequested': False}
    transport = None
    try:
        transport = connect()
        result.update(execute(transport))
    except Exception as error:
        result.update(state='host_connection_failed', errorType=type(error).__name__, browserStarted=False)
    finally:
        if transport is not None:
            transport.close()
    try:
        result['phpExecution'] = web_runtime_capabilities()
    except Exception as error:
        result['phpExecution'] = {'state': 'unverified', 'errorType': type(error).__name__}
    result['checkedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    result['sourceCommit'] = os.getenv('GITHUB_SHA', '')
    path = Path('host-media-proof/runtime.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('N80_HOST_MEDIA_RUNTIME', json.dumps(result, ensure_ascii=False), flush=True)
    # A connected SFTP service is not a successfully started media runtime.
    return 0 if result.get('browserStarted') else 1


if __name__ == '__main__':
    raise SystemExit(main())
