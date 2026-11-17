<?php
declare(strict_types=1);
/** N80-owned remote MCP client. No listener, scheduler, discovery execution or browser login. */
const N80_MCP_PROTOCOL='2026-07-28';
function n80_mcp_providers():array {
 return ['notebook'=>['endpoint'=>'https://notebook.googleapis.com/mcp','authOwner'=>'notebooklm',
  'tools'=>['create_notebook','get_notebook','list_notebooks','update_notebook','create_source','get_source','list_sources']]];
}
function n80_mcp_identity(array $s):string {return hash('sha256',json_encode([$s['connectionId']??'',$s['clientHash']??''],JSON_THROW_ON_ERROR));}
/** Public evidence only. Loading a dashboard must never contact a provider. */
function n80_mcp_status(array $s,bool $authorized=true):array {
 $m=$s['mcp']??[];$same=$authorized&&!empty($s['tokens'])&&($m['connectionHash']??'')===n80_mcp_identity($s);
 $at=$same?(int)($m['verifiedAt']??0):0;$selected=$same&&($s['transport']??'rest')==='mcp';
 $error=$same?($m['lastError']??null):null;
 return ['module'=>'N80 MCP','provider'=>'notebook','transport'=>$selected?'mcp':'rest',
  'state'=>!$authorized||empty($s['tokens'])?'authorization_required':($error?'check_required':(!$same||!$at?'not_verified':($at>time()-3600?'connected':'verification_required'))),
  'verifiedAt'=>$at?:null,'lastError'=>$error,'tools'=>$same?($m['tools']??[]):[],
  'protocol'=>N80_MCP_PROTOCOL,'lastCall'=>$same?($m['lastCall']??null):null,
  'unsupported'=>['query','image_generation','video_generation'],'automaticRetry'=>false];
}
/** A Streamable HTTP server may respond with JSON or SSE. Discard event envelopes only. */
function n80_mcp_decode(string $raw,int $code,int $error=0):array {
 if($error!==0||$code<200||$code>=300)return n80_notebook_response($raw,$code,$error);
 if(strlen($raw)>2097152)throw new RuntimeException('notebook_response_too_large');
 $json=json_decode($raw,true);if(is_array($json)&&!array_is_list($json))return $json;
 $responses=[];
 foreach(preg_split('/\r?\n\r?\n/',trim($raw))as $event){
  $data=[];foreach(preg_split('/\r?\n/',$event)as $line)if(str_starts_with($line,'data:'))$data[]=substr($line,5);
  if(!$data)continue;$value=json_decode(implode("\n",$data),true);
  if(!is_array($value))throw new RuntimeException('notebook_mcp_response_invalid');
  if(array_key_exists('id',$value))$responses[]=$value;
 }
 if(count($responses)!==1)throw new RuntimeException('notebook_mcp_response_invalid');return $responses[0];
}
function n80_mcp_rpc(array &$s,string $method,array $params=[]):array {
 if(!in_array($method,['tools/list','tools/call'],true))throw new InvalidArgumentException('notebook_mcp_method_denied');
 $provider=n80_mcp_providers()['notebook'];$name=$params['name']??null;
 if($method==='tools/call'&&(!is_string($name)||!in_array($name,$provider['tools'],true)))throw new InvalidArgumentException('notebook_mcp_tool_denied');
 $id=bin2hex(random_bytes(16));$params['_meta']=['io.modelcontextprotocol/protocolVersion'=>N80_MCP_PROTOCOL];
 $headers=['Authorization: Bearer '.n80_notebook_token($s),'Content-Type: application/json','Accept: application/json, text/event-stream',
  'MCP-Protocol-Version: '.N80_MCP_PROTOCOL,'Mcp-Method: '.$method];
 if($method==='tools/call')$headers[]='Mcp-Name: '.$name;
 $envelope=['jsonrpc'=>'2.0','id'=>$id,'method'=>$method,'params'=>$params];
 $r=n80_notebook_http($provider['endpoint'],'POST',$headers,json_encode($envelope,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),'mcp');
 if(($r['jsonrpc']??null)!=='2.0'||($r['id']??null)!==$id||isset($r['result'],$r['error']))throw new RuntimeException('notebook_mcp_response_invalid');
 if(isset($r['error'])){
  $code=$r['error']['code']??null;
  if(in_array($code,[-32600,-32601,-32602],true))throw new DomainException('notebook_mcp_request_rejected');
  throw new RuntimeException('notebook_mcp_result_unconfirmed');
 }
 if(!isset($r['result'])||!is_array($r['result']))throw new RuntimeException('notebook_mcp_response_invalid');
 return $r['result'];
}
function n80_mcp_tools(array &$s):array {
 $tools=[];$cursor='';$seen=[];$schemas=[];
 for($page=0;$page<2;$page++){
  $r=n80_mcp_rpc($s,'tools/list',$cursor!==''?['cursor'=>$cursor]:[]);
  if(!isset($r['tools'])||!is_array($r['tools'])||!array_is_list($r['tools'])||count($r['tools'])>64)throw new RuntimeException('notebook_mcp_response_invalid');
  foreach($r['tools']as $tool){
   if(!is_array($tool)||!is_string($tool['name']??null)||!is_array($tool['inputSchema']??null))throw new RuntimeException('notebook_mcp_response_invalid');
   $name=$tool['name'];if(!in_array($name,n80_mcp_providers()['notebook']['tools'],true))continue;
   if(isset($schemas[$name]))throw new RuntimeException('notebook_mcp_response_invalid');
   $schemas[$name]=$tool['inputSchema'];$tools[]=$name;
  }
  $cursor=$r['nextCursor']??'';if(!is_string($cursor)||strlen($cursor)>4096)throw new RuntimeException('notebook_mcp_response_invalid');
  if($cursor==='')break;if(isset($seen[$cursor]))throw new RuntimeException('notebook_mcp_response_invalid');$seen[$cursor]=true;
 }
 if($cursor!=='')throw new RuntimeException('notebook_mcp_catalog_incomplete');
 if(array_diff(n80_mcp_providers()['notebook']['tools'],$tools))throw new DomainException('notebook_mcp_tools_missing');
 sort($tools);ksort($schemas);return ['tools'=>$tools,'schemaSha256'=>hash('sha256',json_encode($schemas,JSON_THROW_ON_ERROR))];
}
/** Return data only; provider instructions/text are never executable N80 actions. */
function n80_mcp_call(array &$s,string $name,array $arguments):array {
 $r=n80_mcp_rpc($s,'tools/call',['name'=>$name,'arguments'=>$arguments?:new stdClass()]);
 if(($r['isError']??false)!==false)throw new RuntimeException('notebook_mcp_tool_failed');
 $data=$r['structuredContent']??null;
 if(!is_array($data)){
  $values=[];foreach($r['content']??[]as $block)if(is_array($block)&&($block['type']??'')==='text'){
   $decoded=json_decode((string)($block['text']??''),true);if(is_array($decoded))$values[]=$decoded;
  }
  if(count($values)!==1)throw new RuntimeException('notebook_mcp_response_invalid');$data=$values[0];
 }
 if($name==='list_notebooks'||$name==='list_sources'){
  $key=$name==='list_notebooks'?'notebooks':'sources';$rows=$data[$key]??[];
  if(!is_array($rows)||!array_is_list($rows)||count($rows)>100)throw new RuntimeException('notebook_mcp_response_invalid');
  foreach($rows as $row){
   if(!is_array($row)||!is_string($row['name']??null))throw new RuntimeException('notebook_mcp_response_invalid');
   try{n80_notebook_resource($row['name'],$key==='sources');}catch(Throwable $e){throw new RuntimeException('notebook_mcp_response_invalid');}
  }
  $next=$data['nextPageToken']??'';if(!is_string($next)||strlen($next)>4096)throw new RuntimeException('notebook_mcp_response_invalid');
 }elseif(!is_string($data['name']??null))throw new RuntimeException('notebook_mcp_response_invalid');
 return $data;
}
/** Map the existing Notebook owner to MCP. There is deliberately no REST retry on failure. */
function n80_mcp_notebook_request(array &$s,string $method,string $path,?array $body,array $query):array {
 $name='';$args=[];
 if($path==='notebooks'){
  if($method==='GET'){$name='list_notebooks';$args=$query;}
  elseif($method==='POST'){$name='create_notebook';$args=['notebook'=>$body];}
 }elseif(str_ends_with($path,'/sources')){
  $parent=n80_notebook_resource(substr($path,0,-8));
  if($method==='GET'){$name='list_sources';$args=['parent'=>$parent]+$query;}
  elseif($method==='POST'){$name='create_source';$args=['parent'=>$parent,'source'=>$body];}
 }elseif(str_contains($path,'/sources/')){
  if($method==='GET'){$name='get_source';$args=['name'=>n80_notebook_resource($path,true)];}
 }else{
  $resource=n80_notebook_resource($path);
  if($method==='GET'){$name='get_notebook';$args=['name'=>$resource];}
  elseif($method==='PATCH'){$name='update_notebook';$args=['notebook'=>['name'=>$resource]+($body??[]),'updateMask'=>'displayName'];}
 }
 if($name==='')throw new InvalidArgumentException('notebook_mcp_method_denied');
 if(!in_array($name,$s['mcp']['tools']??[],true))throw new DomainException('notebook_mcp_tools_missing');
 try{
  $data=n80_mcp_call($s,$name,$args);
  if(!in_array($name,['list_notebooks','list_sources'],true)){
   try{n80_notebook_resource($data['name'],in_array($name,['get_source','create_source'],true));}catch(Throwable $e){throw new RuntimeException('notebook_mcp_response_invalid');}
   if(in_array($name,['get_notebook','get_source','update_notebook'],true)&&$data['name']!==$path)throw new RuntimeException('notebook_mcp_response_invalid');
   if($name==='create_source'&&!str_starts_with($data['name'],$path.'/'))throw new RuntimeException('notebook_mcp_response_invalid');
  }
  $s['mcp']['lastCall']=['tool'=>$name,'state'=>'verified','at'=>time(),'resultSha256'=>hash('sha256',json_encode($data,JSON_THROW_ON_ERROR))];
  $s['mcp']['verifiedAt']=time();unset($s['mcp']['lastError']);n80_notebook_write($s);return $data;
 }catch(Throwable $e){
  $s['mcp']['lastError']=n80_notebook_error($e);$s['mcp']['lastCall']=['tool'=>$name,'state'=>'failed','at'=>time()];n80_notebook_write($s);throw $e;
 }
}
/** Read-only provider probe; activate only after catalog and a real tool response validate. */
function n80_mcp_check(array &$s):array {
 $identity=n80_mcp_identity($s);
 try{
  $catalog=n80_mcp_tools($s);$r=n80_mcp_call($s,'list_notebooks',['pageSize'=>1]);
  $s['mcp']=$catalog+['connectionHash'=>$identity,'verifiedAt'=>time(),
   'lastCall'=>['tool'=>'list_notebooks','state'=>'verified','at'=>time(),'resultSha256'=>hash('sha256',json_encode($r,JSON_THROW_ON_ERROR))]];
  if(($s['transport']??'rest')!=='mcp')$s['revision']=($s['revision']??0)+1;
  $s['transport']='mcp';$s['verifiedAt']=time();unset($s['lastError']);n80_notebook_write($s);
  return ['mcp'=>n80_mcp_status($s),'notebooks'=>array_map('n80_notebook_public_item',$r['notebooks']??[])];
 }catch(Throwable $e){
  if(($s['mcp']['connectionHash']??'')!==$identity)$s['mcp']=['connectionHash'=>$identity];
  $s['mcp']['lastError']=n80_notebook_error($e);n80_notebook_write($s);throw $e;
 }
}
