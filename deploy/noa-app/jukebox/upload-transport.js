(function(root){'use strict';
const codes=new Set(('drive_storage_not_connected drive_storage_quota_exceeded drive_storage_access_denied drive_source_verification_failed drive_session_expired account_storage_quota_exceeded storage_permission_denied upload_storage_unavailable administrator_required csrf_required another_upload_is_active cover_original_artist_required temporary_storage_quota_reached hosting_storage_insufficient actual_audio_format_mismatch mp3_wav_size_or_identity_invalid reselect_source_file upload_service_unavailable chunk_conflict chunk_size_mismatch upload_not_accepting_chunks upload_incomplete assembled_size_mismatch upload_busy_retry server_job_cannot_be_canceled unknown_song upload_song_mismatch retry_limit_reselect_source non_retryable_reselect_source invalid_upload_id invalid_chunk request_too_large invalid_json upload_not_found').split(' '));
class UploadError extends Error{
 constructor(code,detail={}){super(code);this.name='UploadError';Object.assign(this,{stage:detail.stage||'unknown',http:Number(detail.http)||0,uploadId:/^[a-f0-9]{32}$/.test(detail.uploadId||'')?detail.uploadId:null,format:detail.format||'none',requestId:/^[a-f0-9]{16}$/.test(detail.requestId||'')?detail.requestId:null,transient:!!detail.transient,retryAfter:Math.min(60000,Math.max(0,Number(detail.retryAfter)||0))});}
 safe(){return {code:this.message,stage:this.stage,http:this.http,upload_id:this.uploadId,response_format:this.format,request_id:this.requestId};}
}
function decode(raw,meta){
 const type=(meta.type||'').toLowerCase(),format=!raw?'empty':type.includes('json')?'json':type.includes('html')||/^\s*</.test(raw)?'html':'other';
 let data=null;try{if(format==='json')data=JSON.parse(raw);}catch{}
 const status=Number(meta.http)||0,base={...meta,format,transient:status===0||status===408||status===429||status>=500};
 if(!status)throw new UploadError('network_unavailable',base);
 if(status===401||status===403)throw new UploadError('authentication_required',base);
 if((status<200||status>=300)&&codes.has(meta.serverCode))throw new UploadError(meta.serverCode,base);
 if(!data||typeof data!=='object'||Array.isArray(data))throw new UploadError(format==='html'?'response_html':format==='empty'?'response_empty':'response_json_invalid',{...base,transient:base.transient||(status>=200&&status<300)});
 if(status<200||status>=300){const code=codes.has(data.error)?data.error:'http_'+status;throw new UploadError(code,base);}
 return data;
}
class Transport{
 constructor({onTrip=()=>{},onRecord=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){this.onTrip=onTrip;this.onRecord=onRecord;this.sleep=sleep;this.signature=null;this.failures=0;this.open=false;}
 failure(e,mutating){this.onRecord(e.safe());if(!mutating||!e.transient)return;const signature=e.http>=500||e.http===429?'http_'+e.http:e.message;this.failures=this.signature===signature?this.failures+1:1;this.signature=signature;if(this.failures>=3){this.open=true;this.onTrip(e);}}
 success(mutating){if(mutating){this.failures=0;this.signature=null;}}
 reset(){this.open=false;this.failures=0;this.signature=null;}
 async run(operation,{mutating=true,recover=null}={}){
  if(mutating&&this.open)throw new UploadError('transfer_circuit_open');
  for(let attempt=0;;attempt++){
   try{const data=await operation();this.success(mutating);return data;}
   catch(error){const e=error instanceof UploadError?error:new UploadError('network_unavailable',{transient:true});if(e.message==='upload_paused')throw e;this.failure(e,mutating);
    if(recover){let restored=null;try{restored=await recover(e);}catch(recoveryError){if(recoveryError instanceof UploadError&&!recoveryError.transient){this.onRecord(recoveryError.safe());throw recoveryError;}}if(restored!==null&&restored!==undefined)return restored;}
    if(this.open||!e.transient||attempt>=2)throw e;
    await this.sleep(Math.max(e.retryAfter,Math.min(30000,1000*2**attempt)));
   }
  }
 }
}
const api={Transport,UploadError,decode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NoaUploadTransport=api;
})(typeof window!=='undefined'?window:this);
