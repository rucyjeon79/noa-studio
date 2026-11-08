/* Legacy URL: delegate to the N80 JukeBox presentation; never own playback. */
(()=>{if(window.__n80JukeboxPresentation||document.querySelector('script[data-n80-jukebox-presentation]'))return;const script=document.createElement("script");script.dataset.n80JukeboxPresentation="";script.src="/noa-app/jukebox/presentation.js?v=n80-jukebox-1";document.head.append(script);})();
