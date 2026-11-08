"""One scoped N80 activation for creative drafts; shared source preimages stay guarded."""
import os,sys
import noa_ainoa_deploy as release
release.FILES={
 **{'noa-bridge/'+p:'bridge/'+p for p in ['creative-core.php','creative-publication.php','creative.php','member-access.php','worker-status.php']},
 **{'noa-app/engine/'+p:'deploy/noa-app/engine/'+p for p in ['creative.php','registry.php','ai-lab.php']},
 **{'noa-app/jukebox/'+p:'deploy/noa-app/jukebox/'+p for p in ['upload-core.php','drive-core.php']},
 **{p:'deploy/'+p for p in ['noa-sitemap.php','noa-work-status.php','noa-record-form.js','noa-browse-edit.js','noa-gpt.php','noa-creative.css','noa-creative.js','noa-lab-creative.php']},
}
# Dependencies activate before entry points and menu exposure.
last=['noa-browse-edit.js','noa-gpt.php','noa-bridge/creative.php','noa-lab-creative.php','noa-app/engine/registry.php','noa-app/engine/ai-lab.php']
release.FILES={**{p:v for p,v in release.FILES.items() if p not in last},**{p:release.FILES[p] for p in last}}
release.NEW={'noa-bridge/creative-core.php','noa-bridge/creative-publication.php','noa-bridge/creative.php','noa-app/engine/creative.php','noa-creative.css','noa-creative.js','noa-lab-creative.php'}
# Presentation-only releases reuse this owner and never activate engine/provider sources.
if os.environ.get('NOA_CREATIVE_PRESENTATION_ONLY')=='1':
 release.FILES={p:'deploy/'+p for p in ['noa-ainoa.css','noa-ainoa.js','noa-browse-edit.js','noa-creative.css','noa-creative.js','noa-lab-creative.php','noa-app/engine/ai-lab.php','noa-app/engine/workspaces.php']}
 release.NEW=set()
if os.environ.get('NOA_CREATIVE_RETENTION_ONLY')=='1':
 release.FILES={**{'noa-bridge/'+p:'bridge/'+p for p in ['creative-core.php']},'noa-app/engine/creative.php':'deploy/noa-app/engine/creative.php',**{'noa-bridge/'+p:'bridge/'+p for p in ['creative.php','worker-text.php']},**{p:'deploy/'+p for p in ['noa-creative.css','noa-creative.js','noa-lab-creative.php']}}
 release.NEW=set()
if os.environ.get('NOA_CREATIVE_REVISION_ONLY')=='1':
 release.FILES={'noa-bridge/creative-core.php':'bridge/creative-core.php','noa-app/engine/creative.php':'deploy/noa-app/engine/creative.php','noa-creative.js':'deploy/noa-creative.js'}
 release.NEW=set()
if os.environ.get('NOA_CREATIVE_BATCH_ONLY')=='1':
 release.FILES={**{'noa-bridge/'+p:'bridge/'+p for p in ['creative-core.php','creative-publication.php']},'noa-app/engine/creative.php':'deploy/noa-app/engine/creative.php',**{p:'deploy/'+p for p in ['noa-browse-edit.js','noa-creative.css','noa-creative.js']}}
 release.NEW=set()
if __name__=='__main__':
 try:
  retention=os.environ.get('NOA_CREATIVE_RETENTION_ONLY')=='1' and 'rollback' not in sys.argv
  if retention:
   import noa_creative_retention
   release.check_current_candidate();noa_creative_retention.main('prepare')
  release.main()
  if retention:noa_creative_retention.main('verify')
 except Exception:
  if release.BACKUP.exists():
   sys.argv.append('rollback');release.main()
  raise
