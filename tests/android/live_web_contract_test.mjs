import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('web-only deploys cannot rebuild the APK',()=>{
 const workflow=read('.github/workflows/noa-android.yml');
 const paths=workflow.match(/paths: \[([^\n]+)\]/)[1];
 for(const file of ['deploy/noa-design.json','deploy/noa-ui-words.json','deploy/noa-app/engine/n80.php','deploy/noa-ui.js','deploy/noa-music.php'])assert(!paths.includes(file),file);
 assert(paths.includes('android/**'));
});
test('APK contains no alternate web design or playlist screen',()=>{
 const gradle=read('android/app/build.gradle');
 assert(!gradle.includes('copyNoaDesign'));assert(!gradle.includes('noaDesignAssets'));
 for(const file of ['PlaylistPanel','NativePlaylistRepository','JukeboxView'])assert(!existsSync(new URL('../../android/app/src/main/java/kr/ai/noastudio/'+file+'.java',import.meta.url)));
 const activity=read('android/app/src/main/java/kr/ai/noastudio/MainActivity.java');
 assert(activity.includes('settings.setCacheMode(WebSettings.LOAD_NO_CACHE)'));
 assert(activity.includes('browser.loadUrl(BASE+"/")'));
 assert(!/loadDataWithBaseURL|file:\/\/\/android_asset|new PlaylistPanel/.test(activity));
});
