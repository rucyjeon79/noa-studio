import http from 'node:http';
import https from 'node:https';
const path='/noa-hub-owner.php?operation=hub.verify';
async function probe(name,client,options){return await new Promise(resolve=>{const r=client.get({...options,path,timeout:8000,headers:{Host:'noastudio.ai.kr'}},s=>{let data='';s.on('data',b=>{data+=b;if(data.length>2048)s.destroy();});s.on('end',()=>{let verified=false;try{const j=JSON.parse(data);verified=j.ok===true&&j.operation==='hub.verify';}catch{}resolve({name,status:s.statusCode,verified});});s.on('error',e=>resolve({name,error:e.code||'response_error'}));});const timer=setTimeout(()=>r.destroy(new Error('deadline')),8000);r.once('close',()=>clearTimeout(timer));r.on('timeout',()=>r.destroy(new Error('timeout')));r.on('error',e=>resolve({name,error:e.code||e.message}));});}
const results=await Promise.all([probe('https_ipv4',https,{hostname:'noastudio.ai.kr',family:4}),probe('https_loopback',https,{hostname:'127.0.0.1',port:443,servername:'noastudio.ai.kr'}),probe('loopback',http,{hostname:'127.0.0.1',port:80}),probe('http_public',http,{hostname:'noastudio.ai.kr',family:4})]);
console.log(JSON.stringify(results));
