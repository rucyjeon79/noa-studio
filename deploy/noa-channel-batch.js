/* The server owns each batch. The browser keeps only the selection and files in transit. */
((root) => {
'use strict';

const genres = {
    POP:'pop-original', PAN:'panpop', LAE:'latin-afrobeats-edm', ECR:'edm-kpop-club',
    DDH:'dreamy-deep-house', SM:'your-story', GAP:'groovy-airy-pop', FAE:'fantasy-ambient-edm',
    NPI:'narrative-piano-indie', THAI:'thai-original', EJE:'echoes-of-joseon', JPOP:'jpop-original',
    KPOP:'kpop-original', JB:'joseon-ballad',
};
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();

function matchFile(filename, songs) {
    let title = filename.replace(/\.(mp3|wav)$/i,'').normalize('NFKC').trim();
    const prefix = title.match(/^\[([a-z\d-]+)\]\s*/i);
    let pool = songs;
    if (prefix) {
        const genre = genres[prefix[1].toUpperCase()];
        if (!genre) return '';
        pool = pool.filter(song => song.genre === genre);
        title = title.slice(prefix[0].length);
    }
    const standaloneEp = title.match(/^EP\.?\s*0*([1-9]\d*)$/i);
    if(standaloneEp) {
        const matches=pool.filter(song=>Number(song.ep)===Number(standaloneEp[1]));
        return matches.length===1?matches[0].key:'';
    }
    const numbered = title.match(/^(?:EP\.?\s*)?(\d+)\s*[_-]\s*(.+)$/i);
    if (numbered) {
        pool = pool.filter(song => Number(song.ep) === Number(numbered[1]));
        title = numbered[2];
    }
    const matches = pool.filter(song => normalize(song.title) === normalize(title));
    return matches.length === 1 ? matches[0].key : '';
}

const errors = {
    revision_conflict:'처리 중 곡 정보가 바뀌었습니다.', worker_offline:'N80 Auto 연결을 확인해 주세요.',
    dispatch_failed:'N80 Auto 실행 요청이 전달되지 않았습니다.', setup_required:'N80 Auto 연결 설정이 필요합니다.',
    batch_active:'진행 중인 일괄 작업이 있습니다.', invalid_target:'이 곡에서 지원하지 않는 항목입니다.',
    own_song_required:'이 채널에서 편집할 수 있는 곡만 선택하세요.', csrf_required:'로그인 상태가 바뀌었습니다. 새로고침해 주세요.',
    upload_file_changed:'다른 파일이 연결된 전송입니다. 파일을 다시 선택하세요.',
    file_chunk_conflict:'이어올릴 원본 파일의 내용이 다릅니다. 처음 선택한 파일을 다시 지정하세요.',
    another_upload_is_active:'다른 파일이 이미 업로드 중입니다.', channel_storage_limit:'채널의 음원 저장 한도에 도달했습니다.',
    cover_original_artist_required:'커버 원곡 가수를 입력한 뒤 다시 전송하세요.', actual_audio_format_mismatch:'파일 형식을 확인하세요.',
    request_conflict:'실행 요청이 바뀌었습니다. 대상을 다시 선택하세요.', no_enabled_fields:'규칙에 따라 생성할 항목이 없습니다.',
};
const reasons={
    already_optimized:'이미 최적화된 음원', already_processing:'처리 중', source_received:'원본 접수', retry:'재시도',
    file_transfer_required:'파일 전송 필요', managed_song_requires_admin:'관리자 편집 필요', own_upload_required:'본인 업로드만 처리 가능',
    retry_limit_reselect_source:'원본 파일을 다시 선택하세요.', non_retryable_reselect_source:'원본 파일을 다시 선택하세요.',
    source_replaced:'원본이 교체됨', song_changed:'곡 정보가 변경됨', ready:'최적화 완료', already_ready:'최적화 완료', source_required:'원본 파일 필요', no_source:'원본 파일 필요',
    upload_required:'원본 파일 필요', already_filled:'기존 내용 유지', no_empty_fields:'기존 내용 유지',
    worker_failed:'AI 생성 실패', dispatch_failed:'N80 Auto 호출 실패', reselect_source_file:'원본 파일 다시 선택',
    waiting_for_upload:'파일 전송 대기', uploaded:'파일 전송 완료', in_progress:'서버에서 처리 중',
};
const reasonText = code => errors[code] || reasons[code] || (code && /[가-힣]/.test(code)?code:'');
const actionLabel = {audio:'음질 최적화', ai:'AI 생성', upload:'음원 업로드'};
const statuses = {queued:'대기', running:'진행 중', done:'완료', skipped:'건너뜀', failed:'실패', missing:'파일 필요'};
const active = item => item.status === 'queued' || item.status === 'running';
const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');

function mount(panel, {renderTree, fingerprint}) {
    const byId = id => document.getElementById(id);
    const mode = byId('batch-mode'), run = byId('batch-run'), preview = byId('batch-preview'), feedback = byId('batch-feedback');
    const files = byId('batch-files'), map = byId('batch-file-map');
    const history = byId('batch-history'), csrf = document.querySelector('meta[name=noa-creator-csrf]').content;
    const admin = panel.dataset.admin === '1', selected = new Set(), last = new Map(), historyLimit=new Map();
    let index = new Map(), rows = [], pending = false, sending = false;
    let runAllowed = false;
    let version = 0, previewTimer, pollTimer, previewData = null, requestId = '', historyVersion = 0, polling = false, locked = false;
    const fields = () => Array.from(panel.querySelectorAll('[name=batch-field]:checked'), input => input.value);
    const chosen = () => Array.from(selected,key => index.get(key)).filter(song => song && (admin || !song.managed));
    const visible = () => panel.open && !document.hidden;
    function el(tag, text='', className='') {
        const element = document.createElement(tag);
        if (text) element.textContent=text;
        if (className) element.className=className;
        return element;
    }
    function button(text, handler) {
        const b=el('button',text,'noa-button');
        b.type='button';b.onclick=handler;
        return b;
    }
    function report(text) { feedback.hidden=!text;feedback.textContent=text; }
    function showPreview(text,label,enabled=false) {
        runAllowed=enabled;preview.textContent=text;run.textContent=label;run.disabled=!runAllowed||pending||locked;
    }
    function params() {
        return {keys:chosen().map(s=>s.key), fields:fields(), replace:!!byId('batch-replace')?.checked, requestId};
    }
    async function call(kind, operation, body={}, query={}, binary=false) {
        const ops={preview:'batchPreview',start:'batchStart',status:'batchStatus',retry:'batchRetry'};
        const url=kind==='ai'?'/noa-gpt.php?op='+ops[operation]:'/noa-bridge/channel-batch.php?'+new URLSearchParams({action:operation,...query});
        let response;
        if(['start','retry'].includes(operation))root.N80Activity?.set('batch-request',kind,'waiting');
        try {
            response=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',
                headers:{'Content-Type':binary?'application/octet-stream':'application/json','X-NOA-CSRF':csrf,'X-NOA-Bridge-Request':'1'},
                body:binary?body:JSON.stringify(body)});
        } catch { if(operation!=='preview')root.N80Activity?.set('batch-request',kind,'failed',{fresh:true});throw Error('서버에 연결할 수 없습니다. 연결 후 다시 시도하세요.'); }
        let data;
        try { data=await response.json(); } catch { throw Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도하세요.'); }
        if(!response.ok||data.ok===false||data.error) {
            const error=Error(errors[data.error]||('요청을 처리하지 못했습니다. '+(data.error||response.status)));
            error.code=data.error;if(operation!=='preview')root.N80Activity?.set('batch-request',kind,'failed',{fresh:true});throw error;
        }
        if(operation!=='preview')root.N80Activity?.set('batch-request',kind,'idle');
        return data;
    }
    function songLabel(song) {
        return [root.NoaBrowse?.names?.[song.genre]||song.genre, Number(song.ep)>0?'EP '+Number(song.ep):'',song.title].filter(Boolean).join(' · ');
    }
    function selectionChanged() {
        if (pending) return;
        version++;clearTimeout(previewTimer);previewData=null;requestId=uid();locked=false;
        byId('batch-count').textContent=selected.size+'곡 선택';
        byId('batch-back').hidden=!panel.open||!selected.size;
        if (!panel.open) return;
        byId('batch-missing').hidden=true;byId('batch-missing').open=false;
        report('');
        if (byId('batch-fields')) byId('batch-fields').hidden=mode.value!=='ai';
        byId('batch-upload').hidden=mode.value!=='upload';
        if (mode.value==='upload') { renderFiles();return; }
        if (!chosen().length || (mode.value==='ai'&&!fields().length)) {
            showPreview(!selected.size?'아래 목록에서 ACT, 장르 또는 곡을 선택하세요.':!chosen().length?'이 채널에서 편집할 수 있는 곡을 선택하세요.':'생성할 항목을 선택하세요.',actionLabel[mode.value]+' 시작');
            return;
        }
        const revision=version,kind=mode.value,body=params();
        showPreview('대상 곡을 확인하고 있습니다.',actionLabel[kind]+' 시작');
        previewTimer=setTimeout(async()=>{
            try {
                const data=await call(kind,'preview',body);
                if (revision!==version||!panel.open) return;
                previewData=data;
                const hiddenCount=selected.size-body.keys.length;
                const counts=['처리 대상 '+data.eligible+'곡','건너뜀 '+(Number(data.skipped||0)+hiddenCount)+'곡'];
                if (data.processing) counts.push('이미 처리 중 '+data.processing+'곡');
                if (data.missing) counts.push('원본 필요 '+data.missing+'곡');
                byId('batch-missing').hidden=!data.items?.some(item=>item.status==='missing');
                showPreview(counts.join(' · '),data.eligible+'곡 '+actionLabel[kind]+' 시작',!!data.eligible);
            } catch (e) {if(revision===version) {showPreview(e.message,'대상 다시 확인',true);}}
        },280);
    }
    function missingSongs(){return (previewData?.items||[]).filter(item=>item.status==='missing');}
    byId('batch-missing').ontoggle=event=>{
        if (!event.currentTarget.open)return;
        const list=event.currentTarget.querySelector('ul'),fragment=document.createDocumentFragment();
        for(const item of missingSongs())fragment.append(el('li',item.title||index.get(item.key)?.title||item.key));
        list.replaceChildren(fragment);
    };
    byId('batch-missing-upload').onclick=()=>{
        if(pending)return;
        const missing=missingSongs();if(!missing.length)return;
        selected.clear();for(const item of missing)selected.add(item.key);
        mode.value='upload';renderTree();selectionChanged();files.focus();
    };
    function rowProblem(row, duplicates) {
        if (!/\.(mp3|wav)$/i.test(row.file.name)||row.file.size>268435456||row.file.size<256) return '256MB 이하의 MP3·WAV 파일을 선택하세요.';
        if (!selected.has(row.key)||!index.has(row.key)) return '연결할 곡을 지정하세요.';
        if (duplicates.get(row.key)>1) return '같은 곡에 여러 파일이 연결되었습니다.';
        if(row.needsArtist&&!row.artist?.trim()) return '원곡 가수를 입력하세요.';
        return '';
    }
    async function bindChoice(row) {
        if(pending)return;
        try {
            const song=await N80Explorer.choose({records:chosen(),title:row.file.name+' · 연결할 곡'});
            if(!song||pending||!rows.includes(row)||!chosen().some(item=>item.key===song.key))return;
            row.key=song.key;row.manual=true;row.error='';row.needsArtist=false;selectionChanged();
        } catch { byId('batch-preview').textContent='N80 탐색기를 불러오지 못했습니다. 다시 시도해 주세요.'; }
    }
    function renderFiles() {
        const pool=chosen();
        for(const row of rows) {
            if(!row.manual&&!row.done&&!pending) row.key=matchFile(row.file.name,pool);
        }
        const duplicates=new Map();
        for(const row of rows)if(row.key)duplicates.set(row.key,(duplicates.get(row.key)||0)+1);
        const fragment=document.createDocumentFragment();let ready=0,invalid=0;
        for(const row of rows){
            const li=el('li'),desc=el('span','','batch-file-desc'),problem=rowProblem(row,duplicates);
            desc.append(el('strong',row.file.name),el('small',index.has(row.key)?songLabel(index.get(row.key)):'연결 대기'));
            if(row.done)desc.append(el('small','서버에 전달됨'));
            else {
                if(problem||row.error){const note=el('small',row.error||problem);note.setAttribute('aria-invalid','true');desc.append(note);}
                else if(row.percent!=null)desc.append(el('small','파일 전송 '+row.percent+'%'));
                if(problem)invalid++;else ready++;
            }
            li.append(desc);
            if(!pending&&!row.done){
                li.append(button('곡 지정',()=>bindChoice(row)),button('제외',()=>{rows=rows.filter(other=>other!==row);selectionChanged();}));
                if(row.needsArtist){
                    const input=el('input');input.type='text';input.maxLength=200;input.placeholder='원곡 가수';input.setAttribute('aria-label',row.file.name+' 원곡 가수');input.value=row.artist||'';
                    input.onchange=()=>{row.artist=input.value.trim();row.error='';selectionChanged();};li.append(input);
                }
            }
            fragment.append(li);
        }
        map.replaceChildren(fragment);
        const note=rows.length?'파일 '+rows.length+'개 · 전송 대상 '+ready+'개'+(invalid?' · 확인 필요 '+invalid+'개':''):'곡을 선택한 뒤 파일을 추가하세요.';
        showPreview(note,ready+'개 파일 업로드',!!ready&&!invalid);
    }
    files.onchange=()=>{
        for(const file of files.files||[]){
            if(!rows.some(row=>row.file.name===file.name&&row.file.size===file.size&&row.file.lastModified===file.lastModified))
                rows.push({file,key:'',done:false});
        }
        files.value='';selectionChanged();
    };
    function renderHistory() {
        for(const [kind,batch]of last)root.N80Activity?.snapshot('batch-'+kind,(batch?.items||[]).map((item,i)=>({id:batch.id+':'+(item.key||i),state:item.status})));
        const openKinds=new Set(Array.from(history.querySelectorAll('details[open]'),d=>d.dataset.kind));
        const frag=document.createDocumentFragment();
        for(const [kind,batch] of last){
            if(!batch?.items?.length)continue;
            const counts=new Map();
            for(const item of batch.items)counts.set(item.status,(counts.get(item.status)||0)+1);
            const title=actionLabel[batch.type]||actionLabel[kind];
            const block=el('details');block.dataset.kind=kind;block.open=openKinds.has(kind);
            const countText=Array.from(counts,([k,v])=>(statuses[k]||k)+' '+v).join(' · ');
            block.append(el('summary',title+' '+batch.items.length+'곡 · '+countText));
            let body=null;
            const drawDetails=()=>{
                if(!block.open)return;
                if(body)body.remove();
                body=el('div');const list=el('ul'),limit=historyLimit.get(kind)||30;
                for(const item of batch.items.slice(0,limit)){
                    const li=el('li');li.append(el('span',item.title||index.get(item.key)?.title||item.key),
                        el('small',[statuses[item.status]||item.status,reasonText(item.reason)].filter(Boolean).join(' · ')));
                    list.append(li);
                }
                body.append(list);
                if(batch.items.length>limit)body.append(button('다음 곡 더 보기',()=>{historyLimit.set(kind,limit+30);drawDetails();}));
                block.append(body);
            };
            block.ontoggle=()=>{if(block.open&&!body)drawDetails();};
            if(block.open)drawDetails();
            if(counts.has('failed')){
                const retry=button('실패한 곡만 다시 시도',async()=>{
                    if(pending)return;setPending(true);
                    try{const d=await call(kind,'retry',{id:batch.id,requestId:retry.dataset.request});storeBatch(kind,d.batch);report('실패한 곡을 다시 확인했습니다.');}
                    catch(e){report(e.message);}
                    finally{setPending(false);schedulePoll();}
                });
                retry.dataset.request=uid();retry.disabled=pending;block.append(retry);
            }
            frag.append(block);
        }
        history.replaceChildren(frag);
    }
    function storeBatch(kind,batch) {historyVersion++;last.set(kind,batch);renderHistory();}
    function schedulePoll() {
        pollTimer?.();pollTimer=null;
        if(!visible()||pending)return;
        if(Array.from(last.values()).some(batch=>batch?.items?.some(active)))pollTimer=N80Runtime.watch('creator:batch',refreshHistory,()=>{},{interval:6500,immediate:false,active:()=>visible()&&!pending});
    }
    async function refreshHistory(){
        if(!visible()||pending||polling)return;
        polling=true;
        const revision=historyVersion, kinds=mode.querySelector('option[value="ai"]')?['ai']:['audio'];
        const results=await Promise.allSettled(kinds.map(kind=>call(kind,'status')));
        polling=false;
        if (revision===historyVersion&&visible()&&!pending){
            const failed=[];
            results.forEach((result,i)=>{if(result.status==='fulfilled')last.set(kinds[i],result.value.batch);else failed.push(actionLabel[kinds[i]]);});
            renderHistory();
            if(failed.length)history.append(button(failed.join(' · ')+' 진행 상태 다시 확인',refreshHistory));
        }
        schedulePoll();
    }
    function setPending(value) {
        pending=value;pollTimer?.();pollTimer=null;historyVersion++;
        run.disabled=value||locked||!runAllowed;
        mode.disabled=value;files.disabled=value;
        if(byId('batch-fields'))byId('batch-fields').disabled=value;
        byId('creator-songs').inert=value;
    }
    async function uploadRows() {
        const outstanding=rows.filter(row=>!row.done);
        // Reuse the receipt only for these same in-memory File objects. After returning
        // to the page the upload service reconciles the selected file and its existing chunks.
        let batch=last.get('audio');
        const resume=batch?.type==='upload'&&outstanding.every(row=>row.batchId===batch.id&&row.batchKey===row.key);
        if(!resume)batch=(await call('audio','uploadStart',{keys:outstanding.map(row=>row.key),requestId})).batch;
        storeBatch('audio',batch);
        if(!batch?.id)throw Error('파일 전송 준비를 확인할 수 없습니다.');
        sending=true;
        try {
            for(const row of outstanding){
                const file=row.file;row.error='';row.percent=0;row.batchId=batch.id;row.batchKey=row.key;
                try{
                    const params={batchId:batch.id,key:row.key,filename:file.name,bytes:file.size,fingerprint:await fingerprint(file)};
                    if(row.artist)params.originalArtist=row.artist;
                    const init=await call('audio','uploadInit',params);
                    if(init.status==='uploading'){
                        if(!init.id||!Number.isInteger(init.chunkSize)||init.chunkSize<1)throw Error('전송 단위를 확인할 수 없습니다.');
                        const known=new Set(init.chunks||[]);
                        for(let offset=0,n=0;offset<file.size;offset+=init.chunkSize,n++){
                            const part=file.slice(offset,offset+init.chunkSize);
                            if(!known.has(n))await call('audio','uploadChunk',part,{id:init.id,index:n},true);
                            else if(init.chunkHashes?.[n]){
                                const bytes=await crypto.subtle.digest('SHA-256',await part.arrayBuffer());
                                const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
                                if(digest!==init.chunkHashes[n])throw Error(errors.file_chunk_conflict);
                            }
                            row.percent=Math.min(100,Math.round(100*(offset+init.chunkSize)/file.size));
                            report(file.name+' 전송 '+row.percent+'%');
                        }
                        await call('audio','uploadFinish',{id:init.id});
                    } else if(!['queued','ready','retrying','analyzing','processing','verifying'].includes(init.status))throw Error('전송 상태를 확인할 수 없습니다.');
                    row.done=true;
                }catch(error){row.error=error.message;if(error.code==='cover_original_artist_required')row.needsArtist=true;}
                renderFiles();
            }
        }finally{sending=false;}
        const failed=outstanding.filter(r=>!r.done).length;
        report(failed?'전송 확인이 필요한 파일 '+failed+'개입니다. 파일별 안내를 확인한 뒤 다시 전송하세요.':'파일 전송을 마쳤습니다. 서버에서 음질 최적화를 계속합니다.');
    }
    run.onclick=async()=>{
        if(pending||locked)return;
        const kind=mode.value;
        if(kind!=='upload'&&!previewData){selectionChanged();return;}
        setPending(true);run.textContent=kind==='upload'?'파일 전송 중…':'요청 중…';
        try{
            if(kind==='upload')await uploadRows();
            else {
                const data=await call(kind,'start',params());
                storeBatch(kind,data.batch);locked=true;report('서버에 작업을 등록했습니다. 화면을 닫아도 계속 처리합니다.');
            }
        }catch(e){report(e.message);}
        finally{
            setPending(false);
            if(kind==='upload')renderFiles();
            else if(locked)showPreview('최근 일괄 처리에서 곡별 결과를 확인하세요.','작업 등록됨');
            else {run.disabled=false;run.textContent='다시 요청';}
            refreshHistory();
        }
    };
    panel.ontoggle=()=>{
        renderTree();byId('batch-back').hidden=!panel.open||!selected.size;
        if(panel.open&&!pending){selectionChanged();refreshHistory();}else{pollTimer?.();pollTimer=null;clearTimeout(previewTimer);version++;}
    };
    mode.onchange=selectionChanged;
    byId('batch-fields')?.addEventListener('change',selectionChanged);
    if (panel.open) queueMicrotask(refreshHistory);
    document.addEventListener('visibilitychange',()=>{if(visible())refreshHistory();else pollTimer?.();pollTimer=null;});
    window.addEventListener('beforeunload',event=>{if(sending){event.preventDefault();event.returnValue='';}});
    return {
        selection:()=>panel.open?{keys:selected,changed:selectionChanged}:null,
        setRecords(records){
            index=new Map(records.filter(s=>s.kind!=='playlist').map(s=>[s.key,s]));
            for(const key of selected)if(!index.has(key))selected.delete(key);
            selectionChanged();
        },
    };
}
const api={mount,matchFile,genres};
if(typeof module!=='undefined')module.exports=api;
root.NoaChannelBatch=api;
})(typeof window==='undefined'?globalThis:window);
