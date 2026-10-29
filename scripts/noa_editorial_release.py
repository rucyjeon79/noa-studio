"""Publish only company/legal presentation assets, with existing host-key and preimage guards."""
import os
import sys
import urllib.request
from pathlib import Path
import noa_ainoa_deploy as release
release.FILES={
 'noa-assets/editorial-starlight-studio.webp':'deploy/noa-assets/editorial/starlight-studio.webp',
 'noa-assets/editorial-noa-portrait.webp':'deploy/noa-assets/editorial/noa-portrait.webp',
 'noa-assets/editorial-noel-portrait.webp':'deploy/noa-assets/editorial/noel-portrait.webp',
 'noa-editorial.css':'deploy/noa-editorial.css',
 'noa-editorial.js':'deploy/noa-editorial.js',
 'noa-app/editorial-content.php':'deploy/noa-app/editorial-content.php',
 'noa-app/editorial.php':'deploy/noa-app/editorial.php',
 'noa-about.php':'deploy/noa-about.php',
 'noa-privacy.php':'deploy/noa-privacy.php',
 'noa-terms.php':'deploy/noa-terms.php',
 'extend/noa.editorial.php':'deploy/noa-editorial.extend.php',
 'noa-app/home.php':'deploy/noa-app/home.php',
 'noa-sitemap.php':'deploy/noa-sitemap.php',
}
release.NEW=set(release.FILES)-{'noa-app/home.php','noa-sitemap.php'}
release.PROTECTED=['common.php','data/dbconfig.php','bbs/login.php','bbs/login_check.php','bbs/content.php','noa-music.php','noa-world.php','noa-hero.js','noa-ui.js','extend/noa.design.php','noa-app/engine/n80.php','noa-app/jukebox/stream.php','noa-app/jukebox/download.php']
release.BACKUP=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-editorial-before.json'

def verify():
 for path,needle in [('/noa-about.php','하람'),('/noa-privacy.php','개인정보처리방침'),('/noa-terms.php','청약철회'),('/bbs/content.php?co_id=privacy','개인정보처리방침'),('/bbs/content.php?co_id=provision','청약철회'),('/','회사소개')]:
  with urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=30) as response:
   html=response.read().decode('utf-8')
   if response.status!=200 or needle not in html or 'Fatal error' in html or '내용을 입력하십시오' in html:
    raise RuntimeError('public_document_failed:'+path)
   if path!='/' and response.headers.get('X-NOA-Editorial')!='20261030-v1':raise RuntimeError('document_route_not_active:'+path)
 for path,source in release.FILES.items():
  if path.endswith('.webp'):
   with urllib.request.urlopen('https://noastudio.ai.kr/'+path,timeout=30) as response:
    if release.sha(response.read())!=release.sha(Path(source).read_bytes()):raise RuntimeError('image_hash_mismatch:'+path)
 print('EDITORIAL_PUBLIC_ROUTES_AND_IMAGES_VERIFIED')

if __name__=='__main__':
 if 'rollback' in sys.argv:release.main()
 else:
  try:release.main();verify()
  except Exception:
   if release.BACKUP.exists():
    sys.argv.append('rollback');release.main()
   raise
