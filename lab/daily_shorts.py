"""Read-only candidate research and measured MP3 preparation for N80 Auto.

No model/API spending, movie approval, public posting or synthetic vocal timing.
The hosting owns the lease, source identity and result; this module owns no clock.
"""
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import math
from pathlib import Path, PurePosixPath
import re
import stat
import tempfile


def seconds(value):
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", value or "")
    return sum(float(n or 0) * scale for n, scale in zip(m.groups(), (3600, 60, 1))) if m else 0


def full_song(video):
    if video.get('status', {}).get('privacyStatus') != 'public':
        return False
    snippet = video.get('snippet', {})
    if snippet.get('liveBroadcastContent', 'none') != 'none' or re.search(r'#shorts\b|쇼츠', snippet.get('title', ''), re.I):
        return False
    duration = seconds(video.get('contentDetails', {}).get('duration'))
    if not 59 <= duration <= 1800:
        return False
    if duration > 180:
        return True
    # Short videos without owner-provided aspect evidence remain ambiguous.
    streams = video.get('fileDetails', {}).get('videoStreams', [])
    return len(streams) == 1 and streams[0].get('widthPixels', 0) > streams[0].get('heightPixels', 0) > 0


def pages(call, resource, **query):
    items, seen, token = [], set(), ''
    for _ in range(100):
        data = call('youtube', resource=resource, pageToken=token, **query)['data']
        items.extend(data.get('items', []))
        token = data.get('nextPageToken', '')
        if not token:
            return items
        if token in seen:
            raise ValueError('youtube_pagination_loop')
        seen.add(token)
    raise ValueError('youtube_page_limit')


def rank_candidates(catalog, videos, members, policy, prior_ids=(), now=None):
    now = now or datetime.now(timezone.utc)
    excluded = set(prior_ids)
    for pid in policy['excludedPlaylistIds']:
        excluded.update(members.get(pid, []))
    owners = defaultdict(list)
    for row in catalog:
        owners[row['canonicalVideo']].append(row)
    out = []
    for video in videos:
        vid = video['id']
        if vid in excluded or len(owners[vid]) != 1 or video.get('snippet', {}).get('channelId') != policy['channelId'] or not full_song(video):
            continue
        row = owners[vid][0]
        if row['genre'] == 'kpop-original':
            continue
        playlists = [pid for pid, genre in policy['genrePlaylistIds'].items() if genre == row['genre'] and vid in members.get(pid, [])]
        if not playlists:
            continue
        stats = video.get('statistics', {})
        views, likes, comments = (max(0, int(stats.get(k, 0))) for k in ('viewCount', 'likeCount', 'commentCount'))
        published = datetime.fromisoformat(video['snippet']['publishedAt'].replace('Z', '+00:00'))
        if published > now:
            continue
        days = max(1, (now - published).total_seconds() / 86400)
        # Exposure-adjusted, smoothed engagement. Low views alone are not a positive signal.
        engagement = min(1, (likes + 2 * comments) / (views + 30))
        confidence = views / (views + 100)
        score = .65 * engagement + .20 * confidence + .15 * min(1, math.log1p(views / days) / 6)
        out.append({'trackKey': row['key'], 'title': row['title'], 'genre': row['genre'], 'ep': row.get('ep', ''),
                    'videoId': vid, 'playlistIds': playlists, 'statistics': {'views': views, 'likes': likes, 'comments': comments, 'ageDays': round(days, 2)},
                    'engagementScore': round(score, 6), 'recentAnalytics': None, 'analyticsAvailability': 'not_requested'})
    return sorted(out, key=lambda r: (-r['engagementScore'], r['videoId']))


def source_download(sftp, source, target):
    remote = source['audioPath']
    roots = ('/hosting/noastudio/noa-jukebox-private/media/', '/hosting/noastudio/html/noa-jukebox/')
    if not isinstance(remote, str) or not remote.startswith(roots) or str(PurePosixPath(remote)) != remote or '..' in PurePosixPath(remote).parts or sftp.normalize(remote) != remote:
        raise ValueError('source_path_rejected')
    meta = sftp.lstat(remote)
    if not stat.S_ISREG(meta.st_mode) or not 1 <= meta.st_size <= 150 * 1048576:
        raise ValueError('source_file_rejected')
    digest, count = hashlib.sha256(), 0
    with sftp.open(remote, 'rb') as src, open(target, 'wb') as dst:
        while chunk := src.read(1048576):
            count += len(chunk)
            if count > meta.st_size:
                raise ValueError('source_size_changed')
            digest.update(chunk)
            dst.write(chunk)
    if count != meta.st_size or digest.hexdigest() != source['audioSha256']:
        raise ValueError('source_checksum_mismatch')


def prepare(call, policy, sftp, analyzer):
    catalog = call('catalog')['items']
    playlists = pages(call, 'playlists')
    live = {p['id']: p for p in playlists if p.get('snippet', {}).get('channelId') == policy['channelId']}
    destination = live.get(policy['destinationPlaylistId'])
    if not destination or destination['snippet']['title'] != policy['destinationPlaylistTitle']:
        raise ValueError('destination_playlist_mismatch')
    if policy['excludedPlaylistIds'][0] not in live:
        raise ValueError('original_exclusion_playlist_missing')
    shorts_lists = {p['id'] for p in live.values() if re.search(r'shorts|쇼츠', p['snippet']['title'], re.I)}
    excluded = set(policy['excludedPlaylistIds']) | shorts_lists
    genre_ids = {pid: p['n80Genre'] for pid, p in live.items() if p.get('n80Genre')}
    genre_ids.update({pid: genre for pid, genre in policy['genrePlaylistIds'].items() if pid in live})
    active_policy = {**policy, 'excludedPlaylistIds': sorted(excluded),
                     'genrePlaylistIds': {pid: genre for pid, genre in genre_ids.items() if pid not in excluded}}
    members = {}
    for pid in sorted(set(active_policy['genrePlaylistIds']) | excluded):
        if pid not in live:
            raise ValueError('exclusion_playlist_missing')
        rows = pages(call, 'playlistItems', playlistId=pid)
        members[pid] = {r['contentDetails']['videoId'] for r in rows if r.get('contentDetails', {}).get('videoId')}
    all_ids = sorted(set().union(*members.values()))
    if len(all_ids) > 3000:
        raise ValueError('channel_video_limit')
    videos = []
    for offset in range(0, len(all_ids), 50):
        videos.extend(call('youtube', resource='videos', ids=all_ids[offset:offset+50])['data'].get('items', []))
    prior = set()
    for video in videos:
        if video['id'] in members[policy['destinationPlaylistId']]:
            prior.update(re.findall(r'(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})', video.get('snippet', {}).get('description', '')))
    ranked = rank_candidates(catalog, videos, members, active_policy, prior)
    if len(ranked) < 3:
        raise ValueError('three_eligible_sources_required')
    # Recent analytics are optional evidence; missing data stays missing, never fabricated as zero.
    try:
        data = call('youtube', resource='analytics', ids=[r['videoId'] for r in ranked[:50]])['data']
        columns = [c['name'] for c in data['columnHeaders']]
        metrics = {r[0]: dict(zip(columns, r)) for r in data.get('rows', [])}
        for row in ranked[:50]:
            row['recentAnalytics'] = metrics.get(row['videoId'])
            row['analyticsAvailability'] = 'available' if row['recentAnalytics'] else 'no_rows'
            m = row['recentAnalytics'] or {}
            if m.get('views', 0) >= 20:
                row['engagementScore'] = round(row['engagementScore'] + .15 * min(1, m.get('averageViewPercentage', 0) / 100), 6)
        ranked.sort(key=lambda r: (-r['engagementScore'], r['videoId']))
    except Exception:
        for row in ranked[:50]:
            row['analyticsAvailability'] = 'unavailable'
    analyzed, skipped = [], []
    with tempfile.TemporaryDirectory(prefix='n80-shorts-') as folder:
        for row in ranked[:10]:
            if len(analyzed) == 3:
                break
            try:
                source = call('source', trackKey=row['trackKey'], videoId=row['videoId'])['source']
                local = Path(folder) / 'source.mp3'
                source_download(sftp, source, local)
                measured = analyzer(local, source['lyrics'], lengths=[49, 55, 59])
                if abs(measured['duration'] - source['duration']) > .25:
                    raise ValueError('source_duration_mismatch')
                row.update(sourceRevision=source['revision'], audioSha256=source['audioSha256'], audioAnalysis=measured)
                analyzed.append(row)
            except Exception as error:
                reason = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z_]{1,100}', str(error)) else 'source_analysis_unavailable'
                skipped.append({'trackKey': row['trackKey'], 'reason': reason})
            finally:
                (Path(folder) / 'source.mp3').unlink(missing_ok=True)
    if len(analyzed) != 3:
        raise ValueError('three_measured_sources_required')
    return {'checkedAt': datetime.now(timezone.utc).isoformat(), 'candidateCount': len(ranked), 'genrePlaylistCount': len(active_policy['genrePlaylistIds']),
            'sourceMethod': 'registered_track_key_and_exact_public_video', 'rankingMethod': 'smoothed_engagement_and_optional_recent_retention',
            'candidates': analyzed, 'skipped': skipped,
            'unavailableConfiguredPlaylists': sorted(set(policy['genrePlaylistIds']) - set(live)),
            'priorSourceEvidence': 'description_links_only_native_related_video_check_still_required',
            'notes': ['후보 점수는 역주행 확률이나 예상 조회수가 아닙니다.', '실제 MP3 해시와 길이를 확인하고 구간별 에너지·리듬을 측정했습니다.',
                      '보컬 시점·한글 자막·영상 검수·관련 동영상 연결은 별도 실행 및 검증이 필요합니다.']}
