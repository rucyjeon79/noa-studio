/** Credentials stay in memory. A lost provider reply is never automatically resubmitted. */
export async function generateMuvy(task,key,request=fetch){
 let response;try{response=await request('https://api.x.ai/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(95000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:task.model,temperature:.6,max_tokens:task.tokens,response_format:{type:'json_object'},messages:[{role:'system',content:task.system},{role:'user',content:task.user}]})});}catch{throw Error('provider_unconfirmed');}
 if([401,403].includes(response.status))throw Error('provider_access_denied');if(response.status===429)throw Error('provider_rate_limit');if(!response.ok)throw Error('provider_failed');
 let size=0,chunks=[];try{for await(const chunk of response.body){size+=chunk.length;if(size>2097152)throw Error();chunks.push(chunk);}const data=JSON.parse(Buffer.concat(chunks).toString('utf8')),choice=data.choices?.[0];if(choice?.finish_reason!=='stop')throw Error('provider_incomplete');const content=choice.message?.content;if(typeof content!=='string')throw Error();const start=content.indexOf('{'),end=content.lastIndexOf('}');if(start<0||end<start)throw Error();const output=JSON.parse(content.slice(start,end+1));return {output,usage:Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].filter(k=>Number.isFinite(data.usage?.[k])).map(k=>[k,data.usage[k]]))};}catch(e){throw Error(e.message==='provider_incomplete'?'provider_incomplete':'provider_format');}
}
export async function runMuvy(client,provider=generateMuvy,maxTurns=24){
 if(!Number.isInteger(maxTurns)||maxTurns<1||maxTurns>24)throw Error('invalid_muvy_turn_limit');
 let processed=0;for(let turn=0;turn<maxTurns;turn++){
  const claim=await client.call('muvy_claim',{});if(!claim.task)return {processed,state:claim.state||'idle'};
  const task=claim.task,identity={id:task.id,request:task.request,lease:task.lease};let result;
  try{result=await provider(task,claim.credential);}catch(e){const error=['provider_access_denied','provider_rate_limit','provider_incomplete','provider_format','provider_failed'].includes(e.message)?e.message:'provider_unconfirmed';await client.call('muvy_failed',{...identity,error});processed++;continue;}finally{delete claim.credential;}
  // Retry only result delivery, never the provider invocation.
  let delivered=false;for(let attempt=0;attempt<3;attempt++){try{await client.call('muvy_complete',{...identity,result});delivered=true;break;}catch(e){if(/http_40[09]/.test(e.message)){await client.call('muvy_failed',{...identity,error:'provider_format'}).catch(()=>{});break;}if(attempt<2)await new Promise(r=>setTimeout(r,500));}}
  if(!delivered)throw Error('muvy_result_delivery_unconfirmed');processed++;
 }
 return {processed,state:'bounded_turn_complete'};
}
