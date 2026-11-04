"""Send only public source leads to the Busan reporter's dedicated inbox."""
import base64
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import json
import os
import re
import urllib.parse as url
import urllib.request as http
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup

KST = dt.timezone(dt.timedelta(hours=9))
NOW = dt.datetime.now(KST)
QUERIES = [
    '"홈앤서비스" (SK OR 통신 OR 노동조합)',
    '"SK브로드밴드" OR "SK broadband"',
    '"SK텔레콤" OR "SK텔레콤 노조"',
    '"SK그룹" OR "SK그룹 노조"',
    '"노동조합" OR "단체교섭" OR "산별노조"',
    '"노동법" OR "근로기준법" OR "노동조합법"',
    '"국제노동기구" OR "해외 노동" OR "세계 노동" OR "해외 노조"',
]
BRANCH = 'busan/news-desk-inbox'
PATH = 'newsroom/inbox.json'
API = 'https://api.github.com/repos/rucyjeon79/noa-studio/contents/'+PATH
HEADERS = {'User-Agent':'BusanUnionNewsDesk/1.0 (+https://skhnslu-busan.com)'}


def fetch(address):
    with http.urlopen(http.Request(address,headers=HEADERS),timeout=14) as res:
        data=res.read(2_500_001)
    if len(data)>2_500_000:
        raise ValueError('response too large')
    return data


def row(rank, title, name, link, date):
    title=' '.join(title.split())[:280]
    if not title or not link.startswith('https://') or len(link)>1800:
        return None
    if date>NOW.date() or date<NOW.date()-dt.timedelta(days=31):
        return None
    name=' '.join(name.split())[:100]
    return {'topic':rank,'date':date.isoformat(),'title':title,'publisher':name,'url':link}


def feed(rank, address, name=''):
    root=ET.fromstring(fetch(address))
    if root.tag.rsplit('}',1)[-1] not in ('rss','RDF'):
        raise ValueError('not an RSS feed')
    items=[]
    for n in root.findall('.//item')[:80]:
        pub=n.findtext('pubDate','')
        try:
            dated=email.utils.parsedate_to_datetime(pub).astimezone(KST).date()
        except (ValueError,TypeError,AttributeError):
            try: dated=dt.date.fromisoformat(pub[:10])
            except ValueError: continue
        publisher=n.findtext('source') or name
        title=n.findtext('title','')
        if publisher and title.endswith(' - '+publisher):
            title=title[:-len(publisher)-3]
        items.append(row(rank,title,publisher,n.findtext('link',''),dated))
    return [i for i in items if i]


def skb():
    base='https://www.skbroadband.com/newsroom'
    soup=BeautifulSoup(fetch(base),'html.parser')
    result=[]
    for a in soup.select('a[href]'):
        link=url.urljoin(base,a['href'])
        if not re.fullmatch(r'https://www\.skbroadband\.com/newsroom/\d+/?',link):
            continue
        text=' '.join(a.stripped_strings)
        m=re.search(r'(20\d\d)[.-](\d\d)[.-](\d\d)',text)
        if not m: continue
        title=re.sub(r'^\s*(Press Release|NEW|보도자료)\s*','',text[:m.start()],flags=re.I).strip()
        if title: result.append(row(1 if '홈앤서비스' in title else 2,title,'SK브로드밴드 뉴스룸',link,dt.date(*map(int,m.groups()))))
    return [i for i in result if i]


def google(rank, query):
    params=url.urlencode({'q':query+' when:30d','hl':'ko','gl':'KR','ceid':'KR:ko'})
    return feed(rank,'https://news.google.com/rss/search?'+params)


def identity(item):
    title=re.sub(r'[^\w가-힣]+','',item['title']).casefold()
    return hashlib.sha256((item['publisher']+'|'+title).encode()).hexdigest()


def api(method='GET', payload=None):
    address=API+('?'+url.urlencode({'ref':BRANCH}) if method=='GET' else '')
    headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'User-Agent':'BusanNewsInbox','Accept':'application/vnd.github+json'}
    req=http.Request(address,method=method,headers=headers,data=json.dumps(payload).encode() if payload else None)
    with http.urlopen(req,timeout=20) as r:return json.load(r)


def main():
    calls=[('portal-'+str(i),google,(i,q)) for i,q in enumerate(QUERIES,1)]
    calls.extend([('SKB',skb,()),('SKT',feed,(3,'https://news.sktelecom.com/category/press-center/feed','SK텔레콤 뉴스룸')),
                  ('MOEL',feed,(6,'https://www.moel.go.kr/rss/lawinfo.do','고용노동부'))])
    fresh=[]; healthy=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        jobs={executor.submit(f,*args):key for key,f,args in calls}
        for job in concurrent.futures.as_completed(jobs):
            try:
                found=job.result();fresh.extend(found);healthy+=1
                print(jobs[job],len(found))
            except Exception as e:
                print(jobs[job],'unavailable',type(e).__name__)
    if not healthy:
        raise RuntimeError('All news sources unavailable; previous inbox kept')
    existing=api()
    previous=json.loads(base64.b64decode(existing['content']))
    old=previous.get('items',[])
    combined={}
    for item in [*old,*fresh]:
        if item['date']<(NOW.date()-dt.timedelta(days=31)).isoformat():continue
        key=identity(item)
        if key not in combined or item['topic']<combined[key]['topic']:
            combined[key]=item
    items=[]
    for rank in range(1,8):
        group=sorted((i for i in combined.values() if i['topic']==rank),key=lambda i:(i['date'],i['title'],i['url']),reverse=True)
        items.extend(group[:8])
    if items==old or not items:
        print('No new shortlist');return
    content=json.dumps({'items':items},ensure_ascii=False,indent=2)+'\n'
    api('PUT',{'message':'Busan reporter: refresh verified-source leads','branch':BRANCH,'sha':existing['sha'],'content':base64.b64encode(content.encode()).decode()})
    print('Updated editorial inbox:',len(items),'leads;',healthy,'feeds available')


if __name__=='__main__':
    main()
