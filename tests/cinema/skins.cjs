const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');

const root = 'https://screen.test';
const player = fs.readFileSync('deploy/noa-youtube.php','utf8').match(/<section id="yt-player"[\s\S]*?<\/section>/)[0];
const themes = JSON.parse(fs.readFileSync('deploy/noa-design.json')).themes;
const rows = ['하루의 끝에','세상 끝에서도','다음에 공개할 영상'].map((title,i) => ({
  key:'abcdefghij'+i,video:i<2?'abcdefghij'+i:'',title,ep:i+1,genre:'pop-original',act:1,
  originalTitle:i===0?'원곡 제목이 아주 길어도 버튼과 겹치지 않는지 확인':'  '+title.replaceAll(' ','   ')+'  ',
  thumb:'/poster.jpg',comingSoon:i===2,
}));
const styles = ['noa-ui.css','noa-app/p0-media.css','noa-youtube.css','noa-policy-20261024.css','noa-starlight.css','noa-cinema.css','noa-engagement.css','noa-member-surfaces.css'];
const html = '<!doctype html><html lang="ko" data-noa-style="starlight" data-noa-precision="ios"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles.map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')+'<body class="noa-page"><main><h1>YouTube</h1>'+player+'<section id="youtube-browse"></section><div id="yt-videos" class="yt-grid" hidden>'+rows.map(r=>'<article class="yt-card" data-browse-key="'+r.key+'"><button class="yt-watch" '+(r.comingSoon?'data-coming-key="'+r.key+'" data-coming-art="/poster.jpg"':'data-video="'+r.video+'"')+' data-title="'+r.title+'"><img src="/poster.jpg"></button><h2>'+r.title+'</h2><p>음악 영상</p></article>').join('')+'</div></main><script type="application/json" id="noa-engagement-context">{"member":true}</script></body></html>';

async function inspect(browser,width) {
  const page=await browser.newPage({viewport:{width,height:860},reducedMotion:'reduce'});
  page.setDefaultTimeout(7000);
  let embeds=0;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*', route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='www.youtube.com'){
      if(u.pathname==='/iframe_api')return route.fulfill({contentType:'application/javascript',body:'window.YT={Player:class{constructor(f,{events}){window.events=events; events.onReady({target:{getPlayerState:()=>1}})}destroy(){}}};window.onYouTubeIframeAPIReady();'});
      embeds++;
      return route.fulfill({contentType:'text/html',body:'<title>영상 재생 검수</title><body style="margin:0;background:#151921"></body>'});
    }
    if(u.pathname==='/noa-youtube.php'&&!u.searchParams.has('detail'))return route.fulfill({contentType:'text/html',body:html});
    if(u.searchParams.has('detail'))return route.fulfill({json:{ok:true,videoId:rows[0].key,description:'영상 설명',lyrics:'가사'}});
    if(u.pathname==='/poster.jpg'||u.pathname.includes('youtube-thumbnail.php')||u.pathname.endsWith('.webp'))return route.fulfill({contentType:'image/jpeg',body:fs.readFileSync('public/splash/rain-g2-c.jpg')});
    if(styles.includes(u.pathname.slice(1)))return route.fulfill({contentType:'text/css',body:fs.readFileSync('deploy'+u.pathname)});
    if(u.pathname.includes('engagement.php'))return route.fulfill({json:{ok:true,items:JSON.parse(u.searchParams.get('targets')||'[]').map(t=>({...t,likes:0,comments:0}))}});
    return route.fulfill({json:{ok:true,story:[],cover:[],playlists:[]}});
  });
  try {
    for(const mode of ['act','all']){
      await page.goto(root+'/noa-youtube.php?'+(mode==='act'?'group=original&genre=pop-original&act=1':'view=all'));
      for(const f of ['noa-browse','noa-youtube','noa-cinema','noa-engagement'])await page.addScriptTag({path:'deploy/'+f+'.js'});
      await page.evaluate(rows=>{
        let browse;
        const render=()=>{if(browse)document.querySelector('#yt-videos').hidden=browse.apply(rows).stage!=='songs';};
        browse=NoaBrowse.mount({host:document.querySelector('#youtube-browse'),rows,kind:'영상',onChange:render});render();
        document.addEventListener('click',event=>{
          const button=event.target.closest('[data-video],[data-coming-key]');
          const record=button&&rows.find(r=>r.key===(button.dataset.video||button.dataset.comingKey));
          if(record)NoaBrowse.renderPath(document.querySelector('#video-classification'),record,{base:'/noa-youtube.php'});
        });
      },rows);
      const row=page.locator(mode==='act'?'.noa-inline-video-row':'#yt-videos>.yt-card').first();
      await row.locator(mode==='act'?'.noa-track-name':'.yt-watch').click();
      assert.equal(await row.locator('.noa-original-title').textContent(),'≠원곡: '+rows[0].originalTitle);
      assert.equal(await page.locator(mode==='act'?'.noa-inline-video-row':'#yt-videos>.yt-card').nth(1).locator('.noa-original-title').count(),0);
      const panel=page.locator('#yt-player');
      await panel.waitFor();
      await page.waitForFunction(()=>!!window.events);
      await page.evaluate(()=>window.events.onStateChange({data:1}));
      await panel.locator('#youtube-description summary').click();
      await panel.locator('#youtube-lyrics summary').click();
      const before=embeds, surfaces=[];
      for(const theme of themes){
        await page.evaluate(theme=>{
          const h=document.documentElement;h.dataset.noaTheme=theme.id;
          for(const [token,value] of Object.entries(theme.tokens))h.style.setProperty('--noa-'+token,value,'important');
        },theme);
        const metrics=await panel.evaluate((el,mode)=>{
          const q=s=>el.querySelector(s),css=e=>getComputedStyle(e),rect=e=>e.getBoundingClientRect();
          const row=document.querySelector(mode==='act'?'.noa-inline-video-row':'#yt-videos>.yt-card');
          const note=rect(row.querySelector('.noa-original-title')),name=mode==='act'?rect(row.querySelector('.noa-track-name')):null,reaction=row.querySelector('.noa-engagement');
          const image=rect(row.querySelector(mode==='act'?'.noa-inline-cover':'.yt-watch img'));
          const frame=rect(q('#yt-frame'));
          const color=t=>{const span=document.createElement('i');span.style.color='var(--noa-'+t+')';el.append(span);const value=css(span).color;span.remove();return value;};
          const selectors={'#yt-playing':'text','#video-classification small':'muted','#video-classification a':'accent','#youtube-description summary':'text','#youtube-lyrics summary':'text','#youtube-description pre':'text','.cinema-badge':'success'};
          return {nameAboveNote:!name||(name.height>=19 && name.bottom<=note.top && name.top>=rect(row).top),noteBeforeActions:!reaction||note.bottom<=rect(reaction).top+1,noteFits:note.right<=rect(row).right,tokens:Object.entries(selectors).map(([s,t])=>[s,css(q(s)).color,color(t)]), surface:css(el).backgroundColor, title:css(q('#yt-playing')).color,
            card:css(row).backgroundImage,edge:css(row).borderLeftColor,accent:color('accent'),frame:[frame.width,frame.height],art:[image.width,image.height],
            path:rect(q('#video-classification')).top,frameBottom:frame.bottom,details:[...el.querySelectorAll('summary')].map(s=>rect(s).height),wide:document.documentElement.scrollWidth>innerWidth+1};
        },mode);
        const note=JSON.stringify({width,mode,theme:theme.id,metrics});
        for(const [s,value,expected] of metrics.tokens)assert.equal(value,expected,s+' '+note);
        assert.equal(metrics.surface,'rgb('+theme.tokens.surface.slice(1).match(/../g).map(s=>parseInt(s,16)).join(', ')+')',note);
        assert.equal(metrics.edge,metrics.accent,note);
        for(const [w,h] of [metrics.frame,metrics.art])assert(w>0 && Math.abs(w*9/16-h)<1,note);
        assert(metrics.nameAboveNote && metrics.noteBeforeActions && metrics.noteFits && !metrics.wide && metrics.path>=metrics.frameBottom-1 && metrics.details.every(h=>h>=44),note);
        surfaces.push(metrics.card);
        if([390,1280].includes(width) && mode==='act'){
          await panel.locator('#youtube-description summary').click();await panel.locator('#youtube-lyrics summary').click();
          await row.screenshot({path:'cinema-proof/video-list-'+theme.id+'-'+width+'.png'});
          await panel.locator('#youtube-description summary').click();await panel.locator('#youtube-lyrics summary').click();
        }
      }
      assert.notEqual(surfaces[0],surfaces[1]);
      assert.equal(embeds,before,'Theme changes must preserve the active iframe');
      assert.equal(await panel.locator('.cinema-badge').innerText(),'상영 중');
      if(mode==='all'){
        await page.locator('#yt-videos [data-coming-key]').click();
        await panel.locator('#yt-coming-preview').waitFor();
        assert(await panel.locator('#yt-frame').isHidden());
        assert(await panel.locator('.noa-media-details').isHidden());
        assert.equal(await panel.locator('.cinema-badge').innerText(),'상영 대기');
      }
      assert.deepEqual(errors,[]);
      console.log(width,mode,'light/dark playback, metadata, disclosures and artwork passed');
    }
  } catch(error) {
    await page.screenshot({path:'cinema-proof/failure-'+width+'.png',fullPage:true});throw error;
  } finally {await page.close();}
}
(async()=>{fs.mkdirSync('cinema-proof',{recursive:true});const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
  try{for(const width of [320,360,390,430,1280])await inspect(browser,width);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
