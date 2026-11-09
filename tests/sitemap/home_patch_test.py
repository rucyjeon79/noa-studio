"""Preserve HOME outside the user-approved hero, account header assets, native notices and the approved per-board title projection and the three requested partner banners.
Notice content and disclosure geometry are checked by the native and browser suites.
"""
import argparse,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
# Home immediately before repositioning the three existing banners.
# Preserve the current accepted page instead of comparing against the superseded layout.
BASE_COMMIT='61a9eaaee11983cecef4c3948ee9a76495a8c7c9'
parser=argparse.ArgumentParser();parser.add_argument('--host-source',type=Path);args=parser.parse_args()
candidate=(ROOT/'deploy/noa-app/home.php').read_bytes()
baseline=args.host_source.read_bytes()if args.host_source else subprocess.check_output(['git','show',BASE_COMMIT+':deploy/noa-app/home.php'],cwd=ROOT)
# Exact user-authorized banner include; every other non-hero byte remains guarded.
MONTHLY_INCLUDE=b"<?php if(is_file(__DIR__.'/monthly-banner.php'))require __DIR__.'/monthly-banner.php';?>\n"
def outside_approved_hero(source):
 # Normalize only the user-approved fortune move back to its former position.
 move=re.search(rb'(<section class="noa-hero".*?</section>)\n(<section id="noa-daily-fortune"[^>]*>.*?</section>)',source,re.S)
 if move:
  fortune=move.group(2)
  source=source[:move.start(2)-1]+source[move.end(2):]
  source=source.replace(MONTHLY_INCLUDE,MONTHLY_INCLUDE+fortune,1)
 source=source.replace(b'</section>\n'+MONTHLY_INCLUDE+b'<section id="noa-daily-fortune"',b'</section><section id="noa-daily-fortune"')
 source=source.replace(MONTHLY_INCLUDE,b'')
 # Approved ownership verification tags (#270 and Google registration), not layout.
 # Strip only the exact registered values; arbitrary tags or content still fail.
 for tag in [b'<meta name="google-site-verification" content="ITP_veSgoV5LrunUOy08ITLPesQCjQkb8WgHLbeNv-c">',b'<meta name="naver-site-verification" content="1698e241d8bd56b9569f50bb12a136bb67d98bde">']:
  assert candidate.count(tag)==1,'registered ownership tag missing or duplicated'
  source=source.replace(tag,b'')
 # User-authorized partner renderer and exactly three call sites; other HOME bytes stay guarded.
 source=re.sub(rb'\nfunction noa_home_banner\(string \$kind\):void\{.*?\n}\n',b'',source,flags=re.S)
 for kind in [b'goods',b'youtube',b'amt']:
  source=source.replace(b"<?php noa_home_banner('"+kind+b"');?>\n",b'')
 source=re.sub(rb'if\(is_file\(dirname\(__DIR__\).*?/noa-bridge/notices[.]php.*?\$noa_notices=.*?;\n',b'',source,flags=re.S)
 source=re.sub(rb'<section class="noa-section noa-notices".*?</section>\n',b'',source,flags=re.S)
 for pattern in [rb'<style id="noa-home-action-layout">.*?</style>',rb'<section class="noa-hero".*?</section>']:
  source,count=re.subn(pattern,b'',source,flags=re.S)
  assert count==1,'one approved hero scope required'
 # Older home versions had an inline script that hid recommendations on smaller screens.
 source=re.sub(rb'<script id="noa-home-hero-size">.*?</script>',b'',source,flags=re.S)
 source=re.sub(rb'/noa-hero[.]js[?]v=[^"\s]+',b'/noa-hero.js?v=APPROVED_RUNTIME',source)
 source=re.sub(rb'/noa-ui[.](css|js)[?]v=[^"\s]+',lambda m:b'/noa-ui.'+m[1]+b'?v=APPROVED_UI',source)
 # The home fortune invitation is visible before setup. Guard the neighboring content.
 source,n=re.subn(rb'<section id="noa-daily-fortune"[^>]*>.*?</section>',b'<section id="noa-daily-fortune"></section>',source,flags=re.S)
 assert n==1,'one daily fortune card expected'
 source=re.sub(rb'(/noa-listening[.]css)[?]v=[^"\s]+',rb'\1?v=APPROVED_LISTENING',source)
 # Listening fixes may advance cache versions without changing HOME content or geometry.
 source=re.sub(rb'(/noa-listening(?:-model)?[.]js)[?]v=[^"\s]+',rb'\1?v=APPROVED_LISTENING',source)
 return source
assert outside_approved_hero(candidate)==outside_approved_hero(baseline),'non-hero HOME source changed'
hero_start=candidate.index(b'<section class="noa-hero"');hero_end=candidate.index(b'</section>',hero_start)
addition=re.findall(rb"<\?php if\(is_file\(dirname\(__DIR__\)\.'/noa-sitemap[.]php'\)\):\?><nav[^\n]*data-home-section=\"sitemap\"[^\n]*</nav><\?php endif;\?>",candidate)
assert len(addition)==1 and hero_start<candidate.index(addition[0])<hero_end,'guarded sitemap must remain inside hero'
community=re.findall(rb'<section class="noa-section noa-home-community" data-home-section="community"[^>]*>[^\n]*</section>\n',candidate)
assert candidate.count(MONTHLY_INCLUDE)==1,'one guarded monthly banner include required'
assert len(community)==1 and candidate[hero_end+len(b'</section>'):].startswith(b'\n<section id="noa-daily-fortune"'),'daily fortune follows the hero in the initial HTML'
fortune_pattern=rb'<section id="noa-daily-fortune"[^>]*>.*?</section>'
assert re.findall(fortune_pattern,candidate,re.S)==re.findall(fortune_pattern,baseline,re.S),'fortune content must remain unchanged'
assert b'</section>\n'+MONTHLY_INCLUDE in candidate,'monthly banner remains after listening'
assert b"<?php noa_home_banner('youtube');?>\n<section class=\"noa-section noa-story-entrance\"" in candidate
assert b"<?php noa_home_banner('amt');?>\n<section class=\"noa-section\" data-home-section=\"collections\"" in candidate
assert candidate.index(b"<?php noa_home_banner('amt');?>")<candidate.index(community[0]),'community must follow the AMT banner'
assert candidate.count(b'data-noa-community-home')==1,'one native per-board title projection required'
assert not re.search(rb'TOP\s*10',candidate,re.I),'removed TOP 10 labels returned'
assert len(re.findall(rb'<script src="/noa-home[.]js[?]v=[^"]+" defer></script>',candidate))==1,'reviewed metrics cache revision changed'
for marker in [b'id="noa-hero-video"',b'id="noa-hero-genre"',b'id="noa-hero-play"',b'id="noa-featured"',b'id="noa-ep"',b'id="noa-stories"',b'id="noa-covers"',b'id="noa-acts"']:
 assert candidate.count(marker)==1,'missing/duplicate HOME section '+marker.decode()
print('NOA_HOME_NON_HERO_BYTES_PRESERVED_GENRE_VIDEO_SITEMAP_AND_COMMUNITY_CONTRACT_OK')

for kind in [b'goods',b'youtube',b'amt']:
 assert candidate.count(b"<?php noa_home_banner('"+kind+b"');?>") == 1,'one partner banner per requested position'
for url in [b'https://marpple.shop/kr/jr_lifestyle',b'https://youtube.com/@ainoa_ramjunpapa?sub_confirmation=1',b'https://www.aimusictown.com/competition/2?entryId=353']:
 assert candidate.count(url)==1,'exact requested external destination'
assert b'rel="noopener noreferrer"' in candidate and b'target="_blank"' in candidate
