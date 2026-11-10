"""One N80 source activation path with exact preimages, dependency order and rollback."""
import os
import noa_ainoa_deploy as release

# Existing libraries remain specialists beneath N80; this script never runs a worker.
MODULES = (
    'guard.php','notify.php','media-covers.php','media-queue.php','media-worker.php','media.php','creator-lab.php','catalog.php','personalization.php',
    'module-contract.php','node.php','setup.php','install.php','lab.php','db.php','sign.php','pay.php',
    'workspaces.php','agent-runtime.php','completion-receipt.php',
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
    'storage.php','member-access.php','toss-core.php','youngcart-core.php','notifications-inline.php',
    'lab-publication.php','muvy-core.php','lab-core.php',
    'ainoa-automation.php', 'worker-text.php', 'worker-batch.php', 'worker-index.php', 'worker-media.php', 'worker-status.php','worker-native.php','worker-muvy.php',
)})
release.FILES.update({
    'noa-app/database/core.php':'deploy/noa-app/database/core.php',
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
# The specialist refactor owns only its changed sources. In particular, do not
# redeploy the Hub-owned lab-worker entry or unrelated frontend/media sources.
if os.environ.get('N80_DEPLOY_SPECIALISTS') == '1':
    # Reviewed browser diagnosis a709107 changes no source or dependency activated here.
    # Keep ancestor, exact preimage, protected-file and concurrent-write checks intact.
    release.UNRELATED_PATH_PREFIXES = ('runtime/browser/relay.mjs', 'scripts/n80_browser_relay.py', 'tests/engine/test_browser_relay.py')
    specialist_sources = {
        'noa-app/engine/'+name for name in (
            'module-contract.php','node.php','setup.php','install.php','lab.php','db.php','sign.php','pay.php',
            'workspaces.php','agent-runtime.php','completion-receipt.php','app-lifecycle.php','registry.php','service-runtime.php',
        )
    } | {'noa-app/database/core.php'} | {
        'noa-bridge/'+name for name in ('storage.php','member-access.php','toss-core.php','youngcart-core.php','worker-status.php')
    }
    if specialist_sources - release.FILES.keys():
        raise RuntimeError('missing_specialist_activation_source')
    release.FILES = {path:source for path,source in release.FILES.items() if path in specialist_sources}

# The common-module cutover includes Hub adapters after their specialized dependencies.
if os.environ.get('N80_DEPLOY_COMMON_MODULES') == '1':
    # Reviewed UI-test-only commits cannot change any activated source or runtime dependency.
    # Ancestor, exact preimage, protected-source and concurrent-change checks remain mandatory.
    release.UNRELATED_PATH_PREFIXES = ('tests/browser-relay/ui.mjs', 'tests/hub/ui.mjs')
    release.FILES = {
        'noa-app/engine/'+name:'deploy/noa-app/engine/'+name for name in (
            'guard.php','notify.php','media-covers.php','media-queue.php','media-worker.php','media.php','creator-lab.php','catalog.php','personalization.php',
            'module-contract.php','sign.php','registry.php','lab.php','guardian.php','jukebox.php','hub.php','hub-specialists.php','hub-covers.php',
        )
    } | {'noa-hub.php':'deploy/noa-hub.php'} | {'noa-app/jukebox/queue-core.php':'deploy/noa-app/jukebox/queue-core.php'} | {'noa-bridge/'+name:'bridge/'+name for name in ('notifications-inline.php','worker-media.php','worker-status.php')}

# Preserve Hub registration/navigation from reviewed commit cd6e94e when it is installed.
release.EXTRA_KNOWN.update({'noa-app/engine/registry.php': ['79d71d6b9d35f6353ab67390be33dfbe2511fb2fc6295f9b10bd45a46b70ca8a'], 'noa-app/engine/workspaces.php': ['3f8dc95c7325983f8c68cae845a71066e65200782eb8eddd4520151fa19f634b']})
release.STALE_CANDIDATES = ('cd3fe94c9b3dd7d533702283f7792497c91896a9',)
release.NEW = set(release.FILES)
release.PROTECTED = [path for path in release.PROTECTED if path not in release.FILES]
if __name__ == '__main__':
    release.main()
