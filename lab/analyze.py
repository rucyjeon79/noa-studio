"""Measured audio features; never invents vocal timestamps from a waveform."""
import json, sys, re, collections, subprocess
from pathlib import Path
import numpy as np
from scipy.signal import correlate, find_peaks

def lyric_lines(text):
    return [x.strip() for x in text.splitlines() if x.strip() and not re.match(r'^\s*[\[【<].*[\]】>]\s*$',x)]

def analyze(path, lyrics='', feedback=None):
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
    duration=float(info['format'].get('duration',0))
    if not 2 <= duration <= 1800 or not any(s['codec_type']=='audio' for s in info['streams']):
        raise ValueError('audio_duration_or_stream_invalid')
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'])
    samples=np.frombuffer(raw,dtype='<f4')
    if not np.isfinite(samples).all(): raise ValueError('invalid_audio_samples')
    size=1600
    frames=samples[:len(samples)//size*size].reshape(-1,size)
    rms=np.sqrt(np.mean(frames*frames,axis=1)+1e-12)
    if float(np.max(rms))<1e-5: raise ValueError('silent_audio')
    energy=rms/max(float(np.quantile(rms,.95)),1e-6)
    onset=np.maximum(0,np.diff(energy,prepend=energy[0]))
    # 10 Hz envelope gives a coarse, explicitly labelled tempo estimate.
    centered=onset-np.mean(onset)
    ac=correlate(centered,centered,mode='full',method='fft')[len(centered)-1:]
    lags=np.arange(3,11)
    best=int(lags[np.argmax(ac[lags])]) if len(ac)>10 else 5
    bpm=round(600/best,1)
    confidence=float(np.clip(ac[best]/max(ac[0],1e-9),0,1)) if len(ac)>best else 0
    lines=lyric_lines(lyrics);counts=collections.Counter(lines)
    hooks=[{'text':line,'occurrences':n} for line,n in counts.most_common(5) if n>1]
    windows=[]
    lengths=[x for x in [30.,45.,60.] if x<=duration] or [min(duration,20.)]
    prior=[]
    for history in feedback or []:
        metrics=history.get('metrics',{}).get('summary',{})
        if metrics.get('views',0)>=100 and metrics.get('averageViewDuration',0)>0 and history.get('selection'):
            prior.append((history['selection']['start']/max(duration,1),metrics['averageViewDuration']))
    for length in lengths:
        starts=np.arange(0,max(.01,duration-length),max(2.,60/max(bpm,1)*4)).tolist()+[duration-length]
        for start in starts:
            left=int(start*10);right=min(len(energy),int((start+length)*10))
            e=energy[left:right]
            if len(e)<3:continue
            continuity=float(np.mean(e>.15));contrast=float(np.mean(onset[left:right]));strength=float(np.mean(e))
            score=.50*min(strength,1)+.25*continuity+.20*min(contrast*5,1)
            if prior:score+=.05*max(0,1-min(abs(start/duration-p[0]) for p in prior))
            windows.append({'start':round(start,3),'end':round(start+length,3),'score':round(score,4),'reasons':[f'측정된 구간 에너지 {strength:.2f}',f'소리 연속성 {continuity:.0%}',f'리듬 변화량 {contrast:.3f}']+(['동일 장르의 실제 게시 성과를 보조 점수에 반영'] if prior else [])})
    chosen=[]
    for window in sorted(windows,key=lambda x:x['score'],reverse=True):
        if all(abs(window['start']-c['start'])>=min(8,(window['end']-window['start'])/3) for c in chosen):
            window['candidateId']='candidate-'+str(len(chosen)+1);chosen.append(window)
        if len(chosen)==4:break
    for w in sorted(windows,key=lambda x:x['score'],reverse=True):
        if len(chosen)>=3:break
        if w not in chosen:w['candidateId']='candidate-'+str(len(chosen)+1);chosen.append(w)
    return {'duration':duration,'bpm':bpm,'bpmConfidence':round(confidence,3),'bpmMethod':'onset_envelope_autocorrelation_estimate','rmsDb':round(float(20*np.log10(max(np.sqrt(np.mean(samples*samples)),1e-9))),2),'clippingFraction':round(float(np.mean(np.abs(samples)>=.999)),6),'rhythmPeaks':[round(i/10,2) for i in find_peaks(onset,prominence=max(.02,float(np.quantile(onset,.75))))[0]][:300],'energy':[{'time':round(i/10,1),'value':round(float(energy[i]),3)} for i in range(0,len(energy),max(1,len(energy)//150))],'hooks':hooks,'candidates':chosen,'cues':[],'vocalSegments':[],'alignmentVerified':False,'alignmentSource':'not_aligned','notes':['에너지·리듬 분석은 실제 음원 측정값입니다.','보컬 및 가사 시점은 음성 인식 또는 관리자 검증이 필요합니다.','후보 점수는 예상 조회수나 CTR이 아닙니다.']}

if __name__=='__main__':
    request=json.load(sys.stdin)
    result=analyze(sys.argv[1],request.get('lyrics',''),request.get('feedback',[]))
    json.dump(result,sys.stdout,ensure_ascii=False,allow_nan=False)
