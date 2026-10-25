"""Preserve all non-hero HOME bytes while allowing the approved genre/video card.
The existing 18-layout real browser check owns geometry and full playback.
"""
import argparse,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE_COMMIT='56e588694be288e127aded0ea42179e37d50d12c'
parser=argparse.ArgumentParser();parser.add_argument('--host-source',type=Path);args=parser.parse_args()
candidate=(ROOT/'deploy/noa-app/home.php').read_bytes()
baseline=args.host_source.read_bytes()if args.host_source else subprocess.check_output(['git','show',BASE_COMMIT+':deploy/noa-app/home.php'],cwd=ROOT)
def outside_approved_hero(source):
 for pattern in [rb'<style id="noa-home-action-layout">.*?</style>',rb'<section class="noa-hero".*?</section>',rb'<script id="noa-home-hero-size">.*?</script>']:
  source,count=re.subn(pattern,b'',source,flags=re.S)
  assert count==1,'one approved hero scope required'
 source=re.sub(rb'/noa-hero[.]js[?]v=[^"\s]+',b'/noa-hero.js?v=APPROVED_RUNTIME',source)
 return source
assert outside_approved_hero(candidate)==outside_approved_hero(baseline),'non-hero HOME source changed'
hero_start=candidate.index(b'<section class="noa-hero"');hero_end=candidate.index(b'</section>',hero_start)
addition=re.findall(rb"<\?php if\(is_file\(dirname\(__DIR__\)\.'/noa-sitemap[.]php'\)\):\?><nav[^\n]*data-home-section=\"sitemap\"[^\n]*</nav><\?php endif;\?>",candidate)
assert len(addition)==1 and hero_start<candidate.index(addition[0])<hero_end,'guarded sitemap must remain inside hero'
community=re.findall(rb'<section class="noa-section" data-home-section="community">[^\n]*</section>\n',candidate)
assert len(community)==1 and candidate[hero_end+len(b'</section>'):].startswith(b'\n'+community[0]),'community must immediately follow hero'
assert not re.search(rb'TOP\s*10',candidate,re.I),'removed TOP 10 labels returned'
assert candidate.count(b'noa-home.js?v=20261024-popularity-metrics')==1,'reviewed metrics cache revision changed'
for marker in [b'id="noa-hero-video"',b'id="noa-hero-genre"',b'id="noa-hero-play"',b'id="noa-featured"',b'id="noa-ep"',b'id="noa-stories"',b'id="noa-covers"',b'id="noa-acts"']:
 assert candidate.count(marker)==1,'missing/duplicate HOME section '+marker.decode()
print('NOA_HOME_NON_HERO_BYTES_PRESERVED_GENRE_VIDEO_SITEMAP_AND_COMMUNITY_CONTRACT_OK')
