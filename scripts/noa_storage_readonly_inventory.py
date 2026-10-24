"""Metadata-only inventory: one pinned SSH transport, independently owned SFTP channels."""
import base64
from collections import defaultdict, deque
from datetime import datetime, timezone
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import queue
import stat
import threading
import time

ROOT = '/hosting/noastudio'
MAX_DIRECTORIES = 100000
MAX_ENTRIES_PER_DIRECTORY = 100000


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def empty_report():
    return {'files': 0, 'candidate_files': [], 'subfolders_by_bytes': [],
            'folders_by_bytes': [], 'candidates': {}, 'unreadable_folders': 0}


def scan_metadata(clients, requested_channels=None, initial_errors=None, budget_seconds=720):
    """Each worker exclusively owns one client. Only the coordinator queues children.

    No file open/get/read is used. Canonical directories are checked before listing;
    symlink entries and special files are excluded. As with SFTP directory metadata
    generally, this is a dated observation rather than an atomic filesystem snapshot.
    """
    started, clock = utc_now(), time.monotonic()
    deadline = clock + budget_seconds
    errors = list(initial_errors or [])
    if not 1 <= len(clients) <= 4:
        return empty_report() | {'scanComplete':False,'errors':[{'folder':'','code':'invalid_channel_count'}],
            'startedAt':started,'finishedAt':utc_now(),'elapsedSeconds':0,
            'channelsRequested':requested_channels or len(clients),'channelsUsed':0,
            'directoriesListed':0,'symlinksSkipped':0,'nonregularSkipped':0,'channelFallbackUsed':False}
    totals = defaultdict(lambda: [0, 0]); subfolders = defaultdict(lambda: [0, 0])
    suspects = defaultdict(lambda: [0, 0]); candidates = []
    seen = skipped_links = skipped_special = unreadable = directories = 0
    ready = []
    for index, client in enumerate(clients):
        try:
            info = client.lstat(ROOT)
            if client.normalize(ROOT) != ROOT or not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
                raise ValueError('noncanonical_root')
            ready.append(client)
        except Exception:
            errors.append({'folder': '', 'code': 'root_verification_failed', 'channel': index})
    if not ready:
        report = empty_report()
        report.update({'scanComplete': False, 'errors': errors or [{'folder': '', 'code': 'no_sftp_channel'}],
                       'startedAt': started, 'finishedAt': utc_now(), 'elapsedSeconds': round(time.monotonic()-clock, 3),
                       'channelsRequested': requested_channels or len(clients), 'channelsUsed': 0,
                       'directoriesListed': 0, 'symlinksSkipped': 0, 'nonregularSkipped': 0})
        return report
    work = queue.Queue(maxsize=2*len(ready))
    results = queue.Queue(maxsize=2*len(ready))
    stopping = threading.Event()

    def worker(client):
        while True:
            folder = work.get()
            if folder is None:
                work.task_done(); return
            entries = []; failure = None
            try:
                if time.monotonic() >= deadline:
                    failure = 'scan_deadline_reached'
                elif client.normalize(folder) != folder:
                    failure = 'noncanonical_directory'
                else:
                    # listdir_iter pipelines metadata reads without downloading files.
                    iterator = (client.listdir_iter(folder, read_aheads=16)
                                if hasattr(client, 'listdir_iter') else iter(client.listdir_attr(folder)))
                    for entry in iterator:
                        if stopping.is_set() or time.monotonic() >= deadline:
                            failure = 'scan_deadline_reached'; break
                        if len(entries) >= MAX_ENTRIES_PER_DIRECTORY:
                            failure = 'directory_entry_limit'; break
                        entries.append(entry)
            except Exception:
                failure = 'directory_metadata_unavailable'
            finally:
                while not stopping.is_set():
                    try:
                        results.put((folder, entries, failure), timeout=.25); break
                    except queue.Full:
                        continue
                work.task_done()

    workers = [threading.Thread(target=worker, args=(client,), daemon=True) for client in ready]
    for thread in workers: thread.start()
    pending = deque([ROOT]); enqueued = {ROOT}; outstanding = 0; deadline_reported = False
    try:
        while pending or outstanding:
            if time.monotonic() >= deadline and not deadline_reported:
                errors.append({'folder': '', 'code': 'scan_deadline_reached'})
                pending.clear(); deadline_reported = True
            while pending and not work.full():
                work.put_nowait(pending.popleft()); outstanding += 1
            if not outstanding: break
            try:
                folder, entries, failure = results.get(timeout=.25)
            except queue.Empty:
                continue
            outstanding -= 1
            if failure:
                errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': failure})
                unreadable += 1
            else:
                directories += 1
            for entry in entries:
                name = getattr(entry, 'filename', None)
                if (not isinstance(name, str) or name in ('', '.', '..') or '/' in name or '\\' in name or '\0' in name):
                    errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': 'unsafe_entry_name'}); continue
                path = folder + '/' + name; mode = getattr(entry, 'st_mode', None)
                if type(mode) is not int:
                    errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': 'missing_entry_type'}); continue
                if stat.S_ISLNK(mode):
                    skipped_links += 1; continue
                if stat.S_ISDIR(mode):
                    if deadline_reported: continue
                    if len(enqueued) >= MAX_DIRECTORIES:
                        errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': 'directory_limit'}); continue
                    if path not in enqueued: enqueued.add(path); pending.append(path)
                    else: errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': 'duplicate_directory'})
                elif stat.S_ISREG(mode):
                    size = getattr(entry, 'st_size', None)
                    if type(size) is not int or size < 0:
                        errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': 'invalid_entry_size'}); continue
                    seen += 1; relative = path[len(ROOT)+1:]; top = relative.split('/')[0]
                    totals[top][0] += size; totals[top][1] += 1
                    group = '/'.join(relative.split('/')[:3]); subfolders[group][0] += size; subfolders[group][1] += 1
                    lower = name.lower()
                    category = ('deploy_backup' if 'noa-deploy-backups/' in relative else
                                'staged' if '.stage-' in lower or '.upload.' in lower or lower.endswith('.tmp') else
                                'synthetic_candidate' if any(x in lower for x in ('synthetic','test-tone','sine-wave','qa-tone')) else None)
                    if category:
                        modified = getattr(entry, 'st_mtime', None)
                        if type(modified) not in (int, float) or not math.isfinite(modified):
                            errors.append({'folder': folder[len(ROOT):].lstrip('/'), 'code': 'invalid_candidate_mtime'}); continue
                        suspects[category][0] += size; suspects[category][1] += 1
                        candidates.append({'path': relative, 'bytes': size, 'mtime': modified, 'category': category})
                else:
                    skipped_special += 1
    except Exception:
        errors.append({'folder': '', 'code': 'inventory_processing_failed'})
    finally:
        stopping.set()
        while True:
            try: work.get_nowait(); work.task_done()
            except queue.Empty: break
        for _ in workers: work.put(None)
        for thread in workers: thread.join()
    report = {'files': seen, 'candidate_files': sorted(candidates, key=lambda x: (-x['bytes'], x['path'])),
              'subfolders_by_bytes': sorted(({'folder': k, 'bytes': v[0], 'files': v[1]} for k, v in subfolders.items()), key=lambda x: (-x['bytes'], x['folder'])),
              'folders_by_bytes': sorted(({'folder': k, 'bytes': v[0], 'files': v[1]} for k, v in totals.items()), key=lambda x: (-x['bytes'], x['folder'])),
              'candidates': dict(sorted(suspects.items())), 'unreadable_folders': unreadable,
              'scanComplete': not errors, 'errors': sorted(errors, key=lambda x: (x.get('folder', ''), x['code'])),
              'startedAt': started, 'finishedAt': utc_now(), 'elapsedSeconds': round(time.monotonic()-clock, 3),
              'channelsRequested': requested_channels or len(clients), 'channelsUsed': len(ready),
              'channelFallbackUsed': (requested_channels or len(clients)) > len(ready),
              'directoriesListed': directories, 'symlinksSkipped': skipped_links, 'nonregularSkipped': skipped_special}
    return report


def main():
    import paramiko
    required = ('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT')
    if any(not os.getenv(k) for k in required): raise RuntimeError('missing_noa_ssh_secret')
    option = os.getenv('NOA_STORAGE_SFTP_CHANNELS','2')
    if option not in ('1','2','3','4'): raise RuntimeError('invalid_sftp_channel_limit')
    requested = int(option); transport = None; clients = []; started = utc_now(); clock = time.monotonic()
    try:
        transport = paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if not hmac.compare_digest(fingerprint,os.environ['NOA_SSH_HOST_FINGERPRINT']): raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated(): raise RuntimeError('authentication_failed')
        transport.set_keepalive(15); setup_errors = []
        for index in range(requested):
            try:
                client = paramiko.SFTPClient.from_transport(transport)
                client.get_channel().settimeout(20); clients.append(client)
            except Exception:
                setup_errors.append({'folder':'','code':'sftp_channel_unavailable','channel':index}); break
        # A server channel cap falls back to surviving channels, retaining incomplete status.
        report = scan_metadata(clients, requested, setup_errors)
    except Exception as error:
        code = str(error) if str(error) in {'host_key_mismatch','authentication_failed'} else 'ssh_inventory_setup_failed'
        report = empty_report() | {'scanComplete':False,'errors':[{'folder':'','code':code}],
            'startedAt':started,'finishedAt':utc_now(),'elapsedSeconds':round(time.monotonic()-clock,3),'channelsRequested':requested,'channelsUsed':len(clients)}
    finally:
        for client in clients:
            try: client.close()
            except Exception:
                report['scanComplete']=False;report['errors'].append({'folder':'','code':'sftp_channel_close_failed'})
        if transport is not None:
            try: transport.close()
            except Exception:
                report['scanComplete']=False;report['errors'].append({'folder':'','code':'ssh_transport_close_failed'})
    Path('storage-audit').mkdir(exist_ok=True)
    Path('storage-audit/inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('NOA_STORAGE_READ_ONLY '+json.dumps({'files':report['files'],'candidates':len(report['candidate_files']),
        'candidate_bytes':sum(x['bytes'] for x in report['candidate_files']),'unreadable_folders':report['unreadable_folders'],
        'scanComplete':report['scanComplete'],'channelsUsed':report['channelsUsed'],'elapsedSeconds':report['elapsedSeconds']},ensure_ascii=False),flush=True)
    if not report['scanComplete']: raise SystemExit(1)


if __name__ == '__main__': main()
