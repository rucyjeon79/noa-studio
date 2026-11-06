"""Verify automatic upload finalization, real worker pickup and decoded output on a private QA song."""
import base64
import datetime
import hashlib
import io
import json
import math
import os
import struct
import time
import urllib.request
import wave

import paramiko
from noa_full_inventory import connect
from noa_jukebox_recovery import signed_service

PRIVATE = '/hosting/noastudio/noa-jukebox-private'
QA_SONG = 'jukebox:qa:fifo-01'


def synthetic_clip():
    with io.BytesIO() as out:
        with wave.open(out, 'wb') as clip:
            clip.setparams((1, 2, 44100, 0, 'NONE', 'not compressed'))
            salt = int.from_bytes(os.urandom(3), 'big')
            clip.writeframes(b''.join(struct.pack('<h', int(7000 * math.sin(
                2 * math.pi * (300 + salt / 65536) * t / 44100))) for t in range(44100 * 4)))
        return out.getvalue()


def seconds_between(early, late):
    return round((datetime.datetime.fromisoformat(late) - datetime.datetime.fromisoformat(early)).total_seconds(), 3)


def main():
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            with sftp.open('/hosting/noastudio/noa-ai-lab/worker.key', 'rb') as stream:
                key = stream.read(129).decode().strip()
            call = signed_service(key)
            data = synthetic_clip()
            source = hashlib.sha256(data).hexdigest()
            started = int(time.time())
            pending = call('qa_upload', {'mode':'init', 'key':QA_SONG, 'filename':'Wake-verification.wav',
                                         'bytes':len(data), 'fingerprint':source})
            upload = pending['id']
            print('QA upload reserved', upload, flush=True)
            for n, offset in enumerate(range(0, len(data), pending['chunkSize'])):
                part = data[offset:offset+pending['chunkSize']]
                ack = call('qa_upload', {'mode':'chunk', 'id':upload, 'index':n,
                                         'chunk':base64.b64encode(part).decode()})
                assert ack['sha256'] == hashlib.sha256(part).hexdigest()
            # Deliberately do not send finish, retry, enqueue or a manual worker dispatch.
            deadline = time.monotonic() + 300
            last = None
            while time.monotonic() < deadline:
                row = call('qa_upload', {'mode':'status', 'id':upload})
                job = row.get('job') or {}
                if row['status'] != last:
                    print('QA upload state', row['status'], 'job', job.get('id'), flush=True)
                    last = row['status']
                if row['status'] == 'failed':
                    raise RuntimeError('QA processing failed: '+str(job.get('error')))
                if job:
                    try:
                        with sftp.open(PRIVATE+'/upload-wake-state', 'rb') as state_file:
                            state = json.loads(state_file.read(4096))
                    except FileNotFoundError:
                        state = {}
                    if not state.get('accepted') or state.get('at', 0) < started - 60:
                        raise RuntimeError('upload dispatch was not accepted: HTTP '+str(state.get('http', 0)))
                if row['status'] == 'ready':
                    break
                time.sleep(3)
            else:
                raise RuntimeError('QA worker did not finish within five minutes')
            assert row['source_sha256'] == source and row['source_matches_final'] and row['final_verified']
            assert job['started_at'] and job['finished_at'] and job['worker_run_id']
            run_url = 'https://api.github.com/repos/rucyjeon79/noa-studio/actions/runs/'+str(int(job['worker_run_id']))
            with urllib.request.urlopen(run_url, timeout=20) as response:
                run = json.load(response)
            assert run['path'] == '.github/workflows/noa-jukebox.yml'
            wait = seconds_between(job['uploaded_at'], job['started_at'])
            # An already listening worker may claim immediately. Cold starts must be event-driven.
            if run['event'] != 'workflow_dispatch' and wait > 12:
                raise RuntimeError('scheduled worker masked a missed wake')
            final = row['public']['analysis']['final']
            assert final['codec']=='mp3' and not final['decode_errors'] and final['true_peak'] <= -1
            receipt = {'upload':upload,'job':job['id'],'worker_run':str(job['worker_run_id']),
                       'event':run['event'],'queue_seconds':wait,
                       'processing_seconds':seconds_between(job['started_at'],job['finished_at']),
                       'source_sha256_verified':True,'final_sha256_verified':True,'codec':final['codec'],
                       'bitrate':final.get('bitrate'),'decode_errors':final['decode_errors']}
            print('UPLOAD_WAKE_VERIFIED', json.dumps(receipt), flush=True)
    finally:
        transport.close()

if __name__=='__main__':
    main()
