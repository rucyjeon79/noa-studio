"""One N80 source activation path with exact preimages, dependency order and rollback."""
import os
import noa_ainoa_deploy as release

# Existing libraries remain specialists beneath N80; this script never runs a worker.
MODULES = (
    'policy.php', 'integration-audit.php', 'n80.php', 'bridge.php', 'guardian.php',
    'lease-state.php', 'music-adapter.php', 'authenticated-probe.php',
    'readonly-pipeline.php', 'receipt-contract.php',
)
release.FILES = {'noa-app/engine/' + name: 'deploy/noa-app/engine/' + name for name in MODULES}
if os.environ.get('N80_DEPLOY_JUKEBOX_CLI') == '1':
    release.FILES['noa-app/jukebox/cli.php'] = 'deploy/noa-app/jukebox/cli.php'
release.NEW = set(release.FILES)
release.PROTECTED = [path for path in release.PROTECTED if path not in release.FILES]
if __name__ == '__main__':
    release.main()
