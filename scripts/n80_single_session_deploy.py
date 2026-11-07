"""One N80 source activation path with exact preimages, dependency order and rollback."""
import os
import noa_ainoa_deploy as release

# Existing libraries remain specialists beneath N80; this script never runs a worker.
MODULES = (
    'task-status.php', 'app-lifecycle.php', 'registry.php', 'health.php',
    'adapter-contract.php', 'dispatch-gate.php', 'executor.php', 'service-runtime.php',
    'policy.php', 'integration-audit.php', 'n80.php', 'readiness.php', 'bridge.php', 'guardian.php',
    'lease-state.php', 'music-adapter.php', 'authenticated-probe.php',
    'readonly-pipeline.php', 'receipt-contract.php', 'app-data.php',
)

release.FILES = {'noa-app/engine/' + name: 'deploy/noa-app/engine/' + name for name in MODULES}

release.FILES.update({'noa-bridge/'+name:'bridge/'+name for name in (
    'ainoa-automation.php', 'worker-text.php', 'worker-batch.php', 'worker-index.php', 'worker-media.php', 'worker-status.php',
)})
release.FILES.update({
    'noa-app/engine/app-observe.php':'deploy/noa-app/engine/app-observe.php',
    'noa-app/engine/consume-music.php':'deploy/noa-app/engine/consume-music.php',
    'noa-bridge/lab-worker.php':'bridge/lab-worker.php',
})
if os.environ.get('N80_DEPLOY_JUKEBOX_CLI') == '1':
    release.FILES['noa-app/jukebox/cli.php'] = 'deploy/noa-app/jukebox/cli.php'
release.NEW = set(release.FILES)
release.PROTECTED = [path for path in release.PROTECTED if path not in release.FILES]
if __name__ == '__main__':
    release.main()
