"""Disposable loopback MySQL + actual PHP streaming + Chromium 35-second MP3.
NOA_PLAYCOUNT_TEST_MYSQL=1 NOA_PLAYWRIGHT_PACKAGE=/.../package.json python this_file
Never loads production bootstrap or connects outside 127.0.0.1. Policy true exists
only in a randomly named disposable schema, dropped even after assertion failure.
"""
import base64
import hashlib
import http.cookiejar
import json
import os
import signal
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def b64(value):
    return base64.b64encode(json.dumps(value).encode()).decode()


def main():
    if os.environ.get('NOA_PLAYCOUNT_TEST_MYSQL') != '1':
        raise RuntimeError('explicit disposable MySQL authorization required')
    if os.environ.get('NOA_PLAYCOUNT_TEST_HOST', '127.0.0.1') != '127.0.0.1':
        raise RuntimeError('only loopback MySQL accepted')
    package = Path(os.environ['NOA_PLAYWRIGHT_PACKAGE']).resolve()
    if not (package.parent/'node_modules/playwright/package.json').is_file():
        raise RuntimeError('existing installed Playwright module required')
    port = int(os.environ.get('NOA_PLAYCOUNT_TEST_PORT', '3306'))
    if not 1 <= port <= 65535:
        raise RuntimeError('invalid isolated MySQL port')
    database = 'noa_playcount_test_' + secrets.token_hex(6)
    connection = {'dsn': f'mysql:host=127.0.0.1;port={port};charset=utf8mb4',
                  'user': os.environ.get('NOA_PLAYCOUNT_TEST_USER', 'root'),
                  'password': os.environ.get('NOA_PLAYCOUNT_TEST_PASSWORD', 'noa-test-only')}
    bootstrap = "$c=json_decode(base64_decode('" + b64(connection) + "'),true);$db=new PDO($c['dsn'],$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);"

    def php(code, use=True):
        prefix = bootstrap + ("$db->exec('USE `"+database+"`');" if use else '')
        result = subprocess.run(['php', '-r', prefix+code], text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError('isolated PHP operation failed: '+result.stderr[-2000:])
        return result.stdout

    server = None
    created = False
    try:
        php("$db->exec('CREATE DATABASE `"+database+"`');", False)
        created = True
        with tempfile.TemporaryDirectory(prefix='noa-real-stream-') as temporary:
            top = Path(temporary)
            web = top/'html'
            for p in ['noa-bridge', 'noa-app/jukebox', 'sessions']:
                (web/p).mkdir(parents=True)
            (top/'noa-ai-lab').mkdir()
            (top/'noa-ai-lab/worker.key').write_text('a'*64)
            media = top/'noa-jukebox-private/media'
            media.mkdir(parents=True)
            audio = media/'fixture.mp3'
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=35','-c:a','libmp3lame','-b:a','128k',str(audio)], check=True)
            assert audio.stat().st_size > 10000
            audio_hash = hashlib.sha256(audio.read_bytes()).hexdigest()
            for name in ['popularity-events.php','popularity-plays.php','popularity-store.php','popularity-core.php','popularity-schema.php','sound-core.php']:
                shutil.copyfile(ROOT/'bridge'/name, web/'noa-bridge'/name)
            for name in ['stream.php','stream-popularity.php','core.php']:
                shutil.copyfile(ROOT/'deploy/noa-app/jukebox'/name,web/'noa-app/jukebox'/name)
            shutil.copyfile(ROOT/'deploy/noa-playcount.js', web/'noa-playcount.js')
            # Only classification/bootstrap are fixture boundaries; all np_* and media
            # authorization/range/path/hash verification code above is real repository code.
            (web/'noa-bridge/taxonomy-store.php').write_text("<?php function nc_exists(PDO $db,string $t):bool{$q=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$q->execute([$t]);return (bool)$q->fetchColumn();} function nt_annotate_records(PDO $db,array $rows):array{return array_map(fn($r)=>$r+['catalogSongId'=>'fixture-canonical-song'],$rows);}")
            (web/'noa-bridge/home-core.php').write_text('<?php // Unused ranking-home fixture boundary.')
            config = connection | {'dsn': connection['dsn']+';dbname='+database}
            (web/'noa-bridge/storage.php').write_text("<?php function noa_bridge_pdo():PDO{$c=json_decode(base64_decode('"+b64(config)+"'),true);return new PDO($c['dsn'],$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);}")
            (web/'common.php').write_text("<?php define('_GNUBOARD_',true);define('G5_PATH',__DIR__);session_save_path(__DIR__.'/sessions');session_start();$member=[];$is_member=false;$is_admin='';")
            includes = "define('_GNUBOARD_',true);require '"+str(web/'noa-bridge/popularity-store.php')+"';require '"+str(web/'noa-app/jukebox/core.php')+"';"
            setup = includes + "np_migrate($db,'isolated-stream-fixture');nj_schema($db);$db->exec('CREATE TABLE noa_documents(doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(32),payload JSON)');$policy=np_defaults();$policy['playbackIntegrationEnabled']=true;$q=$db->prepare('UPDATE noa_popularity_settings SET policy=? WHERE id=1');$q->execute([np_json($policy)]);"
            php(setup)
            doc = {'title':'Isolated MP3','visibility':'public','body':{'sunoUrl':'https://suno.com/song/fixture'}}
            rows = [['fixture:public','single',json.dumps(doc)],['fixture:private','single',json.dumps(doc | {'visibility':'private'})]]
            php("$q=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)');foreach(json_decode(base64_decode('"+b64(rows)+"'),true)as $r)$q->execute($r);$q=$db->prepare(\"INSERT INTO noa_jukebox_assets(song_key,source_url,audio_path,audio_bytes,audio_sha256,status) VALUES(?,?,?,?,?,'ready')\");$q->execute(['fixture:public','https://suno.com/song/fixture','fixture.mp3',"+str(audio.stat().st_size)+",'"+audio_hash+"']);")
            (web/'index.html').write_text('<!doctype html><button id="play">Play fixture</button><article class="song selected" data-key="fixture:public"></article><audio id="sound-player" preload="none" src="/noa-app/jukebox/stream.php?key=fixture%3Apublic"></audio><script src="/noa-playcount.js"></script><script>window.fixtureRms=0;document.getElementById("play").onclick=()=>{const a=document.getElementById("sound-player"),ctx=new AudioContext(),an=ctx.createAnalyser(),data=new Float32Array(2048);an.fftSize=2048;ctx.createMediaElementSource(a).connect(an);an.connect(ctx.destination);ctx.resume();setInterval(()=>{an.getFloatTimeDomainData(data);window.fixtureRms=Math.max(window.fixtureRms,Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length));},250);a.play();};</script>')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1',0))
                http_port=sock.getsockname()[1]
            base=f'http://127.0.0.1:{http_port}'
            # Fixture bootstrap translates only this exact loopback browser origin.
            # The real endpoint still performs its unchanged Origin and CSRF checks.
            with (web/'common.php').open('a') as common:
                common.write("if(($_SERVER['HTTP_ORIGIN']??'')==='"+base+"')$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';")
            logs=open(top/'php.log','w+')
            server=subprocess.Popen(['php','-S',f'127.0.0.1:{http_port}','-t',str(web)],stdout=logs,stderr=logs)
            for _ in range(50):
                try:
                    urllib.request.urlopen(base+'/index.html',timeout=1).close()
                    break
                except OSError:
                    time.sleep(.1)
            def request(path, method='GET', headers=None):
                opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
                try:
                    with opener.open(urllib.request.Request(base+path,method=method,headers=headers or {}),timeout=10) as response:
                        return response.status,response.read()
                except urllib.error.HTTPError as error:
                    return error.code,error.read()
            route='/noa-app/jukebox/stream.php?key=fixture%3Apublic'
            assert request(route,'HEAD')[0] == 200
            assert request(route,headers={'Range':'bytes=999999999-'})[0] == 416
            assert request('/noa-app/jukebox/stream.php?key=fixture%3Aprivate')[0] == 403
            assert request(route+'&type=cover')[0] == 404
            status,part=request(route,headers={'Range':'bytes=0-4095','X-N80-Availability-Check':'1'})
            assert status == 206 and part == audio.read_bytes()[:4096]
            assert php('echo $db->query("SELECT COUNT(*) FROM noa_play_sessions")->fetchColumn();') == '0'
            # Existing hash verifier must reject changed bytes before any start hook.
            with audio.open('ab') as stream:
                stream.write(b'x')
            assert request(route)[0] == 404
            with audio.open('r+b') as stream:
                stream.truncate(audio.stat().st_size-1)
            assert hashlib.sha256(audio.read_bytes()).hexdigest() == audio_hash
            js=top/'browser.cjs'
            js.write_text(r'''
const {createRequire}=require('node:module');
const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE)('playwright');
let phase='launch',page=null;
const errors=[],network=[];
function stage(value){phase=value;console.error('MP3_PHASE '+value);}
async function state(){if(!page)return null;return page.evaluate(()=>{const a=document.getElementById('sound-player');return a?{position:a.currentTime,duration:Number.isFinite(a.duration)?a.duration:null,paused:a.paused,ended:a.ended,readyState:a.readyState,networkState:a.networkState,mediaError:a.error?.code||null,rms:window.fixtureRms}:null;}).catch(()=>null);}
async function close(browser){let timer;try{await Promise.race([browser.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('browser_close_timeout')),5000);})]);}finally{clearTimeout(timer);}}
const watchdog=setTimeout(()=>{console.error('MP3_WATCHDOG '+JSON.stringify({phase,errors,network}));process.exit(1);},70000);
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',timeout:15000,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
 page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>network.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400&&network.length<20)network.push({path:new URL(r.url()).pathname,status:r.status()});});
 stage('navigate');await page.goto(process.env.NOA_PLAYCOUNT_LOOPBACK,{timeout:15000});
 stage('click');await page.click('#play',{timeout:5000});
 stage('real_media_35_seconds');await page.waitForFunction(()=>document.getElementById('sound-player').ended,null,{timeout:45000});
 stage('final_heartbeat');await page.waitForTimeout(1000);const result=await state();
 if(errors.length||result.position<34||!(result.rms>.001))throw Error('real_audio_failed '+JSON.stringify({errors,result}));
 console.log(JSON.stringify(result));
 }catch(error){console.error('MP3_FAILURE '+JSON.stringify({phase,error:error.message,media:await state(),errors,network}));throw error;
 }finally{stage('close_browser');await close(browser);}}
main().then(()=>{clearTimeout(watchdog);process.exit(0);},error=>{clearTimeout(watchdog);console.error(error);process.exit(1);});
''')
            env=os.environ | {'NOA_PLAYWRIGHT_PACKAGE':str(package),'NOA_PLAYCOUNT_LOOPBACK':base+'/index.html'}
            process=subprocess.Popen(['node',str(js)],env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
            try:
                stdout,stderr=process.communicate(timeout=80)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid,signal.SIGKILL)
                stdout,stderr=process.communicate()
                logs.flush()
                raise RuntimeError('real MP3 harness deadline exceeded; browser: '+stderr[-4000:]+'; PHP: '+(top/'php.log').read_text()[-2500:])
            finally:
                # This new process group contains only this invocation's Node/Chromium.
                # Clean up its children if browser.close failed; never touch other work.
                try: os.killpg(process.pid,signal.SIGKILL)
                except ProcessLookupError: pass
            browser=subprocess.CompletedProcess(process.args,process.returncode,stdout,stderr)
            if browser.returncode:
                logs.flush()
                raise RuntimeError('real browser playback failed: '+browser.stderr[-4000:]+'; PHP: '+(top/'php.log').read_text()[-2500:])
            plays=int(php('echo $db->query("SELECT COUNT(*) FROM noa_valid_plays")->fetchColumn();'))
            assert plays == 1, f'expected one real valid play, got {plays}'
            # Replaying identical progress cannot insert a second ledger row.
            dedup=php(includes+"require '"+str(web/'noa-bridge/popularity-plays.php')+"';$s=$db->query('SELECT * FROM noa_play_sessions')->fetch(PDO::FETCH_ASSOC);$r=np_progress_play($db,$s['token'],$s['actor'],35,'progress',false);echo json_encode($r);")
            assert json.loads(dedup).get('duplicate') is True
            assert int(php('echo $db->query("SELECT COUNT(*) FROM noa_valid_plays")->fetchColumn();')) == 1
            print(json.dumps({'realMp3PlaybackSeconds':json.loads(browser.stdout)['position'],'audioSignalRms':json.loads(browser.stdout)['rms'],'validPlays':1,'duplicateRows':0,'headRangePrivateCoverHashAndN80ExclusionVerified':True,'onlyDisposableSchemaPolicyEnabled':True}))
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)
        if created:
            php("$db->exec('DROP DATABASE `"+database+"`');",False)


if __name__ == '__main__':
    main()

