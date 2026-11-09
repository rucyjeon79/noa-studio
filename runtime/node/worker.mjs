/** N80's one-shot host executor. No listener, scheduler, queue or stored credentials. */
import {pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline';
import {runMuvy,generateMuvy} from '../../lab/muvy.mjs';

export async function execute(request, clientFactory, muvy=runMuvy) {
  if (!request || request.version !== 1 || !['engine.status', 'ai.muvy'].includes(request.operation)
      || request.transport!=='n80_auto' || typeof clientFactory!=='function'
      || !/^[a-f0-9]{32}$/.test(request.invocation || '')) throw Error('invalid_node_request');
  const client = clientFactory();
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
    'invalid_muvy_receipt','muvy_result_delivery_unconfirmed','node_transport_failed','node_tool_limit'];
  if(allowed.includes(error?.message))return error.message;
  if(/^lab_api_http_[1-5][0-9]{2}$/.test(error?.message || ''))return error.message;
  if(error?.name==='TimeoutError')return 'node_http_timeout';
  const network=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT',
    'CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID'];
  const code=error?.cause?.code || error?.code;
  return network.includes(code)?'node_network_'+code.toLowerCase():'node_operation_failed';
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
    const lines=createInterface({input,crlfDelay:Infinity});
    const iterator=lines[Symbol.asyncIterator]();
    let size=0,sequence=0;
    input.on('data',chunk=>{size+=chunk.length;if(size>16777216)process.exit(1);});
    const first=await iterator.next();
    if(first.done || first.value.length>4096)throw Error('invalid_node_request');
    request=JSON.parse(first.value);
    const call=async(action,body={})=>{
      const id=++sequence;
      if(id>8)throw Error('node_tool_limit');
      output.write(JSON.stringify({type:'tool',id,action,body})+'\n');
      const line=await iterator.next();
      if(line.done || Buffer.byteLength(line.value)>4194304)throw Error('node_transport_failed');
      const reply=JSON.parse(line.value);
      if(reply.type!=='tool_result'||reply.id!==id)throw Error('node_transport_failed');
      if(reply.ok!==true)throw Error(/^lab_api_http_[1-5][0-9]{2}$/.test(reply.error || '')?reply.error:'node_transport_failed');
      return reply.result;
    };
    const client={call};
    const provider=async(task,key)=>generateMuvy(task,key,async()=>{
      const response=await call('muvy_provider');
      return new Response(response.body,{status:response.status});
    });
    const result=await execute(request,()=>client,c=>runMuvy(c,provider,1));
    lines.close();
    receipt(true,{result});
  } catch(error) {
    receipt(false,{error:errorCode(error)});
    process.exitCode=1;
  } finally {clearTimeout(timer);}
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  await main();
  // A completed one-shot task must not wait for DNS threads or proxy keepalive sockets.
  process.stdout.write('',()=>process.exit(process.exitCode || 0));
}
