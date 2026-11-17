'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const js=fs.readFileSync(path.join(root,'deploy/noa-home.js'),'utf8');
const css=fs.readFileSync(path.join(root,'deploy/noa-app/home-card-polish.css'),'utf8');
const php=fs.readFileSync(path.join(root,'deploy/noa-app/home.php'),'utf8');

class El{
 constructor(tag){this.tag=tag;this.className='';this.textContent='';this.children=[];this.dataset={};this.attributes={};this.hidden=false;}
 append(...items){this.children.push(...items);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 removeAttribute(name){delete this.attributes[name];}
}
function getCard(row){
 const doc={createElement:tag=>new El(tag)};
 const win={NoaBrowse:{names:{'cover-reborn':'AInoa Cover'},genreArt:genre=>'/noa-assets/splash/'+genre+'-g2-a.jpg'},NoaCardLayout:{prepare(node,meta){node.prepared=meta;}}};
 const start=js.indexOf('function homeThumbnailSources(row){'),end=js.indexOf('const homeLists=new Map();');
 assert.ok(start>=0&&end>start);
 const source=js.slice(start,end);
 const fn=vm.runInNewContext(source+';card',{document:doc,window:win,encodeURIComponent});
 const link=fn(row);
 return {link,art:link.children[0],img:link.children[0].children[0],title:link.children[1],meta:link.children[2]};
}
const basic={
 title:'이젠 잊기로 해요 - 김완선',href:'/noa-youtube.php?video=abcdefghijk',
 videoId:'abcdefghijk',thumbnail:'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
 genre:'cover-reborn',views:1500,rank:3,previousRank:3,rankDelta:0,rankState:'same'
};
test('original thumbnail has priority and dimensions prevent layout shifts',()=>{
 const {img,link}=getCard(basic);
 assert.equal(img.src,basic.thumbnail);
 assert.equal(img.width,640);assert.equal(img.height,360);
 assert.equal(img.loading,'lazy');assert.equal(img.decoding,'async');
 assert.equal(link.prepared.rankState,null);
 assert.equal(basic.rankState,'same');
});
test('failed source tries verified YouTube image, then a distinct labeled genre image',()=>{
 const {img,art}=getCard(basic);
 img.onerror();
 assert.equal(img.src,'/noa-bridge/youtube-thumbnail.php?id=abcdefghijk');
 assert.equal(art.dataset.fallback,undefined);
 img.onerror();
 assert.equal(img.src,'/noa-assets/splash/cover-reborn-g2-a.jpg');
 assert.equal(art.dataset.fallback,'genre');
 assert.match(art.attributes['aria-label'],/장르 대표 이미지/);
});
test('identity and final unavailable state are bounded and honest',()=>{
 const {img,art}=getCard(basic);
 img.onerror();img.onerror();img.onerror();
 assert.equal(img.src,'/noa-assets/papa-logo.png');
 assert.equal(art.dataset.fallback,'identity');
 img.onerror();
 assert.equal(img.hidden,true);
 assert.equal(art.dataset.unavailable,'true');
 assert.equal(art.attributes['aria-label'],'이미지 준비 중');
});
test('invalid thumbnails and video ids cannot create arbitrary image requests',()=>{
 const {img}=getCard({...basic,thumbnail:'javascript:alert(1)',videoId:'../../etc/passwd'});
 assert.equal(img.src,'/noa-assets/splash/cover-reborn-g2-a.jpg');
});
test('upward rank remains available while unchanged rank leaves the card title clear',()=>{
 const {link,title,meta}=getCard({...basic,rankState:'up',rank:3,previousRank:5,rankDelta:2});
 assert.equal(link.prepared.rankState,'up');
 assert.equal(title.textContent,basic.title);
 assert.equal(meta.className,'noa-card-meta');
});
test('home-only CSS honors two-line title and distinct placeholder labels',()=>{
 assert.match(css,/#noa-featured .noa-card-heading strong/);
 assert.match(css,/webkit-line-clamp:2/);
 assert.match(css,/data-state=same/);
 assert.match(css,/data-fallback=genre/);
 assert.match(css,/장르 대표 이미지/);
 assert.match(css,/max-width:760px/);
 assert.doesNotMatch(css,/!important/);
});
test('home page loads dedicated card styles with a content hash',()=>{
 assert.match(php,/home-card-polish\.css\?v=/);
 assert.match(php,/hash_file\('sha256',__DIR__\.'\/home-card-polish\.css'\)/);
});
