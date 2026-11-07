/* Owner-scoped channel tree. Keys and explicit aliases identify songs, never titles. */
((root)=>{'use strict';
if(root.N80Explorer)return;
const groups=[['original','오리지널송',['kpop-original','jpop-original','pop-original','thai-original']],['ep','EP 컬렉션',['joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop']],['story','당신의 이야기, 우리의 음악',['your-story']],['cover','AInoa 유명곡 커버',['cover-reborn']]];
function build(records,title='내 채널',{groupActs=false}={}){
 const channel={id:'channel',type:'channel',label:title,children:[]},categories=new Map(),genres=new Map();
 const folder=(parent,id,label,type,extra={})=>{const n={id,label,type,children:[],...extra};parent.children.push(n);return n;};
 const genreNode=g=>{if(genres.has(g))return genres.get(g);const group=groups.find(v=>v[2].includes(g))||['unclassified','미분류',[]];let category=categories.get(group[0]);if(!category){category=folder(channel,'category:'+group[0],group[1],'category');categories.set(group[0],category);}const n=folder(category,'genre:'+g,g||'미지정 장르','genre',{genre:g});genres.set(g,n);return n;};
 const lists=records.filter(r=>r.kind==='playlist'),songs=records.filter(r=>r.kind!=='playlist'),buckets=new Map();
 const byGenre = new Map(),declaredActs=new Set(lists.map(list=>(list.genre||'')+':'+Number(list.act)));
 for (const list of lists) {
  const genre = list.genre || '';
  let index = byGenre.get(genre);
  if (!index) { index = {members:new Map(), acts:new Map()}; byGenre.set(genre,index); }
  buckets.set(list.key, folder(genreNode(genre),'collection:'+list.key,list.title,'collection',{record:list}));
  if (list.members?.length) {
   for (const member of list.members) {
    if (!member?.key) continue;
    if (!index.members.has(member.key)) index.members.set(member.key,[]);
    index.members.get(member.key).push(list.key);
   }
  } else if (Number(list.act)>0) {
   const act=Number(list.act);
   if (!index.acts.has(act)) index.acts.set(act,[]);
   index.acts.get(act).push(list.key);
  }
 }
 for (const song of songs) {
  const parent=genreNode(song.genre||''), index=byGenre.get(song.genre||''), matches=new Set();
  for (const key of song.aliases || [song.key]) {
   for (const listKey of index?.members.get(key) || []) matches.add(listKey);
  }
  if (!matches.size && Number(song.ep)>0) {
   for (const listKey of index?.acts.get(Math.ceil(Number(song.ep)/10)) || []) matches.add(listKey);
  }
  let targets=Array.from(matches,key=>buckets.get(key));
  const act=Math.ceil(Number(song.ep)/10);
  if(groupActs&&!targets.length&&act>0&&!['your-story','cover-reborn'].includes(song.genre)&&!declaredActs.has((song.genre||'')+':'+act)){
   const id=parent.id+':act:'+act;
   if(!buckets.has(id))buckets.set(id,folder(parent,id,'ACT '+act,'act',{act}));
   targets=[buckets.get(id)];
  }
  if(!targets.length){const id=parent.id+':unclassified';let bucket=buckets.get(id);if(!bucket){bucket=folder(parent,id,'미분류곡','unclassified');buckets.set(id,bucket);}targets=[bucket];}
  for(const target of targets)target.children.push({id:target.id+':'+song.key,type:'song',label:song.title,record:song});
 }
 const order=new Map(groups.map((g,i)=>['category:'+g[0],i]));channel.children.sort((a,b)=>(order.get(a.id)??99)-(order.get(b.id)??99));
 for(const category of channel.children)for(const genre of category.children){genre.children.sort((a,b)=>a.type==='unclassified'?1:b.type==='unclassified'?-1:(Number(a.record?.act||a.act)||999)-(Number(b.record?.act||b.act)||999)||a.label.localeCompare(b.label,'ko'));for(const bucket of genre.children)bucket.children.sort((a,b)=>(Number(a.record.ep)||9999)-(Number(b.record.ep)||9999)||a.label.localeCompare(b.label,'ko'));}
 return channel;
}
function songKeys(node){
 if(!node.children)return [node.record.key];
 return Array.from(new Set(node.children.flatMap(songKeys)));
}
function mount(host,{records,title,names={},onEdit,onChannel,onRules,selection=null}){
 styles();
 const previous=new Set([...host.querySelectorAll('[data-node][aria-expanded="true"]')].map(b=>b.dataset.node));const first=!host.dataset.loaded;host.dataset.loaded='true';host.replaceChildren();
 const tools=document.createElement('div');tools.className='creator-tree-tools';const all=document.createElement('button'),none=document.createElement('button');all.type=none.type='button';all.textContent='모두 펼치기';none.textContent='모두 접기';tools.append(all,none);host.append(tools);
 const tree=document.createElement('ul');tree.className='creator-tree';tree.setAttribute('aria-label','N80 탐색기 · 내 채널');host.append(tree);let seq=0;
 const checks=[];
 const searchInput=document.createElement('input');searchInput.type='search';searchInput.className='creator-tree-search';searchInput.placeholder='N80 탐색기 · 제목 · 장르 · EP · ACT';searchInput.setAttribute('aria-label','내 채널 곡 검색');tools.after(searchInput);
 const entries=index(records),source=build(records,title,{groupActs:!!selection});let searching=false;
 function syncChecks(){
  for(const {box,keys} of checks){
   const count=keys.reduce((sum,key)=>sum+Number(selection.keys.has(key)),0);
   box.checked=keys.length>0&&count===keys.length;
   box.indeterminate=count>0&&count<keys.length;
  }
 }
 function checkbox(line,node,label){
  const keys=songKeys(node),wrapper=document.createElement('label'),box=document.createElement('input');
  wrapper.className='creator-batch-check';box.type='checkbox';box.disabled=!keys.length;
  box.setAttribute('aria-label',label.textContent+' 선택');box.dataset.batchNode=node.id;
  wrapper.append(box);line.prepend(wrapper);checks.push({keys,box});
  box.onchange=()=>{for(const key of keys){if(box.checked)selection.keys.add(key);else selection.keys.delete(key);}syncChecks();selection.changed();};
  const count=keys.filter(key=>selection.keys.has(key)).length;box.checked=keys.length>0&&count===keys.length;box.indeterminate=count>0&&count<keys.length;
  label.setAttribute('aria-label',label.textContent+(node.children?' 하위 목록 펼치기·접기':' 선택 전환'));
  label.onclick=node.children?()=>line.querySelector('.creator-tree-toggle')?.click():()=>box.click();
 }

 function draw(node,parent){const li=document.createElement('li'),line=document.createElement('div');line.className='creator-tree-line';li.append(line);parent.append(li);const label=document.createElement('button');label.type='button';label.className='creator-tree-label';label.textContent=node.type==='genre'?String(names[node.genre]||node.label).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim():node.label;label.title=label.textContent;
  if(node.children){const toggle=document.createElement('button'),branch=document.createElement('ul');branch.id='creator-tree-branch-'+(++seq);toggle.type='button';toggle.className='creator-tree-toggle';toggle.dataset.node=node.id;toggle.setAttribute('aria-controls',branch.id);const expanded=searching||previous.has(node.id)||(first&&node.type==='channel');let drawn=false;
   function set(open){
    if(open&&!drawn){drawn=true;for(const child of node.children)draw(child,branch);}
    branch.hidden=!open;toggle.textContent=open?'−':'+';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',label.textContent+' '+(open?'접기':'펼치기'));}toggle.onclick=()=>set(branch.hidden);set(expanded);line.append(toggle);li.append(branch);
   if(node.type==='channel')label.onclick=onChannel;else if(node.record)label.onclick=()=>onEdit(node.record);else if(node.type==='unclassified'||node.type==='act')label.onclick=()=>set(branch.hidden);else label.onclick=()=>onRules(node.genre||'',node.id.replace('category:',''));
   const count=document.createElement('small');count.textContent=node.children.length+'개';line.append(label,count);if(!node.children.length){const empty=document.createElement('li');empty.className='creator-tree-empty';empty.textContent='수록곡이 없습니다.';branch.append(empty);}
  }else{line.classList.add('creator-row');line.dataset.key=node.record.key;const dot=document.createElement('span');dot.className='creator-tree-leaf';dot.textContent='·';dot.setAttribute('aria-hidden','true');line.append(dot,label);label.onclick=()=>onEdit(node.record);label.setAttribute('aria-label',node.label+' 곡정보 수정');const note=document.createElement('small');note.textContent=node.record.visibility==='public'?'공개':'나만 보기';line.append(note);}
  if(selection)checkbox(line,node,label);
 }
 function renderTree(){
  if(!searching)for(const toggle of tree.querySelectorAll('[data-node]')){if(toggle.getAttribute('aria-expanded')==='true')previous.add(toggle.dataset.node);else previous.delete(toggle.dataset.node);}
  searching=!!searchInput.value.trim();const matches=new Set(filter(entries,searchInput.value).map(entry=>entry.key));
  function prune(node){if(!searching||node.record&&matches.has(node.record.key))return node;if(!node.children)return null;const children=node.children.map(prune).filter(Boolean);return children.length?{...node,children}:null;}
  tree.replaceChildren();checks.length=0;const filtered=prune(source);if(filtered)draw(filtered,tree);else{const empty=document.createElement('li');empty.textContent='검색 결과가 없습니다.';tree.append(empty);}
 }
 searchInput.oninput=renderTree;searchInput.onkeydown=event=>{if(event.key==='Enter')event.preventDefault();};renderTree();const setAll=open=>{for(const toggle of tree.getElementsByClassName('creator-tree-toggle'))if((toggle.getAttribute('aria-expanded')==='true')!==open)toggle.click();};all.onclick=()=>setAll(true);none.onclick=()=>setAll(false);
}
// The catalog promise belongs to this page and to one access scope.
// A failed read is discarded so every desk can retry without a page reload.
const catalogs=new Map();
async function readRecords(scope){
 const owner=scope==='channel';
 const response=await fetch(owner?'/noa-bridge/creator.php?action=choices&view=explorer':'/noa-bridge/catalog.php?view=labChoices',{
  credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error('catalog_unavailable');
 const data=await response.json(),rows=owner?data.songs:data.items;
 if((!owner&&data.access!=='administrator')||!Array.isArray(rows))throw Error('catalog_unavailable');
 return rows;
}
function catalog(scope){
 if(!catalogs.has(scope))catalogs.set(scope,readRecords(scope).catch(error=>{catalogs.delete(scope);throw error;}));
 return catalogs.get(scope);
}
function searchText(value){
 return String(value).normalize('NFKC').toLocaleLowerCase('ko').replace(/(?:^|\b)(ep|act)[.\s-]*0*(\d+)/gi,'$1$2').trim();
}
function picker(host,{scope='library',songsOnly=false,onReady,canChoose=()=>true}={}){
 const fields=host.querySelector('fieldset'),search=fields.querySelector('input'),select=fields.querySelector('select');
 const status=host.querySelector('[role=status]'),retry=host.querySelector('button'),current=host.querySelector('[data-n80-current]');
 const placeholder=select.options[0].textContent;
 const collator=new Intl.Collator('ko',{numeric:true});
 let entries=null,loading=false;
 function controls(){fields.disabled=!entries?.length||!canChoose();retry.disabled=loading||!canChoose();}
 function render(){
  const key=select.value,matching=new Set(filter(entries,search.value).map(entry=>entry.key)),groups=new Map();
  select.replaceChildren(new Option(placeholder,''));
  let count=0;
  for(const entry of entries){
   const matches=matching.has(entry.key);
   // Keep the submitted value while the user searches for a replacement.
   if(!matches&&entry.key!==key)continue;
   if(matches)count++;
   if(!groups.has(entry.group)){
    const optgroup=document.createElement('optgroup');optgroup.label=entry.group;groups.set(entry.group,optgroup);select.append(optgroup);
   }
   groups.get(entry.group).append(new Option(entry.label,entry.key));
  }
  select.value=key;
  status.textContent=count?count+'개 항목':(search.value.trim()?'검색 결과가 없습니다.':'등록된 곡이 없습니다.');
 }
 async function open(){
  if(entries||loading)return;
  loading=true;retry.hidden=true;controls();status.textContent='목록을 불러오는 중입니다.';
  try{
   const [rows]=await Promise.all([catalog(scope),root.NoaBrowse?null:import('/noa-browse.js')]);
   const items=rows.filter(row=>row.key&&(!songsOnly||['single','story'].includes(row.kind)));
   const next=items.map(row=>{
    const path=root.NoaBrowse.classification(row);
    const group=path.slice(0,3).map(level=>level.value).join(' / '),label=path[3].value;
    return {key:row.key,label,group,ep:Number(row.ep)||0,text:searchText([group,label,row.genre].join(' '))};
   }).sort((a,b)=>collator.compare(a.group,b.group)||a.ep-b.ep||collator.compare(a.label,b.label));
   if(onReady)await onReady(items);
   entries=next;render();
  }catch{status.textContent='목록을 불러오지 못했습니다. 다시 시도해 주세요.';retry.hidden=false;}
  finally{loading=false;controls();}
 }
 select.addEventListener('change',()=>{current.textContent=select.value?' · '+select.selectedOptions[0].textContent:'';});
 search.addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault();});
 search.addEventListener('input',()=>{if(entries)render();});
 host.addEventListener('toggle',()=>{if(host.open)open();});retry.onclick=open;
 if(host.open)open();
 return {controls};
}
// Consumers supply their authorized candidates. Selection never changes identity or saves data.
function index(records){
 const seen=new Set(),entries=[],labels=new Map();
 for(const row of records){
  if(!row||typeof row.key!=='string'||!row.key||seen.has(row.key))continue;
  seen.add(row.key);
  const act=Number(row.act)||Math.ceil(Number(row.ep)/10)||0;
  const category=groups.find(group=>group[2].includes(row.genre))?.[1]||'';
  const genre=root.NoaBrowse?.names?.[row.genre]||row.genre||'';
  const context=[category,genre,row.ep?'EP '+Number(row.ep):'',act?'ACT '+act:'',row.language,row.version||row.version_name].filter(Boolean).join(' · ');
  const label=row.title||row.key,signature=label+' '+context;
  labels.set(signature,(labels.get(signature)||0)+1);
  entries.push({key:row.key,row,label,context,signature,text:searchText([label,context,row.genre,row.snippet,row.key].join(' '))});
 }
 for(const entry of entries)if(labels.get(entry.signature)>1)entry.context+=(entry.context?' · ':'')+entry.key;
 return entries;
}

function filter(entries,query){
 const terms=searchText(query).split(/\s+/).filter(Boolean);
 return entries.filter(entry=>terms.every(term=>entry.text.includes(term)||entry.text.replace(/\s+/g,'').includes(term)));
}
function results(host,{records,onSelect,links=false,className='n80-result',selected=()=>false}={}){
 host.replaceChildren();
 for(const entry of index(records)){
  const node=element(links?'a':'button',undefined,className);
  if(links)node.href=entry.row.url;
  else{node.dataset.n80Key=entry.key;node.setAttribute('aria-pressed',String(selected(entry.key)));}
  node.append(element('strong',entry.label),element('small',[entry.context,entry.row.snippet].filter(Boolean).join(' · ')));
  node.onclick=event=>onSelect?.(entry.row,event);host.append(node);
 }
}
function styles(){
 if(document.querySelector('link[data-n80-styles],link[href^="/noa-explorer.css"]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='/noa-explorer.css?v=n80-unified-20261107';link.dataset.n80Styles='';document.head.append(link);
}
function element(tag,text,className){
 const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;
 if(tag==='button')node.type='button';return node;
}
// Remote search keeps its server-side access and eligibility checks. Stale responses cannot replace newer results.
function search(host,{records,load,query='',minimum=0,onSelect,selected=()=>false}={}){
 styles();host.classList.add('n80-search');
 const form=element('div',undefined,'n80-search-bar'),input=element('input'),submit=element('button','검색');
 input.type='search';input.maxLength=120;input.value=query;input.placeholder='제목 · 장르 · EP · ACT';input.setAttribute('aria-label','N80 탐색기 검색');
 const status=element('p'),list=element('div',undefined,'n80-results'),more=element('button','더 보기');
 status.setAttribute('role','status');form.append(input,submit);host.replaceChildren(form,status,list,more);
 let entries=records?index(records):[],visible=[],limit=40,sequence=0,disposed=false,timer=null,loaded=!!records;
 function render(){
  results(list,{records:visible.slice(0,limit).map(entry=>entry.row),onSelect,selected});
  more.hidden=visible.length<=limit;
  status.textContent=visible.length?visible.length+'개 항목':'검색 결과가 없습니다.';
 }
 async function run(){
  const request=++sequence;clearTimeout(timer);limit=40;
  if(input.value.trim().length<minimum){list.replaceChildren();more.hidden=true;status.textContent=minimum+'글자 이상 입력해 주세요.';return;}
  if(load){
   status.textContent='목록을 불러오는 중입니다.';list.replaceChildren();more.hidden=true;
   try{const rows=await load(input.value.trim());if(disposed||request!==sequence)return;entries=index(rows);loaded=true;}
   catch(error){if(disposed||request!==sequence)return;status.textContent=error.message||'목록을 불러오지 못했습니다. 검색을 눌러 다시 시도해 주세요.';return;}
  }
  if(disposed||request!==sequence)return;
  visible=load?entries:filter(entries,input.value);render();
 }
 submit.onclick=run;
 input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();run();}};
 input.oninput=()=>{++sequence;clearTimeout(timer);if(load)timer=setTimeout(run,250);else run();};
 more.onclick=()=>{limit+=40;render();};
 run();
 return {input,refresh:render,loaded:()=>loaded,destroy(){disposed=true;++sequence;clearTimeout(timer);}};
}
async function choose({records,load,scope,selected=[],multiple=false,title='곡 선택',minimum=0}={}){
 styles();
 // A dialog invocation owns its selection and request lifetime, including nested editor dialogs.
 const dialog=element('dialog',undefined,'n80-dialog'),heading=element('h2','N80 탐색기 · '+title),close=element('button','닫기'),host=element('div'),footer=element('div',undefined,'n80-selection');
 const selection=new Map(selected.map(row=>typeof row==='string'?[row,{key:row,title:row}]:[row.key,row]));
 const chosen=element('div'),apply=element('button','선택 적용');
 dialog.setAttribute('aria-label','N80 탐색기 · '+title);dialog.append(close,heading,host);
 if(multiple){footer.append(chosen,apply);dialog.append(footer);}
 document.body.append(dialog);dialog.showModal();
 let controller,done=false;
 return new Promise(resolve=>{
  function finish(value){if(done)return;done=true;controller?.destroy();dialog.close();dialog.remove();resolve(value);}
  close.onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  dialog.addEventListener('close',()=>finish(null));
  function showSelection(){
   chosen.replaceChildren();
   for(const [key,row] of selection){const remove=element('button',row.title+' ×');remove.setAttribute('aria-label',row.title+' 선택 해제');remove.onclick=()=>{selection.delete(key);showSelection();controller?.refresh();};chosen.append(remove);}
   apply.textContent=selection.size+'개 선택 적용';
  }
  function onSelect(row){if(!multiple){finish(row);return;}if(selection.has(row.key))selection.delete(row.key);else selection.set(row.key,row);showSelection();controller.refresh();}
  apply.onclick=()=>{if(controller?.loaded())finish([...selection.values()]);};
  async function start(){
   try{
    const rows=records??(scope?await catalog(scope):undefined);if(done)return;
    controller=search(host,{records:rows,load,minimum,onSelect,selected:key=>selection.has(key)});
    showSelection();controller.input.focus();
   }catch{host.textContent='목록을 불러오지 못했습니다. 닫은 뒤 다시 시도해 주세요.';apply.disabled=true;}
  }
  start();
 });
}

root.N80Explorer={build,mount,groups,songKeys,picker,index,filter,results,search,choose};
root.NoaChannelExplorer=root.N80Explorer;
if(typeof module!=='undefined')module.exports=root.N80Explorer;
})(typeof window!=='undefined'?window:globalThis);
