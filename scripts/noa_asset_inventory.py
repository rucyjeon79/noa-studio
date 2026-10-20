"""Inventory acquired originals separately from remote references; never infer file acquisition."""
from pathlib import Path
from collections import Counter,defaultdict
import hashlib,json,mimetypes,re
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
MEDIA={'.jpg','.jpeg','.png','.svg','.webp','.mp4','.webm','.mp3','.wav','.flac','.m4a','.ogg'}
def main():
    rows=[]
    for path in sorted((ROOT/'public').rglob('*')):
        if not path.is_file():continue
        rel=path.relative_to(ROOT).as_posix();platform='/__grok/' in rel or path.suffix in {'.js','.css','.webmanifest'}
        media=path.suffix.lower() in MEDIA
        row={'source':rel,'id':hashlib.sha256(rel.encode()).hexdigest(),'bytes':path.stat().st_size,'format':mimetypes.guess_type(path.name)[0] or 'application/octet-stream','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'acquired':True,'production_path':'/noa-assets/'+path.relative_to(ROOT/'public').as_posix() if media and not platform else None,'state':'deployment_candidate' if media and not platform else 'preserved_platform_or_configuration','use':'character' if '/characters/' in rel else 'genre discovery' if '/coming/' in rel else 'background' if '/splash/' in rel or path.name=='splash-portrait.jpg' else 'brand/icon'}
        if path.suffix.lower() in {'.jpg','.png','.webp'}:
            with Image.open(path) as im:row['dimensions']=list(im.size)
        rows.append(row)
    refs=defaultdict(list);suno=Counter();squares=0
    for path in sorted((ROOT/'deploy/noastudio/noa/data/live/곡').rglob('*.json')):
        d=json.loads(path.read_text());body=d['pkg'];kind='act' if re.fullmatch(r'act-\d+',path.stem) else 'song'
        if body.get('sunoUrl'):suno[kind]+=1
        for key in ('thumbUrl','coverImageUrl','audioUrl','mvUrl'):
            url=body.get(key)
            if isinstance(url,str) and url.strip():refs[(key,url)].append(path.relative_to(ROOT).as_posix())
    remote=[]
    for (field,url),sources in sorted(refs.items()):
        remote.append({'field':field,'url':url,'id':hashlib.sha256(url.encode()).hexdigest(),'source_records':sources,'acquired':False,'bytes':None,'sha256':None,'format':None,'state':'reference_only','note':'Sample original image request returned HTTP 403; remaining URLs not acquired. No authentication bypass.' if field=='thumbUrl' else 'No local original verified.'})
    report={'scope':'Accessible Git source public assets and canonical 653 music JSON documents. Does not assert all remote Grok storage, damaged SQL-only data or transient /tmp caches were acquired.','local_files':len(rows),'local_bytes':sum(x['bytes'] for x in rows),'media_migration_candidates':sum(bool(x['production_path']) for x in rows),'remote_media_references':len(remote),'suno_source_records':dict(suno),'suno_specific_original_square_covers_acquired':squares,'verified_original_audio_files':0,'local':rows,'remote':remote}
    (ROOT/'docs/noa-2/23-asset-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('local','remote')},ensure_ascii=False))
if __name__=='__main__':main()
