"""Home/AInoa presentation only; no service or data mutations."""
import sys
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/community-music.php': 'bridge/community-music.php', 'noa-bridge/community-audio.php': 'bridge/community-audio.php', 'noa-bridge/community-core.php': 'bridge/community-core.php', 'noa-bridge/community.php': 'bridge/community.php', 'noa-community.js': 'deploy/noa-community.js', 'noa-community.css': 'deploy/noa-community.css', 'noa-ecosystem.js': 'deploy/noa-ecosystem.js', 'noa-app/ecosystem-view.php': 'deploy/noa-app/ecosystem-view.php', 'noa-sitemap.php': 'deploy/noa-sitemap.php', 'noa-channel.php': 'deploy/noa-channel.php', 'extend/noa.design.php': 'deploy/noa-design.extend.php', 'extend/noa.01-community.php': 'deploy/noa-community.extend.php'}
release.NEW={'noa-bridge/community-music.php','noa-bridge/community-audio.php'}
release.PROTECTED += ['noa-ainoa.js','noa-voice.js','noa-ainoa.php']
if __name__=='__main__':
 try: release.main()
 except Exception:
  if 'rollback' not in sys.argv and release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
