"""Read public HOME API/static script and top destinations; no SSH or SQL.
This observes current public health independently of synthetic candidate fixtures.
It does not claim that candidate source rows are the current production snapshot.
"""
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ORIGIN='https://noastudio.ai.kr'

class SameSiteRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,msg,headers,newurl):
        if urllib.parse.urlparse(newurl).netloc!='noastudio.ai.kr' or not newurl.startswith(ORIGIN+'/'):
            raise RuntimeError('public_redirect_outside_site')
        return super().redirect_request(request,fp,code,msg,headers,newurl)

OPENER=urllib.request.build_opener(SameSiteRedirect())

def read(path,limit=2_000_000):
    url=urllib.parse.urljoin(ORIGIN,path)
    if urllib.parse.urlparse(url).netloc!='noastudio.ai.kr' or not url.startswith(ORIGIN+'/'):
        raise RuntimeError('public_url_outside_site')
    with OPENER.open(url,timeout=45) as response:
        if urllib.parse.urlparse(response.url).netloc!='noastudio.ai.kr':
            raise RuntimeError('public_redirect_outside_site')
        raw=response.read(limit+1)
        if len(raw)>limit:
            raise RuntimeError('public_response_too_large')
        return raw,response.headers.get('Content-Type',''),response.status

live=json.loads(read('/noa-bridge/home.php')[0])
if live.get('ok') is not True or not live.get('runId'):
    raise RuntimeError('public_home_api_unavailable')
checks=[]
for section in ['stories','covers','playlists']:
    rows=live.get(section)
    if not isinstance(rows,list) or not rows:
        raise RuntimeError('public_home_empty_'+section)
    row=rows[0]
    image,mime,status=read(row['thumbnail'])
    if status!=200 or not mime.startswith('image/') or not image:
        raise RuntimeError('public_home_thumbnail_'+section)
    body,_,status=read(row['href'],8_000_000)
    if status!=200 or not body:
        raise RuntimeError('public_home_destination_'+section)
    checks.append({'section':section,'count':len(rows),'videoId':row.get('videoId'),'thumbnailHttp':200,'destinationHttp':200})
script=read('/noa-home.js',1_000_000)[0]
report={'environment':'public read-only API observation; not a SQL backup or restore','runId':live['runId'],'sameCollectionAsCandidate':False,'checks':checks,'publicHomeScriptSha256':hashlib.sha256(script).hexdigest(),'candidateHomeScriptSha256':hashlib.sha256(Path('deploy/noa-home.js').read_bytes()).hexdigest(),'productionDatabaseAccess':False}
Path('quality-home').mkdir(mode=0o700,exist_ok=True)
Path('quality-home/public-api.json').write_text(json.dumps(live,ensure_ascii=False,indent=2))
Path('quality-home/public-observation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('NOA_HOME_PUBLIC_OBSERVATION '+json.dumps(report,ensure_ascii=False))
