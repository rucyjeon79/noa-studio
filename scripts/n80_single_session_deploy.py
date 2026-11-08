"""One N80 source activation path with exact preimages, dependency order and rollback."""
import os
import noa_ainoa_deploy as release

# Existing libraries remain specialists beneath N80; this script never runs a worker.
MODULES = (
    'jukebox-references.php', 'jukebox.php',
    'native-receipt.php','native-consumer.php','worker-wake.php',
    'task-status.php', 'app-lifecycle.php', 'registry.php', 'health.php',
    'adapter-contract.php', 'dispatch-gate.php', 'executor.php', 'service-runtime.php',
    'policy.php', 'integration-audit.php', 'n80.php', 'readiness.php', 'bridge.php', 'guardian.php',
    'lease-state.php', 'music-adapter.php', 'authenticated-probe.php',
    'readonly-pipeline.php', 'receipt-contract.php', 'app-data.php',
)

release.FILES = {'noa-app/engine/' + name: 'deploy/noa-app/engine/' + name for name in MODULES}

release.FILES.update({'noa-bridge/'+name:'bridge/'+name for name in (
    'lab-publication.php','muvy-core.php','lab-core.php',
    'ainoa-automation.php', 'worker-text.php', 'worker-batch.php', 'worker-index.php', 'worker-media.php', 'worker-status.php','worker-native.php','worker-muvy.php',
)})
release.FILES.update({
    'noa-app/engine/app-observe.php':'deploy/noa-app/engine/app-observe.php',
    'noa-app/engine/consume-music.php':'deploy/noa-app/engine/consume-music.php',
    'noa-bridge/lab-worker.php':'bridge/lab-worker.php',
})
if os.environ.get('N80_DEPLOY_JUKEBOX_CLI') == '1':
    release.FILES['noa-app/jukebox/cli.php'] = 'deploy/noa-app/jukebox/cli.php'
release.FILES.update({
 'noa-app/engine/runtime.js':'deploy/noa-app/engine/runtime.js',
 'noa-app/jukebox/wake-core.php':'deploy/noa-app/jukebox/wake-core.php',
 **{'noa-bridge/'+name:'bridge/'+name for name in ['muvy.php','lab-api.php','lab-creator.php','lab-file.php']},
 **{name:'deploy/'+name for name in ['noa-muvy.js','noa-ai-lab.php','noa-ai-lab.js','noa-creator.php','noa-channel-batch.js','noa-ainoa-admin.js','noa-starlight.css']},
 'extend/noa.design.php':'deploy/noa-design.extend.php',
})
release.STALE_CANDIDATES = ('cd3fe94c9b3dd7d533702283f7792497c91896a9',)
release.NEW = set(release.FILES)
release.PROTECTED = [path for path in release.PROTECTED if path not in release.FILES]
if __name__ == '__main__':
    release.main()
