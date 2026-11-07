"""N80 home activity: source-only activation; native executors and queues stay authoritative."""
import noa_ainoa_deploy as release
release.FILES = {p: 'deploy/' + p for p in (
    'noa-ui.js', 'noa-starlight.css', 'noa-browse-edit.js', 'noa-channel-batch.js',
    'noa-muvy.js', 'noa-ai-lab.js', 'noa-creator-ai.js', 'noa-app/jukebox/upload.js',
)}
release.FILES['extend/noa.design.php'] = 'deploy/noa-design.extend.php'
release.NEW = set()
if __name__ == '__main__':
    release.main()
