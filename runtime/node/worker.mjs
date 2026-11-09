/** N80's one-shot host executor. No listener, scheduler, queue or stored credentials. */
import {pathToFileURL} from 'node:url';
import https from 'node:https';
import {LabClient} from '../../lab/client.mjs';
import {runMuvy} from '../../lab/muvy.mjs';

export async function execute(request, clientFactory=key=>new LabClient(key, undefined, 20000), muvy=runMuvy) {
  if (!request || request.version !== 1 || !['engine.status', 'ai.muvy'].includes(request.operation)
      || !/^[a-f0-9]{64}$/.test(request.key || '')
      || !/^[a-f0-9]{32}$/.test(request.invocation || '')) throw Error('invalid_node_request');
  const client = clientFactory(request.key);
  if (request.operation === 'engine.status') {
    const result = await client.call('n80_status', {});
    if (result.ok !== true || result.runtime?.engine !== 'N80 Engine'
        || result.runtime?.operation !== 'n80_status' || result.generationRequests !== 0)
      throw Error('invalid_n80_status');
    return {state:'verified', engine:'N80 Engine', workerEnabled:result.workerEnabled === true,
      generationRequests:0};
  }
  // Same canonical claim/lease/completion endpoints. One task per bounded host invocation.
  const result = await muvy(client, undefined, 1);
  if (!Number.isInteger(result.processed) || result.processed < 0 || result.processed > 1
      || !['idle','disabled','bounded_turn_complete'].includes(result.state))
    throw Error('invalid_muvy_receipt');
  return result;
}

export function errorCode(error) {
  const allowed=['invalid_node_request','node_version_unsupported','node_input_limit','invalid_n80_status',
    'invalid_muvy_receipt','muvy_result_delivery_unconfirmed'];
  if(allowed.includes(error?.message))return error.message;
  if(/^lab_api_http_[1-5][0-9]{2}$/.test(error?.message || ''))return error.message;
  if(error?.name==='TimeoutError')return 'node_http_timeout';
  const network=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT',
    'CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID'];
  const code=error?.cause?.code || error?.code;
  return network.includes(code)?'node_network_'+code.toLowerCase():'node_operation_failed';
}

async function networkProbe() {
  const probe=(family,local=false)=>new Promise(resolve=>{
    const options={method:'HEAD',family,signal:AbortSignal.timeout(3000)};
    if(local)options.lookup=(_hostname,_options,callback)=>callback(null,'127.0.0.1',4);
    const request=https.request('https://noastudio.ai.kr/',options,response=>{
      response.destroy();resolve('connected');
    });
    request.on('error',error=>resolve(error.name==='AbortError'?'timeout':'failed'));
    request.end();
  });
  const [ipv4,ipv6,loopback_tls]=await Promise.all([probe(4),probe(6),probe(4,true)]);
  return {ipv4,ipv6,loopback_tls};
}

export async function main(input=process.stdin, output=process.stdout) {
  const started = Date.now();
  let request, done=false;
  const receipt=(ok, result)=>{
    if(done)return;done=true;
    output.write(JSON.stringify({version:1,ok,authority:'N80 Engine',runtime:'node',
      nodeVersion:process.version, invocation:request?.invocation || null,
      operation:request?.operation || null, elapsedMs:Date.now()-started,...result})+'\n');
  };
  const timer=setTimeout(()=>{receipt(false,{error:'node_deadline'});process.exit(1);},240000);
  try {
    if (!process.version.startsWith('v24.')) throw Error('node_version_unsupported');
    let size=0;const chunks=[];
    for await (const chunk of input) {
      size+=chunk.length;if(size>4096)throw Error('node_input_limit');chunks.push(Buffer.from(chunk));
    }
    request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result=await execute(request);
    receipt(true,{result});
  } catch(error) {
    const network = request?.operation==='engine.status' ? await networkProbe() : undefined;
    receipt(false,{error:errorCode(error),...(network?{networkProbe:network}:{})});
    process.exitCode=1;
  } finally {clearTimeout(timer);if(request)delete request.key;}
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await main();
