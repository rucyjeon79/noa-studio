"""Observe the currently downloadable APK only on a disposable emulator."""
import hashlib,json,re,subprocess,time,urllib.request
from pathlib import Path

def adb(*args,check=True):
    return subprocess.run(['adb',*args],capture_output=True,text=True,check=check,timeout=60).stdout.strip()

serial=adb('get-serialno')
if not serial.startswith('emulator-'):raise SystemExit('Production APK probe requires a disposable emulator')
out=Path('android');out.mkdir(exist_ok=True)
with urllib.request.urlopen('https://noastudio.ai.kr/noa-android-release.json',timeout=30) as r:meta=json.load(r)
name=meta.get('file','')
if not re.fullmatch(r'noa-studio-android-build-[0-9]+[.]apk',name):raise SystemExit('Unknown production APK name')
with urllib.request.urlopen('https://noastudio.ai.kr/'+name,timeout=45) as r:data=r.read()
if hashlib.sha256(data).hexdigest()!=meta.get('sha256'):raise SystemExit('Production APK hash mismatch')
path=out/'noa-production-probe.apk';path.write_bytes(data)
adb('uninstall','kr.ai.noastudio.test',check=False)
adb('uninstall','kr.ai.noastudio',check=False)
adb('install',str(path))
adb('logcat','-c')
launch=adb('shell','am','start','-W','-n','kr.ai.noastudio/.MainActivity',check=False)
time.sleep(20)
pid=adb('shell','pidof','kr.ai.noastudio',check=False)
errors=adb('logcat','-d','-s','AndroidRuntime:E','NoaApi:E',check=False)
adb('shell','uiautomator','dump','/sdcard/noa-production-ui.xml',check=False)
adb('pull','/sdcard/noa-production-ui.xml',str(out/'noa-production-ui.xml'),check=False)
with (out/'noa-production-screen.png').open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True,timeout=30)
(out/'noa-production-errors.txt').write_text(errors)
proof={'release':meta,'api':adb('shell','getprop','ro.build.version.sdk'),'launch':launch,'running':bool(pid),'fatalException':'FATAL EXCEPTION' in errors,'physicalDevice':False,'emulatorOnly':True,'productionWrites':0}
(out/'noa-production-probe.json').write_text(json.dumps(proof,indent=2))
print(json.dumps(proof))
