
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const card=(i)=>'<article class="noa-engagement-card"><a class="noa-music-card"><div class="noa-art"></div><span class="noa-card-heading"><strong>'+(['Short title','A considerably longer title for line wrapping','EP.3 / Another music story','Final track'][i])+'</strong></span><small class="noa-card-meta">Music collection</small></a><div class="noa-engagement"><button>Like</button><button>Comment</button></div></article>';
const sections='<section class="noa-section" data-home-section="recommendations"><div class="noa-section-head"><h2>Recommended music</h2><a href="/all" class="noa-action">View all</a></div><div id="noa-featured" class="noa-card-grid">'+[0,1,2,3].map(card).join('')+'</div><nav class="noa-home-pages"><button>Previous</button><span>1 / 9</span><button>Next</button></nav></section><section class="noa-section"><div class="noa-section-head"><h2>Music collections</h2><a class="noa-action" href="/all">View all</a></div><div id="noa-genres" class="noa-genres">'+[0,1,2,3].map(i=>'<a class="noa-genre" href="/all"><strong>Collection '+i+'</strong><small>Music and stories</small></a>').join('')+'</div></section><section class="noa-section noa-community"><div class="noa-section-head"><h2>Community</h2><nav class="noa-community-actions"><a href="/all">View all</a><a href="/write">Write</a></nav></div><details class="noa-community-post"><summary><strong>Our newest community story</strong><span>⌄</span></summary><div class="noa-community-body">Content</div></details></section>';
const server=createServer((req,res)=>{
 if(req.url.startsWith('/noa-bridge/membership.php')){res.setHeader('Content-Type','application/json');return res.end('{"ok":true,"member":false}');}
 if(req.url.startsWith('/noa-assets/')){res.writeHead(204);return res.end();}
 const path=req.url.split('?')[0];
 if(['/noa-ui.js','/noa-ui.css','/noa-account.js','/noa-account.css','/noa-starlight.css','/noa-community.css'].includes(path)){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');return res.end(readFileSync('deploy'+path));}
 if(path.endsWith('.json')){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en" data-noa-style="starlight"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-community.css"><link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-starlight.css"><body class="noa-page"><script type="application/json" id="noa-visitor-counts">{"today":"123","yesterday":"45","total":"123456"}</script><main>'+sections+'</main><script src="/noa-ui.js"></script><script src="/noa-account.js"></script></body></html>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];mkdirSync('starlight-proof',{recursive:true});
try{for(const width of [320,390,768,1024,1440,1920]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.noa-mobile-footer').waitFor({state:'attached'});
 const measurement=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  const grids=['#noa-featured','#noa-genres'].map(s=>{const e=document.querySelector(s);return{...rect(e),gap:getComputedStyle(e).columnGap,cards:[...e.children].map(rect)};});
  const main=document.querySelector('main'),footer=document.querySelector('.noa-mobile-footer'),headings=[...document.querySelectorAll('.noa-section-head')];
  return{overflow:document.documentElement.scrollWidth>innerWidth,grids,main:rect(main),gutter:parseFloat(getComputedStyle(main).paddingLeft),footer:rect(footer),heads:headings.map(e=>({padding:getComputedStyle(e).paddingBottom,margin:getComputedStyle(e).marginBottom,...rect(e)})),post:rect(document.querySelector('.noa-community-post>summary'))};
 });assert(!measurement.overflow,JSON.stringify({width,measurement}));
 const [music,collections]=measurement.grids;assert.equal(music.gap,collections.gap);
 assert(Math.abs(music.x-collections.x)<1);assert(Math.abs(music.right-collections.right)<1);
 if(width<=760||width>=1440){for(let i=0;i<4;i++)assert(Math.abs(music.cards[i].x-collections.cards[i].x)<1,JSON.stringify({width,i,measurement}));}
 for(const h of measurement.heads){assert.equal(h.padding,'16px');assert.equal(h.margin,width<=760?'16px':'24px');assert(Math.abs(h.x-music.x)<1);}
 assert(Math.abs(measurement.post.x-music.x)<1);
 if(width<=760){assert(Math.abs(measurement.footer.x-music.x)<1);await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));const count=await page.locator('.noa-mobile-footer .noa-sidebar-visitors').boundingBox(),dock=await page.locator('.noa-mobile-nav').boundingBox();assert(count.y+count.height<=dock.y);await page.screenshot({path:'starlight-proof/spacing-footer-'+width+'.png'});}
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'starlight-proof/spacing-'+width+'.png'});
 report.push({width,...measurement});await page.close();console.log('PASS spacing '+width);
}}finally{writeFileSync('starlight-proof/spacing.json',JSON.stringify(report,null,2));await browser.close();server.close();}
