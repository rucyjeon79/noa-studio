import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const php=readFileSync('deploy/noa-music.php','utf8');
const records=['one','two','three','outside'].map(key=>({key,title:key,genre:'your-story',audio:'/tone.wav',kind:'single',lyrics:'lyrics',rawLyrics:'lyrics',description:'description',detailsLoaded:true}));
const code=php.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/const records=<\?=[\s\S]*?\?>;/,'const records='+JSON.stringify(records)+';').replace(/<\?=json_encode\(\$collections,[\s\S]*?\?>/,'[]');
const ids=[...new Set([...code.matchAll(/getElementById\('([^']+)'\)/g)].map(m=>m[1]))].filter(id=>!['sound-player','songs'].includes(id));
const html=`<!doctype html><meta charset="utf-8"><title>NOA reload verification</title><div class="player"></div><div class="noa-transport"></div><section aria-label="곡 상세"></section><audio id="sound-player"></audio><div id="songs">${records.map(r=>`<article class="song" data-key="${r.key}" data-audio="${r.audio}"><button class="song-select">${r.title}</button><button class="sound-play">Play</button></article>`).join('')}</div>${[...new Set([...ids,'repeat','shuffle','sequential','previous','next','music-description','music-lyrics','volume','cast-noa','cast-noel'])].map(id=>`<${id==='music-browse'?'section':id==='volume'?'input':'button'} id="${id}">${id}</${id==='music-browse'?'section':id==='volume'?'input':'button'}>`).join('')}<script>${readFileSync('deploy/noa-browse.js','utf8')}</script><script>${code}</script>`;
const rate=8000,secs=20,wav=Buffer.alloc(44+rate*secs*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<rate*secs;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*1500),44+i*2);
const server=createServer((req,res)=>{if(req.url.startsWith('/noa-category-order.php')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({playlists:[{id:'bundle',group:'story',title:'My bundle',keys:['three','one','two']},{id:'other',group:'story',title:'Other bundle',keys:['outside']}]}));return;}if(req.url==='/tone.wav'){res.setHeader('Content-Type','audio/wav');res.end(wav);return;}if(req.url.includes('.js')||req.url.includes('.png')){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise(resolve=>server.listen(8091,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8091/noa-music.php?group=story&genre=your-story');
 const group=page.locator('.noa-user-playlist').first();await group.locator('.noa-browse-card').click();
 const second=group.locator('.noa-inline-song-row[data-inline-key="one"]');await second.getByRole('button',{name:'one 재생',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#dock-title').textContent==='one');
 assert.deepEqual(await page.evaluate(()=>queue().map(b=>b.dataset.key)),['three','one','two']);
 await page.locator('#next').click();assert.equal(await page.locator('#dock-title').textContent(),'two');
 assert.deepEqual(await page.evaluate(()=>queue().map(b=>b.dataset.key)),['three','one','two']);
 // Simulate natural track completion twice around the collection, not the Next button.
 for(const expected of ['three','one','two','three','one','two']){
  await page.evaluate(()=>player.dispatchEvent(new Event('ended')));
  await page.waitForFunction(key=>document.querySelector('#dock-title').textContent===key,expected);
 }
 await page.evaluate(()=>savePlayback());
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#dock-title').textContent==='two');
 await page.evaluate(()=>player.dispatchEvent(new Event('ended')));
 await page.waitForFunction(()=>document.querySelector('#dock-title').textContent==='three');
 await page.getByRole('button',{name:'당신의 이야기, 우리의 음악 🎧',exact:true}).click();
 const other=page.locator('.noa-user-playlist').filter({hasText:'Other bundle'});
 await other.locator('.noa-browse-card').click();
 await other.getByRole('button',{name:'outside 재생',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#dock-title').textContent==='outside');
 assert.deepEqual(await page.evaluate(()=>queue().map(b=>b.dataset.key)),['outside']);
 await page.evaluate(()=>{player.currentTime=10;player.dispatchEvent(new Event('ended'));});
 await page.waitForFunction(()=>player.currentTime<5&&!player.paused);
 assert.deepEqual(errors,[]);console.log('COLLECTION_QUEUE_OK',JSON.stringify({width,queue:['three','one','two'],selected:'one',next:'two',unrelatedExcluded:true,twoCycles:true,reloadLoop:true,switchedBundle:true,singleTrackLoop:true}));await page.close();
}}finally{await browser.close();server.close();}
