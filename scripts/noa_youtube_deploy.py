"""Additive YouTube production release. No source SQL writes or credential changes."""
import noa_sftp_deploy as deploy
import noa_lab_deploy as lab
FILES={'deploy/noa-ui.js': 'noa-ui.js', 'deploy/noa-ai-lab.php': 'noa-ai-lab.php', 'deploy/noa-catalog.php': 'noa-catalog.php', 'deploy/noa-youtube.php': 'noa-youtube.php', 'deploy/noa-youtube-admin.php': 'noa-youtube-admin.php', 'deploy/noa-youtube.js': 'noa-youtube.js', 'deploy/noa-youtube.css': 'noa-youtube.css', 'bridge/youtube-core.php': 'noa-bridge/youtube-core.php', 'bridge/youtube-store.php': 'noa-bridge/youtube-store.php', 'bridge/youtube-api.php': 'noa-bridge/youtube-api.php', 'bridge/lab-worker.php': 'noa-bridge/lab-worker.php', 'deploy/noa2.php': 'noa2.php'}
BASELINES={'noa-ui.js': '137234921b9a96c44e356b191ed059990eeafb494080cb9a6477714d50b3d75b', 'noa-ai-lab.php': '09565318c95a7677c60277271382fc5a738c021ec3721b70e77d9cf2406fd9ea', 'noa-catalog.php': 'a50f27da9e39978d3c2cb1cd94ad2d3f7b5747db7d19ce71e134d5803f4eb9d5', 'noa-bridge/lab-worker.php': '3980d1773bac081e99ac3867f5a757994c7c508633c861f339368b33ba72081a', 'noa2.php': 'd735d92ff91a96448a385f2d3fd5f583b2f2a34abb6fd1c38ca4eda872a9ba9b'}
def main():
 lab.private_storage();deploy.FILES=FILES;deploy.UPGRADE_FROM.update(BASELINES);deploy.main()
if __name__=="__main__":main()
