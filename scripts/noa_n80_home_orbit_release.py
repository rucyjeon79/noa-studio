"""N80 home activity: source-only activation; native executors and queues stay authoritative."""
import noa_ainoa_deploy as release
release.FILES = {p: 'deploy/' + p for p in (
    'noa-ui.js', 'noa-starlight.css', 'noa-browse-edit.js',
    'noa-creator-ai.js', 'noa-app/jukebox/upload.js',
)}
# The prerequisite unified facade owns its shared callers and design extension.
# Keep these sources out of this activation so every source has one deployer.
release.NEW = set()
if __name__ == '__main__':
    release.main()
