"""Summarize the preserved canonical Grok music snapshot; never edits a source file."""
from pathlib import Path
from collections import Counter,defaultdict
import hashlib,json,re,urllib.parse
root=Path('deploy/noastudio/noa/data/live/곡')
counts=Counter();genres=defaultdict(Counter);fields=Counter();acts=[];videos=defaultdict(list);labels=[];source_hash=hashlib.sha256()
for path in sorted(root.rglob('*.json')):
    raw=path.read_bytes();source_hash.update(str(path.relative_to(root)).encode());source_hash.update(raw)
    d=json.loads(raw);b=d['pkg'];g=path.relative_to(root).parts[0]
    kind='playlist' if re.fullmatch(r'act-[0-9]+',path.stem) else 'song'
    counts[kind]+=1;genres[g][kind]+=1
    if kind=='song':
        for key in ['confirmedTitle','lyricsBlock','sunoUrl','youtubeUrl','mvUrl','thumbUrl','audioUrl']:
            fields[key]+=bool(b.get(key))
    else:
        refs=re.findall(r'^\s*EP[.\s]*([0-9]+)\b',b.get('tracklist',''),re.M)
        acts.append({'genre':g,'act':d.get('act'),'tracks':len(refs),'episodes':refs})
        title=b.get('confirmedTitle') or d.get('title','')
        expected={'kpop-original':'K-POP','jpop-original':'J-POP','thai-original':'THAI'}.get(g)
        if expected and re.search(r'\b(?:K-POP|J-POP|THAI)\b',title,re.I) and not re.search(re.escape(expected),title,re.I):labels.append({'genre':g,'act':d.get('act')})
    url=b.get('youtubeUrl','');p=urllib.parse.urlparse(url);video=p.path.strip('/') if p.hostname=='youtu.be' else urllib.parse.parse_qs(p.query).get('v',[''])[0]
    if re.fullmatch(r'[A-Za-z0-9_-]{11}',video):videos[video].append({'genre':g,'kind':kind,'ep':d.get('ep'),'act':d.get('act')})
report={'canonical_documents':sum(counts.values()),'unique_song_records':counts['song'],'act_documents':counts['playlist'],'source_sha256':source_hash.hexdigest(),'genres':dict(genres),'song_field_presence':dict(fields),'act_tracks':acts,'shared_video_ids':len([v for v in videos.values() if len(v)>1]),'suspected_act_title_genre_mismatches':labels,'scope':'Accessible canonical JSON snapshot; damaged PostgreSQL-only records remain unverified and preserved.'}
print(json.dumps(report,ensure_ascii=False,separators=(',',':')))
