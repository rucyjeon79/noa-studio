import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
const wav=Buffer.alloc(44+16000*5);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const html='<!doctype html><html lang="ko" data-noa-style="starlight" data-noa-precision="1"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-music-vinyl.css"><body class="noa-page"><main><h1>음원</h1><section id="music-browse"></section><audio id="sound-player" src="/tone.wav"></audio><div id="songs"><div class="song selected" data-key="a"><button class="song-select"><span class="cover">♫</span>첫 곡</button></div></div><div class="noa-two-line"><img id="dock-cover" hidden><span id="dock-cover-empty">♫</span></div></main><script src="/noa-browse.js"></script><script src="/noa-music-vinyl.js"></script><script>const tree=NoaBrowse.mount({host:document.querySelector("#music-browse"),rows:[],onChange:()=>tree.apply([])});tree.apply([]);</script></body></html>';
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/tone.wav'){res.writeHead(200,{'Content-Type':'audio/wav'});return res.end(wav);}
 if(path==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(html);}
 const file=path.startsWith('/noa-assets/editorial-')?'deploy/noa-assets/editorial/'+path.split('editorial-')[1]:'deploy'+path;
 try{res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript;charset=utf-8':path.endsWith('.css')?'text/css;charset=utf-8':'image/webp');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});mkdirSync('music-vinyl-proof',{recursive:true});
try{for(const width of [320,390,1280]){
 const p=await browser.newPage({viewport:{width,height:880}});await p.goto('http://127.0.0.1:'+server.address().port+'/');
 const editions=p.locator('.lp-edition');await editions.first().waitFor();assert.equal(await editions.count(),4);
 await editions.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
 for(const card of await editions.all()){
  const within=await card.evaluate(el=>{
   const box=node=>node.getBoundingClientRect();
   const art=box(el.querySelector('.lp-edition-art'));
   const disc=box(el.querySelector('.lp-spindle'));
   const label=box(el.querySelector('strong'));
   return disc.left>=art.left-1 && disc.right<=art.right+1 && label.top>=art.bottom-1 && label.bottom<=box(el).bottom+1;
  });
  assert(within,'Disc and category caption must fit their own sleeve');
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.evaluate(()=>document.querySelector('audio').play());
 await p.locator('.lp-dock-art.lp-running').waitFor();
 const disc=p.locator('.lp-dock-art>.lp-spindle');assert.equal(await disc.evaluate(n=>getComputedStyle(n).animationPlayState),'running');
 assert.equal(await p.locator('.song .lp-running').count(),1);
 await p.evaluate(()=>document.querySelector('audio').pause());
 await p.waitForFunction(()=>!document.querySelector('.lp-dock-art').classList.contains('lp-running'));
 assert.equal(await disc.evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
 await p.evaluate(()=>document.querySelector('audio').play());await p.locator('.lp-dock-art.lp-running').waitFor();
 await p.evaluate(()=>document.querySelector('audio').dispatchEvent(new Event('waiting')));await p.waitForFunction(()=>!document.querySelector('.lp-dock-art.lp-running'));
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{key:'b'}}})));await p.waitForFunction(()=>!document.querySelector('.lp-dock-art.lp-on-record'));assert.equal(await p.locator('.song .lp-on-record').count(),0);
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await disc.evaluate(n=>getComputedStyle(n).animationName),'none');
 await p.screenshot({path:'music-vinyl-proof/view-'+width+'.png'});await p.close();
}console.log('REAL_AUDIO_PLAY_PAUSE_RESUME_WAIT_TRACK_CHANGE_REDUCED_MOTION_OK');}finally{await browser.close();server.close();}
