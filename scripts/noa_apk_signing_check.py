"""Never replace the production download with an APK that cannot update existing installations."""
from pathlib import Path
import hashlib,json,os,re,subprocess,tempfile,urllib.request
root=Path(os.environ.get('ANDROID_HOME','/usr/local/lib/android/sdk'))
tools=sorted((root/'build-tools').glob('*/apksigner'))
if not tools:raise SystemExit('APK signing verifier unavailable; production release preserved')
apksigner=str(tools[-1])
def fingerprint(path):
    text=subprocess.check_output([apksigner,'verify','--verbose','--print-certs',str(path)],text=True)
    match=re.search(r'certificate SHA-256 digest:\s*([0-9a-fA-F]{64})',text)
    if not match:raise RuntimeError('No verified signer certificate: '+repr([line for line in text.splitlines() if 'certificat' in line.lower() or 'signer' in line.lower()]))
    return match[1].lower()
with urllib.request.urlopen('https://noastudio.ai.kr/noa-android-release.json',timeout=30) as r:meta=json.load(r)
name=meta.get('file','')
if not re.fullmatch(r'noa-studio-android-build-[0-9]+[.]apk',name):raise SystemExit('Unknown existing release; preserved')
with urllib.request.urlopen('https://noastudio.ai.kr/'+name,timeout=45) as r:old=r.read()
if hashlib.sha256(old).hexdigest()!=meta['sha256']:raise SystemExit('Existing release integrity failed; preserved')
with tempfile.TemporaryDirectory() as folder:
    path=Path(folder)/'existing.apk';path.write_bytes(old)
    existing=fingerprint(path);candidate=fingerprint(Path('artifact/app-debug.apk'))
print('Existing signer SHA256:',existing)
print('Candidate signer SHA256:',candidate)
if existing!=candidate:raise SystemExit('APK signing identity differs. Existing download and installed user data preserved. Original signing key is required for an in-place upgrade.')
print('APK signer continuity verified')

# Signed identity alone is insufficient: package and increasing version must match.
aapts=sorted((root/'build-tools').glob('*/aapt'))
if not aapts:raise SystemExit('APK package verifier unavailable; production preserved')
badging=subprocess.check_output([str(aapts[-1]),'dump','badging','artifact/app-debug.apk'],text=True)
package=re.search(r"package: name='([^']+)' versionCode='([0-9]+)'",badging)
if not package or package[1]!='kr.ai.noastudio' or package[2]!=os.environ['GITHUB_RUN_NUMBER']:
    raise SystemExit('APK package/version mismatch; production preserved')
if int(package[2])<int(meta.get('versionCode',meta.get('build',0))):
    raise SystemExit('Stale APK version; production preserved')
print('APK package and version verified')
