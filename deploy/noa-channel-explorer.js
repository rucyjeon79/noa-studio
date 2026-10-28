/* Owner-scoped channel tree. Keys and explicit aliases identify songs, never titles. */
((root)=>{'use strict';
const groups=[['original','오리지널송',['kpop-original','jpop-original','pop-original','thai-original']],['ep','EP 컬렉션',['joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop']],['story','당신의 이야기, 우리의 음악',['your-story']],['cover','AInoa 유명곡 커버',['cover-reborn']]];
function build(records,title='내 채널'){
 const channel={id:'channel',type:'channel',label:title,children:[]},categories=new Map(),genres=new Map();
 const folder=(parent,id,label,type,extra={})=>{const n={id,label,type,children:[],...extra};parent.children.push(n);return n;};
 const genreNode=g=>{if(genres.has(g))return genres.get(g);const group=groups.find(v=>v[2].includes(g))||['unclassified','미분류',[]];let category=categories.get(group[0]);if(!category){category=folder(channel,'category:'+group[0],group[1],'category');categories.set(group[0],category);}const n=folder(category,'genre:'+g,g||'미지정 장르','genre',{genre:g});genres.set(g,n);return n;};
 const lists=records.filter(r=>r.kind==='playlist'),songs=records.filter(r=>r.kind!=='playlist'),buckets=new Map();
 for(const list of lists){const parent=genreNode(list.genre||'');buckets.set(list.key,folder(parent,'collection:'+list.key,list.title,'collection',{record:list}));}
 for(const song of songs){const parent=genreNode(song.genre||''),keys=new Set(song.aliases||[song.key]);let matches=lists.filter(l=>l.genre===song.genre&&(l.members||[]).some(m=>keys.has(m.key)));
  // Legacy ACTs express membership through their numbered EP range.
  if(!matches.length&&Number(song.ep)>0)matches=lists.filter(l=>l.genre===song.genre&&Number(l.act)>0&&!(l.members||[]).length&&Number(l.act)===Math.ceil(Number(song.ep)/10));
  let targets=matches.map(l=>buckets.get(l.key));if(!targets.length){const id=parent.id+':unclassified';let bucket=buckets.get(id);if(!bucket){bucket=folder(parent,id,'미분류곡','unclassified');buckets.set(id,bucket);}targets=[bucket];}
  for(const target of targets)target.children.push({id:target.id+':'+song.key,type:'song',label:song.title,record:song});
 }
 const order=new Map(groups.map((g,i)=>['category:'+g[0],i]));channel.children.sort((a,b)=>(order.get(a.id)??99)-(order.get(b.id)??99));
 for(const category of channel.children)for(const genre of category.children){genre.children.sort((a,b)=>a.type==='unclassified'?1:b.type==='unclassified'?-1:(Number(a.record?.act)||999)-(Number(b.record?.act)||999)||a.label.localeCompare(b.label,'ko'));for(const bucket of genre.children)bucket.children.sort((a,b)=>(Number(a.record.ep)||9999)-(Number(b.record.ep)||9999)||a.label.localeCompare(b.label,'ko'));}
 return channel;
}
function mount(host,{records,title,names={},onEdit,onChannel,onRules}){
 const previous=new Set([...host.querySelectorAll('[data-node][aria-expanded="true"]')].map(b=>b.dataset.node));const first=!host.dataset.loaded;host.dataset.loaded='true';host.replaceChildren();
 const tools=document.createElement('div');tools.className='creator-tree-tools';const all=document.createElement('button'),none=document.createElement('button');all.type=none.type='button';all.textContent='모두 펼치기';none.textContent='모두 접기';tools.append(all,none);host.append(tools);
 const tree=document.createElement('ul');tree.className='creator-tree';tree.setAttribute('aria-label','내 채널 음원 탐색기');host.append(tree);let seq=0;
 function draw(node,parent){const li=document.createElement('li'),line=document.createElement('div');line.className='creator-tree-line';li.append(line);parent.append(li);const label=document.createElement('button');label.type='button';label.className='creator-tree-label';label.textContent=node.type==='genre'?String(names[node.genre]||node.label).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim():node.label;label.title=label.textContent;
  if(node.children){const toggle=document.createElement('button'),branch=document.createElement('ul');branch.id='creator-tree-branch-'+(++seq);toggle.type='button';toggle.className='creator-tree-toggle';toggle.dataset.node=node.id;toggle.setAttribute('aria-controls',branch.id);const expanded=previous.has(node.id)||(first&&node.type==='channel');function set(open){branch.hidden=!open;toggle.textContent=open?'−':'+';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',label.textContent+' '+(open?'접기':'펼치기'));}toggle.onclick=()=>set(branch.hidden);set(expanded);line.append(toggle);li.append(branch);for(const child of node.children)draw(child,branch);
   if(node.type==='channel')label.onclick=onChannel;else if(node.record)label.onclick=()=>onEdit(node.record);else if(node.type==='unclassified')label.onclick=()=>set(branch.hidden);else label.onclick=()=>onRules(node.genre||'',node.id.replace('category:',''));
   const count=document.createElement('small');count.textContent=node.children.length+'개';line.append(label,count);if(!node.children.length){const empty=document.createElement('li');empty.className='creator-tree-empty';empty.textContent='수록곡이 없습니다.';branch.append(empty);}
  }else{line.classList.add('creator-row');line.dataset.key=node.record.key;const dot=document.createElement('span');dot.className='creator-tree-leaf';dot.textContent='·';dot.setAttribute('aria-hidden','true');line.append(dot,label);label.onclick=()=>onEdit(node.record);label.setAttribute('aria-label',node.label+' 곡정보 수정');const note=document.createElement('small');note.textContent=node.record.visibility==='public'?'공개':'나만 보기';line.append(note);}
 }
 draw(build(records,title),tree);const setAll=open=>{for(const toggle of tree.querySelectorAll('[aria-controls]'))if((toggle.getAttribute('aria-expanded')==='true')!==open)toggle.click();};all.onclick=()=>setAll(true);none.onclick=()=>setAll(false);
}
root.NoaChannelExplorer={build,mount,groups};if(typeof module!=='undefined')module.exports=root.NoaChannelExplorer;
})(typeof window!=='undefined'?window:globalThis);
