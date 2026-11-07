from pathlib import Path
import shutil, os
root=Path(__file__).resolve().parents[2]
site=Path(os.environ.get('NCD_SITE','/tmp/noa-creative-test/html'))
site.mkdir(parents=True,exist_ok=True)
shutil.copytree(root/'deploy',site,dirs_exist_ok=True)
shutil.copytree(root/'bridge',site/'noa-bridge',dirs_exist_ok=True)
print('CREATIVE_TEST_SITE_READY')
