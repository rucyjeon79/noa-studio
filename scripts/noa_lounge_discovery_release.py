"""Deploy only the new read-only lounge projection and its existing navigation entry points."""
import noa_ainoa_deploy as release

release.FILES = {
    'noa-bridge/lounge-discovery.php': 'bridge/lounge-discovery.php',
    'noa-lounge-discovery.css': 'deploy/noa-lounge-discovery.css',
    'noa-lounge-discovery.php': 'deploy/noa-lounge-discovery.php',
    'noa-app/ecosystem-view.php': 'deploy/noa-app/ecosystem-view.php',
    'noa-my.php': 'deploy/noa-my.php',
}
release.NEW = {'noa-bridge/lounge-discovery.php','noa-lounge-discovery.css','noa-lounge-discovery.php'}
release.UNRELATED_PATH_PREFIXES = ('scripts/busan_', '.github/workflows/busan-', 'docs/busan/', 'deploy/busan/')
if __name__=='__main__': release.main()
