"""N80 menu projection: dependency-first source release with exact preimages and rollback."""
import noa_ainoa_deploy as release
release.FILES = {p: 'deploy/' + p for p in [
    'noa-app/engine/ai-lab.php', 'noa-app/engine/workspaces.php',
    'noa-starlight.css', 'noa-ui.js', 'noa-sitemap.php',
]}
release.NEW = set()
if __name__ == '__main__':
    release.main()
