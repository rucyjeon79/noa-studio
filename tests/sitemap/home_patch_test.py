"""Preserve HOME outside the user-approved hero, account header assets, native notices and the approved per-board title projection and the three requested partner banners.
Notice content and disclosure geometry are checked by the native and browser suites.
"""
import argparse,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
# Approved and deployed home-board release; keeps all other home bytes protected.
BASE_COMMIT='e92536b4ec3f20f6cb32e1ece0b1a6cd9584505e'
parser=argparse.ArgumentParser();parser.add_argument('--host-source',type=Path);args=parser.parse_args()
candidate=(ROOT/'deploy/noa-app/home.php').read_bytes()
baseline=args.host_source.read_bytes()if args.host_source else subprocess.check_output(['git','show',BASE_COMMIT+':deploy/noa-app/home.php'],cwd=ROOT)
# Exact user-authorized banner include; every other non-hero byte remains guarded.
MONTHLY_INCLUDE=b"<?php if(is_file(__DIR__.'/monthly-banner.php'))require __DIR__.'/monthly-banner.php';?>\n"
def outside_approved_hero(source):
 source=source.replace(MONTHLY_INCLUDE,b'')
 # User-authorized partner renderer and exactly three call sites; other HOME bytes stay guarded.
 source=re.sub(rb'\nfunction noa_home_banner\(string \$kind\):void\{.*?\n}\n',b'',source,flags=re.S)
 for kind in [b'goods',b'youtube',b'amt']:
  source=source.replace(b"<?php noa_home_banner('"+kind+b"');?>\n",b'')
 source=re.sub(rb'if\(is_file\(dirname\(__DIR__\).*?/noa-bridge/notices[.]php.*?\$noa_notices=.*?;\n',b'',source,flags=re.S)
 source=re.sub(rb'<section class="noa-section noa-notices".*?</section>\n',b'',source,flags=re.S)
 for pattern in [rb'<style id="noa-home-action-layout">.*?</style>',rb'<section class="noa-hero".*?</section>',rb'<script id="noa-home-hero-size">.*?</script>']:
  source,count=re.subn(pattern,b'',source,flags=re.S)
  assert count==1,'one approved hero scope required'
 source=re.sub(rb'/noa-hero[.]js[?]v=[^"\s]+',b'/noa-hero.js?v=APPROVED_RUNTIME',source)
 source=re.sub(rb'/noa-ui[.](css|js)[?]v=[^"\s]+',lambda m:b'/noa-ui.'+m[1]+b'?v=APPROVED_UI',source)
 return source
assert outside_approved_hero(candidate)==outside_approved_hero(baseline),'non-hero HOME source changed'
hero_start=candidate.index(b'<section class="noa-hero"');hero_end=candidate.index(b'</section>',hero_start)
addition=re.findall(rb"<\?php if\(is_file\(dirname\(__DIR__\)\.'/noa-sitemap[.]php'\)\):\?><nav[^\n]*data-home-section=\"sitemap\"[^\n]*</nav><\?php endif;\?>",candidate)
assert len(addition)==1 and hero_start<candidate.index(addition[0])<hero_end,'guarded sitemap must remain inside hero'
community=re.findall(rb'<section class="noa-section noa-home-community" data-home-section="community"[^>]*>[^\n]*</section>\n',candidate)
assert candidate.count(MONTHLY_INCLUDE)==1,'one guarded monthly banner include required'
assert len(community)==1 and candidate[hero_end+len(b'</section>'):].startswith(b'\n'+MONTHLY_INCLUDE+b'<section class="noa-section noa-notices"'),'monthly benefits must follow hero, then native notices'
assert candidate.index(b'data-home-section="notices"')<candidate.index(community[0]),'community remains below notices'
assert candidate.count(b'data-noa-community-home')==1,'one native per-board title projection required'
assert not re.search(rb'TOP\s*10',candidate,re.I),'removed TOP 10 labels returned'
assert candidate.count(b'noa-home.js?v=20261024-popularity-metrics')==1,'reviewed metrics cache revision changed'
for marker in [b'id="noa-hero-video"',b'id="noa-hero-genre"',b'id="noa-hero-play"',b'id="noa-featured"',b'id="noa-ep"',b'id="noa-stories"',b'id="noa-covers"',b'id="noa-acts"']:
 assert candidate.count(marker)==1,'missing/duplicate HOME section '+marker.decode()
print('NOA_HOME_NON_HERO_BYTES_PRESERVED_GENRE_VIDEO_SITEMAP_AND_COMMUNITY_CONTRACT_OK')

for kind in [b'goods',b'youtube',b'amt']:
 assert candidate.count(b"<?php noa_home_banner('"+kind+b"');?>") == 1,'one partner banner per requested position'
for url in [b'https://marpple.shop/kr/jr_lifestyle',b'https://youtube.com/@ainoa_ramjunpapa?sub_confirmation=1',b'https://www.aimusictown.com/creators/ainoa']:
 assert candidate.count(url)==1,'exact requested external destination'
assert b'rel="noopener noreferrer"' in candidate and b'target="_blank"' in candidate
