"""Preserve operating HOME except the guarded sitemap and exact metrics cache revision and approved TOP 10 label removal."""
import argparse
import hashlib
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[2]
BASE_SHA='bab8c6f43a1bfdefb203be5f363f65102cff0860b515cbbe8201e43701d995d2'
BASE_COMMIT='a7e34a84fae13241e157378d61c18547ae41809e'
parser=argparse.ArgumentParser()
parser.add_argument('--host-source',type=Path)
args=parser.parse_args()
candidate=(ROOT/'deploy/noa-app/home.php').read_bytes()
addition=re.findall(rb"<\?php if\(is_file\(dirname\(__DIR__\)\.'/noa-sitemap[.]php'\)\):\?>\n<section[^\n]*data-home-section=\"sitemap\"[^\n]*</section>\n<\?php endif;\?>\n",candidate)
if len(addition)!=1:
    raise AssertionError('Exactly one guarded sitemap navigation section is required')
cache_before=b'noa-home.js?v=20261022-recovery1'
cache_after=b'noa-home.js?v=20261024-popularity-metrics'
if candidate.count(cache_after)!=1 or cache_before in candidate:
    raise AssertionError('Exactly one reviewed HOME metrics script cache revision is required')
restored=candidate.replace(addition[0],b'',1).replace(cache_after,cache_before,1)
# Normalize only the four literal labels approved in PR #202; preserve the baseline hash guard.
if re.search(rb'TOP\s*10',candidate,re.I):
    raise AssertionError('Removed HOME TOP 10 labels must not return')
for current,previous in [
    ('<h2>추천 음악</h2>','<h2>추천 음악 · TOP 10</h2>'),
    ('<h2>당신의 이야기, 우리의 음악 🎧</h2>','<h2>당신의 이야기, 우리의 음악 🎧 · TOP 10</h2>'),
    ('<h2>🎤 AInoa의 유명곡 커버</h2>','<h2>🎤 AInoa의 유명곡 커버 · TOP 10</h2>'),
    ('추천 음악과 겹치지 않는 EP 시리즈.','추천 음악과 겹치지 않는 EP 시리즈 TOP 10.'),
]:
    current,previous=current.encode(),previous.encode()
    if restored.count(current)!=1:
        raise AssertionError('Expected exactly one approved HOME label')
    restored=restored.replace(current,previous,1)
if hashlib.sha256(restored).hexdigest()!=BASE_SHA:
    raise AssertionError('Existing operating HOME bytes changed outside the sitemap, metrics cache revision and approved label removal')
if args.host_source:
    baseline=args.host_source.read_bytes()
else:
    merged=subprocess.check_output(['git','show',BASE_COMMIT+':deploy/noa-app/home.php'],cwd=ROOT)
    old_section=re.findall(rb'<section class="noa-section noa-site-map" aria-labelledby="noa-site-map-heading">[^\n]*</nav></section>\n',merged)
    if len(old_section)!=1:
        raise AssertionError('Previously unshipped six-card section must be accounted for')
    baseline=merged.replace(old_section[0],b'',1)
if restored!=baseline:
    raise AssertionError('Hero, ranking, community, account or source script markup changed')
for marker in [b'id="noa-hero-video"',b'id="noa-featured"',b'id="noa-ep"',b'id="noa-stories"',b'id="noa-covers"',b'id="noa-acts"',b'data-home-section="community"']:
    if candidate.count(marker)!=1:
        raise AssertionError('Existing HOME section missing or duplicated: '+marker.decode())
print('NOA_HOME_ORIGINAL_VIDEO_RANKING_COMMUNITY_BYTES_PRESERVED_SITEMAP_METRICS_CACHE_AND_APPROVED_LABELS_ONLY')

