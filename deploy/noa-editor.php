<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/inline-edit.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('최고관리자 로그인이 필요합니다.');}
function noa_ed_e(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];
$key=$_GET['key']??'';$row=null;$revision=0;$kind='single';$payload=['genreId'=>'kpop-original','title'=>'','ep'=>'','act'=>null,'confirmed'=>false,'body'=>[]];
if(!is_string($key)||($key!==''&&!preg_match('/^[a-z0-9][a-z0-9:_-]{0,190}$/D',$key))){http_response_code(400);exit('잘못된 문서 키입니다.');}
if($key!==''){
 try{$db=noa_bridge_pdo();$resolved=nie_resolve($db,['type'=>'song','source'=>'music','key'=>$key]);$row=['kind'=>$resolved['kind'],'payload'=>json_encode($resolved['payload'],JSON_THROW_ON_ERROR),'revision'=>$resolved['revision']];}
 catch(DomainException $e){http_response_code(409);exit('곡 연결이 없거나 여러 원본에 연결되어 있습니다. 통합 라이브러리에서 연결 상태를 확인하세요.');}catch(Throwable $e){http_response_code(503);exit('문서를 읽지 못했습니다.');}
 if(!$row||!in_array($row['kind'],['single','playlist','story'],true)){http_response_code(404);exit('음악 문서를 찾을 수 없습니다.');}
 $payload=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);$revision=(int)$row['revision'];$kind=$row['kind'];
}
$draft=null;$draftId=(string)($_GET['draft']??'');
if($draftId!==''){require_once __DIR__.'/noa-bridge/lab-core.php';try{$draftId=lab_id($draftId);$draft=lab_read()['jobs'][$draftId]??null;if(!$draft||$draft['state']!=='creation_review'||($draft['trackKey']??'')!==$key)throw new DomainException('draft_mismatch');if($key!==''&&$draft['sourceRevision']!==$revision)throw new DomainException('source_changed');if($key==='')$payload['genreId']=$draft['genre'];}catch(Throwable $e){http_response_code(409);exit('초안의 원본 버전이 변경되었거나 초안을 찾을 수 없습니다. AI LAB에서 다시 확인하세요.');}}
require_once __DIR__.'/noa-bridge/package-record.php';
$draftFields=$draft? nup_fields(nup_normalize(array_replace($payload,['body'=>array_replace($payload['body']??[],$draft['creation']['body']??[])]),$kind)):null;
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>곡정보 편집 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script><script src="/noa-browse.js?v=<?=hash_file('sha256',__DIR__.'/noa-browse.js')?>" defer></script><script src="/noa-record-form.js?v=<?=hash_file('sha256',__DIR__.'/noa-record-form.js')?>" defer></script><script src="/noa-browse-edit.js?v=<?=hash_file('sha256',__DIR__.'/noa-browse-edit.js')?>" defer></script></head><body class="noa-page"><main><h1><?=$key!==''?'곡정보 수정':'새 곡 등록'?></h1><p class="noa-record-note">음원·YouTube·통합 라이브러리가 같은 곡정보와 저장 이력을 사용합니다.</p>
<?php if($key===''):?><form id="record-setup" class="noa-record-setup"><label>카테고리<select id="editor-category"></select></label><label>세부 장르<select id="genre"></select></label><label>문서 형식<select id="kind"><option value="single">EP 싱글</option><option value="story">사연·커버·일반 곡</option><option value="playlist">ACT·플레이리스트</option></select></label><label id="record-number-label">EP 번호<input id="record-number" type="number" min="1" max="999" value="<?=noa_ed_e((string)($payload['ep']??''))?>"></label><button type="submit">곡정보 입력</button></form><?php endif;?>
<div id="record-editor" class="noa-record-editor" role="region" aria-label="곡정보 편집"></div><p id="editor-result" role="status"></p></main>
<script>
window.addEventListener('DOMContentLoaded',()=>{
const key=<?=json_encode($key)?>,draftFields=<?=json_encode($draftFields,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR)?>,initialGenre=<?=json_encode($payload['genreId']??'kpop-original')?>,host=document.getElementById('record-editor');
const editor=window.NoaBrowseEdit.mount({host,standalone:true,onSaved:({data})=>{document.getElementById('editor-result').textContent='저장 완료 · 버전 '+data.revision;history.replaceState(null,'','?key='+encodeURIComponent(data.writeKey));const setup=document.getElementById('record-setup');if(setup)setup.hidden=true;}});
window.NoaBrowse.loadClassification().catch(()=>{});
if(key){editor.openRecord({type:'song',source:'music',key},draftFields);return;}
const setup=document.getElementById('record-setup'),category=document.getElementById('editor-category'),genre=document.getElementById('genre'),kind=document.getElementById('kind'),number=document.getElementById('record-number');
for(const [id,label]of window.NoaBrowse.groups){const o=new Option(label,id);category.append(o);}category.value=window.NoaBrowse.groupFor(initialGenre)||'original';
function updateNumber(){const numbered=kind.value==='single'||kind.value==='playlist'&&!['story','cover'].includes(category.value);document.getElementById('record-number-label').hidden=!numbered;number.required=numbered;document.getElementById('record-number-label').firstChild.textContent=kind.value==='playlist'?'ACT 번호':'EP 번호';}
function genres(){genre.replaceChildren(...window.NoaBrowse.groups.find(g=>g[0]===category.value)[2].map(g=>new Option(window.NoaBrowse.names[g],g)));kind.value=['story','cover'].includes(category.value)?'story':'single';updateNumber();}category.onchange=genres;kind.onchange=updateNumber;genres();genre.value=initialGenre;
setup.onsubmit=e=>{e.preventDefault();if(editor.isEditing()){document.getElementById('editor-result').textContent='열려 있는 곡정보를 먼저 저장해 주세요.';return;}const selector={type:'new',kind:kind.value,genre:genre.value,number:number.value,id:crypto.randomUUID().replaceAll('-','').slice(0,24)};editor.openRecord(selector,draftFields);};
});
</script></body></html>
