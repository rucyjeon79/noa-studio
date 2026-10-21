"""Suno public metadata/cover acquisition; explicit authorized local audio only.
No private APIs, audio URL guessing, streaming extraction, or persistent WAV.
"""
import argparse, concurrent.futures, hashlib, html, io, json, math, os, re
import shutil, subprocess, tempfile, time, urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image

MAX_IMAGE = 20 * 1024 * 1024
MAX_AUDIO = 160 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()


def component(value):
    value = re.sub(r'[\x00-\x1f\x7f/\\:*?"<>|]', '_', str(value)).strip()
    value = value.rstrip('.')
    if value in ('', '.', '..'): value = '_'
    if len(value.encode()) > 180:
        raise ValueError('filesystem_component_too_long')
    return value


def folder(row):
    genre = row.get('genre', 'unclassified')
    title = row['title']
    ep = str(row.get('ep') or '')
    base = {'kpop-original': 'K-POP', 'jpop-original': 'J-POP',
            'pop-original': 'POP', 'thai-original': 'Thai'}
    if genre == 'cover-reborn':
        artist = row.get('originalArtist')
        if not artist: raise ValueError('cover_original_artist_required')
        return Path('커버곡') / component(title + ' - ' + artist)
    if genre == 'your-story': return Path('사연곡') / component(title)
    name = ('EP.' + ep.zfill(2) + ' ' if ep else '') + title
    if genre in base: return Path(base[genre]) / component(name)
    return Path('컬렉션') / component(genre) / component(name)


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta = {}; self.canonical = ''
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta': self.meta[a.get('property', a.get('name', ''))] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href', '')


def allowed(url, page=False):
    u = urllib.parse.urlsplit(url)
    hosts = {'suno.com', 'www.suno.com', 'suno.ai', 'www.suno.ai'}
    if not page: hosts |= {'cdn1.suno.ai', 'cdn2.suno.ai', 'cdn.suno.ai'}
    if u.scheme != 'https' or u.hostname not in hosts or u.username or u.password or u.port:
        raise ValueError('provider_url_not_allowed')
    return url


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        allowed(newurl, getattr(req, 'noa_page', False))
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if result: result.noa_page = getattr(req, 'noa_page', False)
        return result


def fetch(url, limit, page=False):
    allowed(url, page)
    req = urllib.request.Request(url, headers={'User-Agent': 'NOA-STUDIO-Public-Metadata/1.0'})
    req.noa_page = page
    with urllib.request.build_opener(Redirect()).open(req, timeout=20) as r:
        allowed(r.geturl(), page)
        if int(r.headers.get('Content-Length', 0)) > limit: raise ValueError('source_too_large')
        data = r.read(limit + 1)
        if len(data) > limit: raise ValueError('source_too_large')
        return data, r.geturl()


def metadata(url):
    raw, final = fetch(url, 3 * 1024 * 1024, True)
    p = Metadata(); p.feed(raw.decode('utf-8'))
    sid = re.search(r'/song/([a-f0-9-]{36})(?:[/?]|$)', final)
    if not sid: sid = re.search(r'/song/([a-f0-9-]{36})(?:[/?]|$)', p.canonical)
    title = p.meta.get('og:title', '').strip()
    if not sid or not title: raise ValueError('public_song_metadata_missing')
    image = p.meta.get('og:image', '')
    if image: allowed(image)
    return {'suno_id': sid[1], 'suno_title': title, 'resolved_url': final, 'image_url': image}


def cover(path, url):
    if path.exists():
        with Image.open(path) as img:
            if img.format != 'WEBP': raise ValueError('existing_cover_not_webp')
            img.load(); size = img.size
    else:
        if not url: raise ValueError('source_card_missing')
        raw, _ = fetch(url, MAX_IMAGE)
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            if min(img.size) < 32: raise ValueError('invalid_card_dimensions')
            size = img.size
            path.parent.mkdir(parents=True, exist_ok=True)
            temp = path.with_name('.cover-' + os.urandom(6).hex() + '.tmp')
            try:
                img.convert('RGB').save(temp, 'WEBP', quality=92, method=6)
                with Image.open(temp) as checked: checked.load()
                os.replace(temp, path)
            finally: temp.unlink(missing_ok=True)
    return {'cover_path': path.as_posix(), 'cover_bytes': path.stat().st_size,
            'cover_sha256': digest(path), 'cover_dimensions': size}


def run(args):
    p = subprocess.run(args, capture_output=True, text=True, timeout=300)
    if p.returncode: raise ValueError('media_command_failed:' + p.stderr[-300:])
    return p


def analyze(path):
    p = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]).stdout)
    a = next((s for s in p['streams'] if s['codec_type'] == 'audio'), None)
    if not a: raise ValueError('no_audio_stream')
    # Decode the complete track. No generated PCM/WAV file is written.
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-map', '0:a:0', '-f', 'null', '-'])
    v = run(['ffmpeg', '-nostdin', '-hide_banner', '-i', str(path), '-map', '0:a:0',
             '-af', 'loudnorm=I=-14:TP=-1:LRA=50:print_format=json', '-f', 'null', '-']).stderr
    m = re.findall(r'\{\s*"input_i".*?\}', v, re.S)
    if not m: raise ValueError('loudness_measurement_missing')
    loud = json.loads(m[-1])
    def number(k):
        n = float(loud[k]); return n if math.isfinite(n) else None
    peak = number('input_tp')
    return {'duration': float(p['format']['duration']), 'codec': a['codec_name'],
            'bitrate': int(a.get('bit_rate', p['format'].get('bit_rate', 0))),
            'sample_rate': int(a['sample_rate']), 'channels': int(a['channels']),
            'lufs': number('input_i'), 'lra': number('input_lra'), 'true_peak': peak,
            'clipping': peak is not None and peak >= 0, 'decode_errors': False}


def optimize(source, destination):
    before = analyze(source)
    if before['lufs'] is None or before['true_peak'] is None: raise ValueError('silent_or_unmeasurable_audio')
    # Constant gain preserves dynamics. Peak headroom overrides loudness target.
    gain = min(-14 - before['lufs'], -1.2 - before['true_peak'])
    if before['codec'] == 'mp3' and before['channels'] == 2 and abs(gain) <= .25 and before['true_peak'] <= -1:
        shutil.copyfile(source, destination)
        settings = {'mode': 'copy', 'applied_gain': 0, 'target_lufs': -14, 'target_peak': -1}
    else:
        sample_rate = before['sample_rate']
        # MP3 supports only these rates; report necessary conversion explicitly.
        supported = (8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000)
        if sample_rate not in supported: sample_rate = min(supported, key=lambda x: abs(x - sample_rate))
        settings = {'mode': 'encode', 'applied_gain': gain, 'target_lufs': -14,
                    'target_peak': -1, 'bitrate': 320000, 'sample_rate': sample_rate,
                    'filter': 'volume=' + str(gain) + 'dB'}
        run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source), '-map', '0:a:0',
             '-map_metadata', '-1', '-af', settings['filter'], '-ac', '2', '-ar', str(sample_rate),
             '-c:a', 'libmp3lame', '-b:a', '320k', '-f', 'mp3', '-y', str(destination)])
    after = analyze(destination)
    if after['codec'] != 'mp3' or after['channels'] != 2 or after['true_peak'] is None or after['true_peak'] > -1:
        destination.unlink(missing_ok=True); raise ValueError('encoded_audio_failed_peak_or_format_validation')
    return before, settings, after


def process(row, root, ownership, sources):
    result = {'song_key': row['key'], 'source_url': row['sunoUrl'], 'genre': row['genre'],
              'ep': row.get('ep', ''), 'title': row['title'], 'status': 'audio_pending', 'errors': []}
    try:
        meta = metadata(row['sunoUrl']); result.update(meta)
        directory = root / ownership[row['key']]
        try:
            info = cover(directory / 'cover.webp', meta['image_url'])
            info['cover_path'] = (directory / 'cover.webp').relative_to(root).as_posix()
            result.update(info)
        except Exception as e: result['errors'].append('cover:' + str(e))
        # Only user-owned local downloads with explicit provenance may be processed.
        source = sources.get(row['key'])
        if not source:
            result['errors'].append('audio:authorized_download_or_owned_file_required')
        else:
            if source.get('authorization') != 'user_owned_download': raise ValueError('audio_authorization_missing')
            local = Path(source['path']).resolve()
            if not local.is_file() or local.stat().st_size > MAX_AUDIO: raise ValueError('audio_source_missing_or_oversize')
            if source.get('suno_id') != meta['suno_id']: raise ValueError('audio_source_identity_mismatch')
            if shutil.disk_usage(root).free < MAX_AUDIO * 3: raise ValueError('temporary_space_insufficient')
            directory.mkdir(parents=True, exist_ok=True)
            target = directory / (component(meta['suno_title']) + '.mp3')
            if target.exists(): raise ValueError('existing_audio_preserved_requires_verified_reuse')
            with tempfile.TemporaryDirectory(prefix='noa-mp3-') as tmp:
                out = Path(tmp) / 'stream.mp3'
                before, settings, after = optimize(local, out)
                stage = directory / ('.mp3-' + os.urandom(6).hex())
                try:
                    shutil.copyfile(out, stage); os.replace(stage, target)
                finally: stage.unlink(missing_ok=True)
            result.update(status='ready', audio_path=target.relative_to(root).as_posix(),
                          audio_sha256=digest(target), audio_bytes=target.stat().st_size,
                          source_analysis=before, correction=settings, final_analysis=after)
    except Exception as e:
        result['errors'].append(str(e))
    result['verified_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    return result


def main():
    p = argparse.ArgumentParser(); p.add_argument('--catalog', required=True); p.add_argument('--root', required=True)
    p.add_argument('--report', required=True); p.add_argument('--sources'); p.add_argument('--limit', type=int, default=0)
    p.add_argument('--offset', type=int, default=0); p.add_argument('--workers', type=int, default=2); args = p.parse_args()
    data = json.loads(Path(args.catalog).read_text()); rows = [r for r in data['items'] if r.get('sunoUrl')]
    root = Path(args.root); root.mkdir(parents=True, exist_ok=True)
    ownership = {}; collisions = {}
    for row in rows:
        try: name = folder(row).as_posix()
        except ValueError: name = None
        if name: collisions.setdefault(name.casefold(), []).append(row['key']); ownership[row['key']] = name
    for keys in collisions.values():
        if len(keys) > 1:
            for key in keys: ownership[key] += ' [v-' + hashlib.sha256(key.encode()).hexdigest()[:12] + ']'
    sources = json.loads(Path(args.sources).read_text()) if args.sources else {}
    selected = rows[args.offset:args.offset+args.limit] if args.limit else rows[args.offset:]
    results = []; report = Path(args.report); report.parent.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, max(1, args.workers))) as pool:
        futures = {}
        for row in selected:
            if row['key'] not in ownership:
                results.append({'song_key': row['key'], 'source_url': row['sunoUrl'], 'status': 'audio_pending', 'errors': ['cover_original_artist_required_or_invalid_path']})
            else: futures[pool.submit(process, row, root, ownership, sources)] = row
        for future in concurrent.futures.as_completed(futures):
            result = future.result(); results.append(result)
            with report.open('w') as out: json.dump({'total_suno_urls': len(rows), 'processed': len(results), 'results': results}, out, ensure_ascii=False, indent=2)
            print(json.dumps({'processed': len(results), 'covers': sum(bool(r.get('cover_path')) for r in results),
                              'mp3': sum(r['status'] == 'ready' for r in results)}, ensure_ascii=False), flush=True)
    report.write_text(json.dumps({'total_suno_urls': len(rows), 'unique_suno_urls': len({r['sunoUrl'] for r in rows}),
                                 'processed': len(results), 'results': results}, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
