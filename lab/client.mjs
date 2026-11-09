import crypto from 'node:crypto';
const ORIGIN='https://noastudio.ai.kr';
export class LabClient {
 constructor(key,base=ORIGIN,timeout=60000){this.key=key;this.base=base;this.timeout=timeout;}
 async call(action,body=null,query={},binary=false){const params=new URLSearchParams({action,...query}),method=body===null?'GET':'POST',raw=body===null?'':JSON.stringify(body),ts=String(Math.floor(Date.now()/1000)),nonce=crypto.randomBytes(16).toString('hex');const signed=[method,params.toString(),crypto.createHash('sha256').update(raw).digest('hex'),ts,nonce].join('\n');const response=await fetch(this.base+'/noa-bridge/lab-worker.php?'+params,{method,body:body===null?undefined:raw,redirect:'error',signal:AbortSignal.timeout(binary?120000:this.timeout),headers:{'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':crypto.createHmac('sha256',this.key).update(signed).digest('hex')}});if(!response.ok)throw Error('lab_api_http_'+response.status);return binary?Buffer.from(await response.arrayBuffer()):response.json();}
}
