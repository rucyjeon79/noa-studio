import noa_sftp_deploy as deploy
import noa_lab_deploy as lab
def main():
 lab.private_storage();deploy.FILES={"bridge/lab-oauth-core.php":"noa-bridge/lab-oauth-core.php","bridge/lab-oauth.php":"noa-bridge/lab-oauth.php"};deploy.UPGRADE_FROM["noa-bridge/lab-oauth.php"]='4203d5712e8dad94bfe41f7ab0763dab88482bea73a5b13586532a0697cdff13';deploy.main()
if __name__=="__main__":main()
