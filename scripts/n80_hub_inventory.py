"""Inventory the existing responsibilities; blocked dependencies remain explicit."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
def inventory():
 rows=[]
 for p in sorted((ROOT/'.github/workflows').glob('*.yml')):
  if p.name.startswith('busan-'):continue
  text=p.read_text()
  rows.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
    'scheduled':bool(re.search(r'^  schedule:',text,re.M)),
    'manual':bool(re.search(r'^  workflow_dispatch:',text,re.M)),
    'operations':sorted(set(re.findall(r'scripts/n80_auto.py ([a-z_.]+)',text)))})
 return {'version':1,'authority':'N80 Hub','workflows':rows,'remaining':[
  {'label':'음원 최적화·카드 처리','reason':'기존 Python·FFmpeg 작업 실행기를 호스트 Node·미디어 실행기로 옮기는 작업과 실제 음원 검증이 남았습니다. 기존 대기열을 유지합니다.'},
  {'label':'ChatGPT 계정 생성 실행기','reason':'비공개 실행기의 로그인 저장·갱신과 Codex 실행 환경을 호스트로 이전해야 합니다. 인증 자료를 공개 소스에 넣지 않습니다.'},
  {'label':'Gemini·Flow 브라우저','reason':'현재 호스트에 /proc 및 브라우저 sandbox 실행 환경이 없습니다. 검증된 대체 실행 환경이 마련되기 전까지 기존 경로를 유지합니다.'},
  {'label':'Android 빌드·서명','reason':'호스트에 Java·Android SDK·Gradle 빌드 환경이 없으며 기존 서명키를 안전하게 이전해야 합니다. 현재 배포 APK는 그대로 이용할 수 있습니다.'},
  {'label':'쇼츠 합성·자막·외부 저장','reason':'호스트 미디어 런타임은 설치됐지만 자막 인식과 전체 제작 실행 경로, 기존 GitHub 임시 결과의 인수 검증이 남았습니다.'},
  {'label':'기타 배포·유지관리 작업','reason':'과거 배포 및 감사 워크플로는 기능별 대체 검증 후 종료합니다. 신규 Hub 패키지 배포는 GitHub 없이 실행됩니다.'},
 ]}
if __name__=='__main__':
 target=ROOT/'config/n80-hub-dependencies.json';target.write_text(json.dumps(inventory(),ensure_ascii=False,indent=2)+'\n')
