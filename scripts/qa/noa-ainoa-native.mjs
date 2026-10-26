import assert from 'node:assert/strict';
const base='http://127.0.0.1:8101',origin='https://noastudio.ai.kr';let cookie='';
async function req(path,body,headers={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:origin}:{}),...headers},body:body?JSON.stringify(body):undefined});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,data:await r.json()};}
let r=await req('/noa-ainoa.php?action=status');assert.equal(r.status,200);assert.equal(r.data.level,1);const csrf=r.data.csrf;
assert.equal((await req('/noa-ainoa.php',{action:'search',query:'가사'})).status,403);
r=await req('/noa-ainoa.php',{action:'search',query:'가사'},{'X-NOA-CSRF':csrf});assert.equal(r.status,200);assert(r.data.items.length>0);assert(r.data.loginRequired);assert(!JSON.stringify(r.data.items).includes('youtubeUrl'));assert(!('lyrics'in r.data.items[0]));
assert.equal((await req('/noa-ainoa.php',{action:'generate',selector:{},field:'title'},{'X-NOA-CSRF':csrf})).status,403);
assert.equal((await req('/noa-ainoa.php',{action:'chat',key:'single:kpop-original:01'},{'X-NOA-CSRF':csrf})).status,403);
await req('/noa-inline-edit.php?type=song&source=music&key=single:kpop-original:01&auth=admin');
r=await req('/noa-inline-edit.php?type=song&source=music&key=single:joseon-ballad:01');const before=r.data;assert.equal(before.packageType,'ep');assert.equal(before.fields.sunoPrompt,'');
const patch={sunoPrompt:'Joseon ballad, female solo, acoustic Korean instruments',vocal:'여자솔로'},body={selector:{type:'song',source:'music',key:'single:joseon-ballad:01'},expectedRevision:before.revision,requestId:crypto.randomUUID(),patch};
r=await req('/noa-inline-edit.php',body,{'X-NOA-Bridge-Request':'1'});assert.equal(r.status,200);r=await req('/noa-inline-edit.php?type=song&source=music&key=single:joseon-ballad:01');assert.equal(r.data.fields.sunoPrompt,patch.sunoPrompt);assert.equal(r.data.fields.vocal,'여자솔로');assert.deepEqual(r.data.original,before.original);assert.equal(r.data.revision,before.revision+1);
console.log('AINOA_NATIVE_SEARCH_CSRF_ROLE_GATES_EP_SUNO_VOCAL_ROUNDTRIP_ORIGINAL_LOCK_OK');
