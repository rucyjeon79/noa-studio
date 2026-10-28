"""Read-only public postflight: no member signup, identity vendor or paid AI calls."""
import json,urllib.request
from pathlib import Path

def main():
 opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
 checks={}
 for path,expected in [('/noa-creator-apply.php','크리에이터로 시작하기'),('/noa-login.php','크리에이터 가입 신청'),('/bbs/register.php','크리에이터로 시작하기')]:
  with opener.open('https://noastudio.ai.kr'+path,timeout=30)as r:
   text=r.read().decode();assert expected in text;assert 'Fatal error' not in text;checks[path]=r.status
 with opener.open('https://noastudio.ai.kr/noa-bridge/creator-enrollment.php',timeout=30)as r:d=json.load(r)
 assert d['ok'] and d['application'] is None
 checks['applicationPrivate']=True;checks['certConfigured']=d['certReady']
 with opener.open('https://noastudio.ai.kr/noa-creator-symbol.php',timeout=30)as r:assert r.headers['Content-Type'].startswith('image/');assert len(r.read())>100
 checks['defaultSymbol']=True;checks['liveIdentityCalls']=0;checks['liveAICalls']=0
 Path('creator-proof').mkdir(exist_ok=True);Path('creator-proof/postflight.json').write_text(json.dumps(checks,indent=2));print('CREATOR_PUBLIC_POSTFLIGHT_OK',json.dumps(checks))
if __name__=='__main__':main()
