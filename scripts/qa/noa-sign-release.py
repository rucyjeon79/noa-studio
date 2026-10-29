"""Sign release APK/AAB with the pinned permanent identity, never a generated debug key."""
import hashlib,json,os,stat,subprocess,sys,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import paramiko
from noa_full_inventory import connect
VAULT='/hosting/noastudio/noa-android-signing-v1'
CERT='f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b'
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(45)
try:
    if not stat.S_ISDIR(s.lstat(VAULT).st_mode) or stat.S_IMODE(s.lstat(VAULT).st_mode)!=0o700:raise RuntimeError('Invalid signing vault')
    data={}
    for name in ('identity.json','release.p12','password'):
        st=s.lstat(VAULT+'/'+name)
        if not stat.S_ISREG(st.st_mode) or stat.S_IMODE(st.st_mode)!=0o600:raise RuntimeError('Invalid signing file')
        with s.open(VAULT+'/'+name,'rb') as f:data[name]=f.read()
finally:s.close();t.close()
identity=json.loads(data['identity.json'])
if identity['certificateSha256']!=CERT or hashlib.sha256(data['release.p12']).hexdigest()!=identity['keystoreSha256']:raise RuntimeError('Signing identity changed')
sdk=Path(os.environ['ANDROID_HOME']);build=sorted((sdk/'build-tools').glob('*/apksigner'))[-1].parent
out=Path('release-artifact');out.mkdir(exist_ok=True)
env={**os.environ,'NOA_RELEASE_PASSWORD':data['password'].decode()}
with tempfile.TemporaryDirectory() as directory:
    key=Path(directory)/'release.p12';key.touch(mode=0o600);key.write_bytes(data['release.p12'])
    cert=subprocess.check_output(['keytool','-exportcert','-keystore',str(key),'-storepass:env','NOA_RELEASE_PASSWORD','-alias',identity['alias']],env=env,stderr=subprocess.DEVNULL)
    if hashlib.sha256(cert).hexdigest()!=CERT:raise RuntimeError('Actual certificate differs')
    apk=out/'noa-studio-release.apk'
    subprocess.run([str(build/'zipalign'),'-p','-f','4','android/app/build/outputs/apk/release/app-release-unsigned.apk',str(apk)],check=True)
    subprocess.run([str(build/'apksigner'),'sign','--ks',str(key),'--ks-key-alias',identity['alias'],'--ks-pass','env:NOA_RELEASE_PASSWORD','--key-pass','env:NOA_RELEASE_PASSWORD',str(apk)],env=env,check=True,stdout=subprocess.DEVNULL)
    test_source=Path('android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')
    if test_source.exists():
        test_apk=out/'noa-studio-test.apk'
        subprocess.run([str(build/'zipalign'),'-p','-f','4',str(test_source),str(test_apk)],check=True)
        subprocess.run([str(build/'apksigner'),'sign','--ks',str(key),'--ks-key-alias',identity['alias'],'--ks-pass','env:NOA_RELEASE_PASSWORD','--key-pass','env:NOA_RELEASE_PASSWORD',str(test_apk)],env=env,check=True,stdout=subprocess.DEVNULL)
        subprocess.run([str(build/'apksigner'),'verify',str(test_apk)],check=True)
    verification=subprocess.check_output([str(build/'apksigner'),'verify','--verbose','--print-certs',str(apk)],text=True)
    if CERT not in verification:raise RuntimeError('Signed APK certificate differs')
    badging=subprocess.check_output([str(build/'aapt'),'dump','badging',str(apk)],text=True)
    if 'application-debuggable' in badging or "package: name='kr.ai.noastudio'" not in badging:raise RuntimeError('Invalid release variant/package')
    aab=out/'noa-studio-release.aab';aab.write_bytes(Path('android/app/build/outputs/bundle/release/app-release.aab').read_bytes())
    subprocess.run(['jarsigner','-keystore',str(key),'-storepass:env','NOA_RELEASE_PASSWORD','-keypass:env','NOA_RELEASE_PASSWORD',str(aab),identity['alias']],env=env,check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['jarsigner','-verify',str(aab)],check=True,stdout=subprocess.DEVNULL)
    report={'certificateSha256':CERT,'commit':os.environ['GITHUB_SHA'],'runId':os.environ['GITHUB_RUN_ID'],'versionCode':os.environ['NOA_RELEASE_VERSION_CODE'],'debuggable':False,'requiresMigrationFromDebugBuild13':True,'published':False,'files':{p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in (apk,aab)}}
    (out/'verification.json').write_text(json.dumps(report,indent=2))
    print('SIGNED_RELEASE_VERIFIED '+json.dumps(report))
