"""N80 Auto campaign tick; existing workflow owns the clock and concurrency."""
import json, sys
from pathlib import Path
from noa_n80_ai_worker import worker_key, signed_tick

def prepare_subtitles(dispatch):
    claim=dispatch('claim_subtitles')
    if not claim.get('claimed'):
        print('N80_SHORTS_SUBTITLES',json.dumps({'state':claim['state']}),flush=True)
        return
    import subprocess, tempfile
    source=claim['source'];lease=claim['lease'];root=Path(__file__).resolve().parents[1]
    stage='subtitle_dependency_install'
    try:
        # Install only for a claimed recognition task, never on every idle tick.
        subprocess.run([sys.executable,'-m','pip','install','--disable-pip-version-check','-r',str(root/'lab/subtitle-requirements.txt')],
                       check=True,timeout=180,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        import paramiko
        from noa_full_inventory import connect
        sys.path.insert(0,str(root/'lab'))
        from daily_shorts import source_download
        with tempfile.TemporaryDirectory(prefix='n80-captions-') as folder:
            stage='source_download'
            audio=Path(folder)/'source.mp3';manifest=Path(folder)/'manifest.json';output=Path(folder)/'subtitles.json'
            transport=connect()
            try:
                with paramiko.SFTPClient.from_transport(transport) as sftp:
                    sftp.get_channel().settimeout(30)
                    source_download(sftp,source,audio)
            finally:transport.close()
            manifest.write_text(json.dumps({'audio':{'path':str(audio),'sha256':source['audioSha256']},'duration':source['duration'],'lyrics':source['lyrics']},ensure_ascii=False))
            stage='recognition'
            subprocess.run([sys.executable,str(root/'lab/session-subtitles.py'),str(manifest),str(output),'--model','small','--cache-dir',str(Path(folder)/'model')],
                           check=True,timeout=720,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            report=json.loads(output.read_text())
            stage='subtitle_save'
            result=dispatch('complete_subtitles',lease=lease,subtitles=report['payload'])
        print('N80_SHORTS_SUBTITLES',json.dumps(result),flush=True)
    except Exception as error:
        reason=stage+('_timeout' if isinstance(error,subprocess.TimeoutExpired) else '_failed')
        if isinstance(error,ValueError) and str(error) in {'source_path_rejected','source_file_rejected','source_size_changed','source_checksum_mismatch'}:
            reason=str(error)
        try:dispatch('fail_subtitles',lease=lease,reason=reason)
        except Exception:pass
        print('N80_SHORTS_SUBTITLES',json.dumps({'state':'subtitle_failed','reason':reason,'errorType':type(error).__name__}),flush=True)

def main():
    key=worker_key()
    def dispatch(command='', **fields):
        return signed_tick(key,'n80_daily_shorts_tick',json.dumps({'command':command,**fields},ensure_ascii=False).encode())
    result=dispatch()
    c=result['campaign']
    print('N80_DAILY_SHORTS',json.dumps({k:c.get(k) for k in ('state','lastTickAt','nextPreparationAt','nextPublicationAt','productionReady','conversationDependent','readiness')}),flush=True)
    claim=dispatch('claim_preparation')
    if not claim.get('claimed'):
        print('N80_SHORTS_PREPARATION',json.dumps({'state':claim['state']}),flush=True)
        prepare_subtitles(dispatch)
        return
    lease=claim['lease']
    last_step={}
    def call(command,**fields):
        last_step.clear();last_step.update(command=command,resource=fields.get('resource'))
        result=dispatch(command,lease=lease,**fields)
        if result.get('dependencyOk') is False:
            error=ValueError('youtube_dependency_failed')
            error.diagnostics=result.get('diagnostic',{})
            raise error
        return result
    try:
        import paramiko
        from noa_full_inventory import connect
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lab'))
        from daily_shorts import prepare
        from analyze import analyze
        transport=connect()
        try:
            with paramiko.SFTPClient.from_transport(transport) as sftp:
                sftp.get_channel().settimeout(30)
                report=prepare(call,claim['policy'],sftp,analyze)
        finally:transport.close()
        saved=call('complete_preparation',report=report)
        print('N80_SHORTS_PREPARATION',json.dumps({'state':saved['state'],'candidateCount':saved['candidateCount'],'publicationReady':False}),flush=True)
    except Exception as error:
        import re
        reason=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z_]{1,100}',str(error)) else 'preparation_dependency_failed'
        diagnostic={'step':dict(last_step),'httpStatus':getattr(error,'code',None),**getattr(error,'diagnostics',{})}
        try:call('fail_preparation',reason=reason,diagnostic=diagnostic)
        except Exception:pass
        # A Shorts/provider failure must not stop unrelated text/music operations.
        print('N80_SHORTS_PREPARATION',json.dumps({'state':'preparation_failed','reason':reason,'errorType':type(error).__name__,'diagnostic':diagnostic}),flush=True)
    prepare_subtitles(dispatch)

if __name__=='__main__':
    main()
