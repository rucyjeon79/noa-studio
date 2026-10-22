import pathlib, sys, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from noa_dothome_manifest import allowed,build

class ManifestSafetyTest(unittest.TestCase):
    def test_path_guard(self):
        for path in ('../config.php','/etc/passwd','data/dbconfig.php','bbs/login.php','noa-assets/music.mp3','noa-app/jukebox/upload.php','noa-bridge/catalog.php','foo\\bar'):
            self.assertFalse(allowed(path),path)
        self.assertTrue(allowed('noa-app/home.php'))
    def test_commit_validation(self):
        with self.assertRaises(ValueError): build('invalid',{})
    def test_dry_run_default(self):
        manifest=build('a'*40,{})
        self.assertFalse(manifest['activate'])
        self.assertTrue(manifest['requires_server_preflight'])
        self.assertEqual(manifest['files'],[])
if __name__=='__main__':unittest.main()
