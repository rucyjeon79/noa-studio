"""Deploy additive catalog integration routes; no SQL and no authentication bypass."""
from pathlib import Path
import hashlib
import noa_sftp_deploy as deploy
import noa_lab_deploy as lab
FILES={
 'deploy/noa-catalog.php':'noa-catalog.php','deploy/noa-catalog-admin.php':'noa-catalog-admin.php',
 **{'bridge/'+name:'noa-bridge/'+name for name in ['catalog-merge.php','catalog-store.php','catalog-schema.php','catalog-seed.php']},
 'deploy/noa-ai-lab.css':'noa-ai-lab.css','deploy/noa-library.php':'noa-library.php'}
def main():
 lab.private_storage();deploy.FILES=FILES;deploy.UPGRADE_FROM['noa-ai-lab.css']='d184669809ee8e79109a70b53dce5c7cf6f58fbada260f213d0210e90ef49940';deploy.UPGRADE_FROM['noa-library.php']='aa256d18d82b0cc01b6ca142777b0957f2288b9c033f6727e3605fe5045681e0';deploy.main()
if __name__=='__main__':main()
