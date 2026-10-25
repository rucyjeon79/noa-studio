"""Run the actual YouTube PHP page with disposable SQLite/read-model fixtures.
Requires PHP pdo_sqlite. Mapping/publication results are fixed fixtures; the page's
real filters, legacy lyrics selection and detail/HTML output execute unchanged.
"""
import base64
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
IDS={name: value for name,value in [('matched','matched0001'),('legacy','legacy00001'),('rejected','rejected001'),('duplicate','duplicate01'),('private','private0001'),('blocked','blocked0001'),('official','official001'),('act','actvideo001')]}
MARKER='FULL_TEXT_MUST_NOT_APPEAR_IN_INITIAL_HTML'


def encoded(value):
    return base64.b64encode(json.dumps(value).encode()).decode()


class DetailEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory=tempfile.TemporaryDirectory(prefix='noa-youtube-detail-')
        cls.web=Path(cls.directory.name)
        (cls.web/'noa-bridge').mkdir()
        shutil.copyfile(ROOT/'deploy/noa-youtube.php',cls.web/'noa-youtube.php')
        shutil.copyfile(ROOT/'bridge/sound-core.php',cls.web/'noa-bridge/sound-core.php')
        (cls.web/'common.php').write_text("<?php define('_GNUBOARD_',true);$is_member=false;$is_admin='';")
        cls.database=cls.web/'fixture.sqlite'
        (cls.web/'noa-bridge/storage.php').write_text("<?php function noa_bridge_pdo():PDO{return new PDO('sqlite:"+str(cls.database)+"',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}")
        songs={'song1':{'genre_id':'kpop-original','ep':'1','public_verified':True,'fields':{'lyricsBlock':'[Verse 1: Female, soft piano]\n'+MARKER+' canonical\n[Outro: instrumental fade]' }}}
        videos={}
        for name,id in IDS.items():
            videos[id]={'id':id,'snippet':{'title':name,'description':MARKER+' description '+name},'status':{'privacyStatus':'private' if name=='private' else 'public','embeddable':name!='blocked'},'match':{'status':'matched' if name=='matched' else 'rejected' if name=='rejected' else 'unmatched','songId':'song1' if name=='matched' else None}}
        (cls.web/'noa-bridge/youtube-store.php').write_text("<?php function ny_latest(PDO $d):array{return ['run_id'=>'fixture'];} function ny_batch(PDO $d):string{return 'fixture';} function ny_songs(PDO $d,string $b):array{return json_decode(base64_decode('"+encoded(songs)+"'),true);} function ny_videos(PDO $d,array $r,bool $public=true,array $songs=[]):array{return json_decode(base64_decode('"+encoded(videos)+"'),true);} function ny_video_id(string $url):?string{parse_str((string)parse_url($url,PHP_URL_QUERY),$q);return isset($q['v'])&&preg_match('/^[A-Za-z0-9_-]{11}$/D',$q['v'])?$q['v']:null;} function ny_official_members(PDO $d,array $r):array{return ['"+IDS['official']+"'=>true];}")
        (cls.web/'noa-bridge/world-mv.php').write_text("<?php const NWM_PLAYLIST='world-playlist';const NWM_ACT_PLAYLIST='world-act-playlist';function nwm_act_load(PDO $d,array $r,array $v):array{return ['videos'=>[['videoId'=>'"+IDS['act']+"']]];}")
        docs=[]
        for name,count in [('legacy',1),('rejected',1),('duplicate',2)]:
            for i in range(count):
                docs.append([name+str(i),'single',json.dumps({'visibility':'public','body':{'youtubeUrl':'https://www.youtube.com/watch?v='+IDS[name],'lyricsBlock':MARKER+' legacy '+str(i)}})])
        setup="require '"+str(cls.web/'noa-bridge/storage.php')+"';$db=noa_bridge_pdo();$db->exec('CREATE TABLE noa_documents(doc_key TEXT,kind TEXT,payload TEXT)');$db->exec('CREATE TABLE noa_youtube_playlists(run_id TEXT,playlist_id TEXT,payload TEXT)');$q=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)');foreach(json_decode(base64_decode('"+encoded(docs)+"'),true)as $r)$q->execute($r);"
        subprocess.run(['php','-r',setup],check=True,capture_output=True)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def request(self,detail=None,method='GET'):
        status=self.web/'status.json'
        query={} if detail is None else {'detail':detail}
        code="$_GET=json_decode(base64_decode('"+encoded(query)+"'),true);$_SERVER['REQUEST_METHOD']='"+method+"';register_shutdown_function(function(){file_put_contents('"+str(status)+"',json_encode(['status'=>http_response_code()?:200]));});require '"+str(self.web/'noa-youtube.php')+"';"
        result=subprocess.run(['php','-r',code],capture_output=True,text=True,check=True)
        return json.loads(status.read_text())['status'],result.stdout

    def test_initial_html_does_not_embed_full_text(self):
        status,body=self.request()
        self.assertEqual(status,200)
        self.assertNotIn(MARKER,body)
        self.assertIn('window.NoaVideoDetails={}',body)
        self.assertIn('data-video="'+IDS['matched']+'"',body)
        self.assertNotIn('data-video="'+IDS['official']+'"',body)
        self.assertNotIn('data-video="'+IDS['act']+'"',body)

    def test_exact_matched_detail_preserves_original_text(self):
        status,body=self.request(IDS['matched'])
        self.assertEqual(status,200)
        data=json.loads(body)
        self.assertEqual(data['videoId'],IDS['matched'])
        self.assertEqual(data['lyrics'],MARKER+' canonical')
        self.assertEqual(data['description'],MARKER+' description matched')
        self.assertNotIn('<!doctype',body)

    def test_explicit_legacy_url_fallback_still_works(self):
        status,body=self.request(IDS['legacy'])
        self.assertEqual(status,200)
        self.assertEqual(json.loads(body)['lyrics'],MARKER+' legacy 0')

    def test_rejected_or_duplicate_mapping_never_guesses_lyrics(self):
        for name in ['rejected','duplicate']:
            with self.subTest(name=name):
                status,body=self.request(IDS[name])
                self.assertEqual(status,200)
                self.assertEqual(json.loads(body)['lyrics'],'')

    def test_private_blocked_official_act_or_unknown_video_is_not_available(self):
        for name in ['private','blocked','official','act']:
            with self.subTest(name=name):
                status,body=self.request(IDS[name])
                self.assertEqual(status,404)
                self.assertNotIn(MARKER,body)
        self.assertEqual(self.request('unknown0001')[0],404)

    def test_exact_id_and_get_only(self):
        self.assertEqual(self.request('../invalid')[0],400)
        self.assertEqual(self.request(['matched0001'])[0],400)
        self.assertEqual(self.request(IDS['matched'],'POST')[0],405)
        self.assertEqual(self.request(IDS['matched'],'HEAD')[0],405)


if __name__=='__main__':
    unittest.main()
