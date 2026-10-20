<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
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
 try{$db=noa_bridge_pdo();$q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$row=$q->fetch(PDO::FETCH_ASSOC);}
 catch(Throwable $e){http_response_code(503);exit('문서를 읽지 못했습니다.');}
 if(!$row||!in_array($row['kind'],['single','playlist','story'],true)){http_response_code(404);exit('음악 문서를 찾을 수 없습니다.');}
 $payload=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);$revision=(int)$row['revision'];$kind=$row['kind'];
}
$body=$payload['body']??[];
?><!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>음악 관리 | NOA STUDIO</title>
<style>:root{color-scheme:dark;--gold:#d7ad62;--line:#303036}*{box-sizing:border-box}body{margin:0;background:#090a0e;color:#f4f0e9;font:16px/1.7 system-ui}main{max-width:960px;margin:auto;padding:28px 20px}a,h1{color:var(--gold)}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;margin:14px 0}input,textarea,select{width:100%;padding:12px;background:#14151a;color:inherit;border:1px solid var(--line);border-radius:8px;font:inherit}textarea{min-height:190px}input[type=checkbox]{width:auto}button{min-height:48px;padding:12px 24px;background:var(--gold);border:0;border-radius:8px;font:inherit;cursor:pointer}.muted{color:#aaa}#result{white-space:pre-wrap}@media(max-width:650px){.fields{grid-template-columns:1fr}}</style>
<main><a href="/noa-library.php">← 라이브러리 관리</a><h1><?=$key!==''?'음악 수정':'음악 등록'?></h1><p class="muted">NOA STUDIO · 기존 원본 보존 자료는 유지하고 변경 이력을 남깁니다.</p>
<form id="editor">
<div class="fields"><label>분류<select id="kind" <?=$key!==''?'disabled':''?>><?php foreach(['single'=>'EP 싱글','playlist'=>'ACT 플레이리스트','story'=>'사연·커버곡'] as $v=>$l):?><option value="<?=$v?>" <?=$kind===$v?'selected':''?>><?=$l?></option><?php endforeach;?></select></label>
<label>장르<select id="genre" <?=$key!==''?'disabled':''?>><?php foreach($genres as $g):?><option value="<?=$g?>" <?=($payload['genreId']??'')===$g?'selected':''?>><?=$g?></option><?php endforeach;?></select></label>
<label>EP 번호<input id="ep" type="number" min="1" max="999" value="<?=noa_ed_e((string)($payload['ep']??''))?>" <?=$key!==''?'readonly':''?>></label><label>ACT 번호<input id="act" type="number" min="1" max="999" value="<?=noa_ed_e((string)($payload['act']??''))?>" <?=$key!==''?'readonly':''?>></label></div>
<label>곡 제목<input id="title" maxlength="500" required value="<?=noa_ed_e((string)($body['confirmedTitle']??$payload['title']??''))?>"></label>
<label>가사 전문<textarea id="lyrics"><?=noa_ed_e((string)($body['lyricsBlock']??''))?></textarea></label>
<label>ACT 곡 구성 및 순서<textarea id="tracklist"><?=noa_ed_e((string)($body['tracklist']??''))?></textarea></label>
<label>YouTube 주소<input id="youtube" type="url" value="<?=noa_ed_e((string)($body['youtubeUrl']??''))?>"></label>
<label>썸네일 주소<input id="thumbnail" type="url" value="<?=noa_ed_e((string)($body['thumbUrl']??''))?>"></label>
<label>캐릭터<select id="cast"><option value="">원본 값 유지</option><?php foreach(['female'=>'노아 · 여성 솔로','male'=>'노엘 · 남성 솔로','duet'=>'노아 & 노엘 · 듀엣'] as $v=>$l):?><option value="<?=$v?>" <?=($body['thumbCast']??'')===$v?'selected':''?>><?=$l?></option><?php endforeach;?></select></label>
<label><input id="confirmed" type="checkbox" <?=!empty($payload['confirmed'])?'checked':''?>> 제작 확정</label>
<p class="muted">제작 확정과 영상 공개 여부는 별도입니다. 새 영상은 공개 확인 후 감상 목록에 표시됩니다.</p>
<button type="submit" id="save">저장</button><p id="result" role="status"></p></form></main>
<script>
let key=<?=json_encode($key,JSON_HEX_TAG|JSON_HEX_APOS|JSON_HEX_QUOT)?>,kind=<?=json_encode($kind)?>,revision=<?=$revision?>;
let original=<?=json_encode($payload,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR)?>;
let lastRequest=null,requestSignature=null,checkedUrl='',checkedMedia=null;const field=id=>document.getElementById(id),newStoryId=crypto.randomUUID().replaceAll('-','').slice(0,24);
const formSnapshot=()=>JSON.stringify([...document.querySelectorAll('#editor input,#editor select,#editor textarea')].map(e=>e.type==='checkbox'?e.checked:e.value));let lastSavedSnapshot=formSnapshot();
field('editor').addEventListener('submit',async event=>{
 event.preventDefault();const status=field('result');if(key&&formSnapshot()===lastSavedSnapshot){status.textContent='변경 사항이 없습니다.';return}
 const p=structuredClone(original);p.body={...(p.body||{})};p.title=field('title').value;p.genreId=field('genre').value;p.confirmed=field('confirmed').checked;
 kind=field('kind').value;
 let writeKey=key;if(!key){const n=kind==='single'?Number(field('ep').value):Number(field('act').value);if(kind!=='story'&&(!Number.isInteger(n)||n<1||n>999)){status.textContent='EP 또는 ACT 번호를 확인해 주세요.';return}
  writeKey=kind+':'+p.genreId+':'+(kind==='single'?String(n).padStart(2,'0'):kind==='playlist'?'act-'+n:newStoryId);p.ep=kind==='single'?String(n).padStart(2,'0'):null;p.act=kind==='playlist'?n:null;
 }
 p.body.confirmedTitle=p.title;p.body.lyricsBlock=field('lyrics').value;p.body.tracklist=field('tracklist').value;p.body.youtubeUrl=field('youtube').value.trim();p.body.thumbUrl=field('thumbnail').value.trim();if(field('cast').value)p.body.thumbCast=field('cast').value;
 field('save').disabled=true;
 if(p.body.youtubeUrl && p.body.youtubeUrl!==(original.body?.youtubeUrl||'')){
  try{const u=new URL(p.body.youtubeUrl);let id='';if(['youtu.be','www.youtu.be'].includes(u.hostname))id=u.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))id=u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1]||'';
   if(!/^[A-Za-z0-9_-]{11}$/.test(id)){status.textContent='YouTube 영상 주소를 확인해 주세요.';field('save').disabled=false;return}
   if(checkedUrl!==p.body.youtubeUrl){status.textContent='영상 공개 상태를 확인하는 중입니다.';const check=await fetch('/noa-bridge/check-media.php?video='+id,{credentials:'same-origin'});if(!check.ok)throw new Error('verification');checkedMedia=await check.json();checkedUrl=p.body.youtubeUrl}p.mediaAvailability=checkedMedia;
  }catch{status.textContent='영상 주소를 확인하지 못했습니다. 잠시 후 다시 저장해 주세요.';field('save').disabled=false;return}
 }
 const signature=JSON.stringify({writeKey,kind,revision,p});if(signature!==requestSignature){requestSignature=signature;lastRequest=crypto.randomUUID()}
 field('save').disabled=true;status.textContent='저장 중입니다.';
 try{const response=await fetch('/noa-bridge/index.php?key='+encodeURIComponent(writeKey),{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:JSON.stringify({kind,expectedRevision:revision,requestId:lastRequest,payload:p})});const data=await response.json();if(!response.ok){status.textContent=response.status===409?'동일한 문서가 이미 있거나 다른 곳에서 수정됐습니다. 새로고침 후 확인해 주세요.':'저장하지 못했습니다. 로그인과 연결 상태를 확인해 주세요.';return}
 key=writeKey;revision=data.revision;original=p;lastSavedSnapshot=formSnapshot();status.textContent='저장 완료 · 버전 '+revision;history.replaceState(null,'','?key='+encodeURIComponent(key));for(const id of ['kind','genre'])field(id).disabled=true;for(const id of ['ep','act'])field(id).readOnly=true;
 }catch{status.textContent='서버 응답을 확인하지 못했습니다. 같은 내용으로 다시 저장하면 중복 요청을 방지합니다.'}finally{field('save').disabled=false}
});
</script></html>
