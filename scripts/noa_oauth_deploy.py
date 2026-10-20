import noa_sftp_deploy as deploy
import noa_lab_deploy as lab
def main():
 lab.private_storage();deploy.FILES={"bridge/lab-oauth-core.php":"noa-bridge/lab-oauth-core.php","bridge/lab-oauth.php":"noa-bridge/lab-oauth.php"};deploy.UPGRADE_FROM["noa-bridge/lab-oauth.php"]='2d4d2000e9024e48a750d3360ceac960b9a445c36ee1eaca8577a838e733601b';deploy.main()
if __name__=="__main__":main()
