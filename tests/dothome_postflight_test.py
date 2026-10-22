import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_dothome_postflight import verify_public_routes
class Response:
 status=200
 def __init__(self,url):self.url=url
 def geturl(self):return self.url
 def __enter__(self):return self
 def __exit__(self,*args):pass
class PostflightTest(unittest.TestCase):
 def test_healthy_public_routes(self):
  result=verify_public_routes('https://noastudio.ai.kr',['/','/noa-music.php'],lambda req,timeout:Response(req.full_url))
  self.assertTrue(result['ok'])
  self.assertEqual(len(result['routes']),2)
 def test_cross_host_redirect_blocked(self):
  with self.assertRaises(RuntimeError):verify_public_routes('https://noastudio.ai.kr',['/'],lambda req,timeout:Response('https://other.example/'))
 def test_unsafe_path_blocked(self):
  with self.assertRaises(ValueError):verify_public_routes('https://noastudio.ai.kr',['/../data/config.php'])
if __name__=='__main__':unittest.main()
