import noa_sftp_deploy as deploy
import noa_lab_deploy as lab
def main():
 lab.private_storage();deploy.FILES={"bridge/lab-oauth-core.php":"noa-bridge/lab-oauth-core.php","bridge/lab-oauth.php":"noa-bridge/lab-oauth.php"};deploy.UPGRADE_FROM["noa-bridge/lab-oauth.php"]='351ad66734db31e04c78306575e6cbd31e4a9ea6deb9167d7d013e624f80fe20';deploy.main()
if __name__=="__main__":main()
