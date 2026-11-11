/** One-time N80-owned, official binary verification. Never invokes a model. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';

const root='/hosting/noastudio/noa-hub/codex';
const version='0.167.1';
const manifest=JSON.parse(process.argv[2]);
if(manifest.version!==version||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<1000000||manifest.bytes>600000000||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('codex_manifest_invalid');
const dir=`${root}/${version}`,archive=`${dir}/codex.stage.gz`,stage=`${dir}/codex.stage`,binary=`${dir}/codex`;
const deadline=setTimeout(()=>process.exit(124),150000);
const hash=async file=>{const h=crypto.createHash('sha256');for await(const c of fs.createReadStream(file))h.update(c);return h.digest('hex');};
const safe=file=>{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink())throw new Error('codex_file_invalid');return s;};
let installed=false;
try{
  if(fs.existsSync(binary)){
    if(safe(binary).size!==manifest.bytes||await hash(binary)!==manifest.sha256)throw new Error('codex_existing_binary_changed');
  }else{
    safe(archive);
    await pipeline(fs.createReadStream(archive),zlib.createGunzip(),fs.createWriteStream(stage,{flags:'wx',mode:0o700}));
    if(safe(stage).size!==manifest.bytes||await hash(stage)!==manifest.sha256)throw new Error('codex_binary_hash_mismatch');
    fs.renameSync(stage,binary);installed=true;
  }
  const allowed=new Set(['PATH','HOME','LANG','LC_ALL','TMPDIR','SSL_CERT_FILE','SSL_CERT_DIR']);
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k)));
  const call=args=>{
    const r=spawnSync(binary,args,{env,timeout:20000,maxBuffer:262144,encoding:'utf8'});
    return {code:r.status,signal:r.signal,error:r.error?.code||null,text:(r.stdout||'')+(r.stderr||'')};
  };
  const v=call(['--version']);
  const nativeVersion=/codex-cli 0[.]167[.]1(?:\s|$)/.test(v.text)&&v.code===0;
  const auth=nativeVersion?call(['-c','forced_login_method="chatgpt"','login','status']):null;
  const help=nativeVersion?call(['exec','--help']):null;
  const features=nativeVersion?call(['features','list']):null;
  const result={version,sha256:manifest.sha256,bytes:manifest.bytes,nativeVersion,exitCode:v.code,signal:v.signal,error:v.error,
    loginState:auth?(auth.code===0&&/logged in using chatgpt/i.test(auth.text)?'chatgpt':/not logged in/i.test(auth.text)?'login_required':'unconfirmed'):'not_checked',
    controls:help?Object.fromEntries(['--ignore-user-config','--ephemeral','--output-schema','--json'].map(k=>[k,help.text.includes(k)])):{},
    disabledFeaturesAvailable:features?['shell_tool','apps','plugins','hooks','memories','browser_use','computer_use','fast_mode','ultrafast_mode'].filter(k=>new RegExp('^'+k+'\\s','m').test(features.text)):[],
    generationRequests:0,apiFallback:false,workerActivated:false,verifiedAt:Math.floor(Date.now()/1000)};
  if(!nativeVersion&&installed){fs.unlinkSync(binary);result.failedBinaryRemoved=true;}
  fs.writeFileSync(`${root}/status.json.tmp`,JSON.stringify(result),{mode:0o600});fs.renameSync(`${root}/status.json.tmp`,`${root}/status.json`);
  process.stdout.write(JSON.stringify(result)+'\n');
}finally{
  for(const file of [archive,stage])if(fs.existsSync(file))fs.unlinkSync(file);
  clearTimeout(deadline);
}
