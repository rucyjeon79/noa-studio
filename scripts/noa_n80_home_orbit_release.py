"""N80 home activity: source-only activation; native executors and queues stay authoritative."""
import noa_ainoa_deploy as release
import os
import sys
import urllib.request
from pathlib import Path
release.FILES = {p: 'deploy/' + p for p in (
    'noa-ui.js', 'noa-browse-edit.js', 'noa-creator-ai.js', 'noa-app/jukebox/upload.js',
)}
# The existing unified facade owns these shared callers, runtime, stylesheet,
# and design extension. Never activate their dependents over an older rollout.
DEPENDENCIES = ('noa-app/engine/runtime.js', 'noa-starlight.css',
                'noa-muvy.js', 'noa-ai-lab.js', 'noa-channel-batch.js')
release.NEW = set()


def verify_dependencies():
    release.check_current_candidate()
    for path in DEPENDENCIES:
        url = 'https://noastudio.ai.kr/' + path + '?orbit-dependency=' + os.environ['GITHUB_SHA']
        with urllib.request.urlopen(url, timeout=30) as response:
            if response.read() != Path('deploy', path).read_bytes():
                raise RuntimeError('unified_runtime_dependency_not_deployed:' + path)


if __name__ == '__main__':
    if 'rollback' not in sys.argv:
        verify_dependencies()
    release.main()
