"""Add the reviewed Grok cinema workroom to the existing highest-admin AI LAB."""
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/muvy-rules.php':'bridge/muvy-rules.php','noa-bridge/muvy-prompts.php':'bridge/muvy-prompts.php','noa-bridge/muvy-core.php':'bridge/muvy-core.php','noa-bridge/muvy.php':'bridge/muvy.php','noa-muvy-panel.php':'deploy/noa-muvy-panel.php','noa-muvy.css':'deploy/noa-muvy.css','noa-muvy.js':'deploy/noa-muvy.js','noa-ai-lab.php':'deploy/noa-ai-lab.php'}
release.NEW=set(list(release.FILES)[:7])
release.PROTECTED+=['noa-app/home.php','noa-youtube.php','noa-browse.js','noa-bridge/lab-core.php','noa-bridge/lab-api.php','noa-bridge/lab-worker.php','noa-ai-lab.js','noa-bridge/community-core.php','extend/noa.01-community.php']
if __name__=='__main__':
 release.main()
 if 'rollback'not in release.sys.argv:
  from pathlib import Path
  import shutil
  Path('muvy-proof').mkdir(exist_ok=True);shutil.copy('ainoa-proof/deployment.json','muvy-proof/deployment.json')
