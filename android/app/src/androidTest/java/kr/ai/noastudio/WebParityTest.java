package kr.ai.noastudio;

import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import android.view.*;
import android.webkit.*;
import androidx.media3.common.Player;
import androidx.media3.session.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint({"UnsafeOptInUsageError","SetJavaScriptEnabled"})
public class WebParityTest {
 static void main(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 static MainActivity activity(){AtomicReference<MainActivity> result=new AtomicReference<>();main(()->{for(Activity a:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED))if(a instanceof MainActivity)result.set((MainActivity)a);});return result.get();}
 static WebView web(MainActivity a)throws Exception{java.lang.reflect.Field f=MainActivity.class.getDeclaredField("browser");f.setAccessible(true);return (WebView)f.get(a);}
 static Object js(WebView w,String code)throws Exception{CountDownLatch ready=new CountDownLatch(1);AtomicReference<String> out=new AtomicReference<>();main(()->w.evaluateJavascript("(()=>{"+code+"})()",s->{out.set(s);ready.countDown();}));assertTrue("WebView JS timeout",ready.await(15,TimeUnit.SECONDS));return new JSONTokener(out.get()).nextValue();}
 static void until(WebView w,String expression)throws Exception{for(int i=0;i<180;i++){if(Boolean.TRUE.equals(js(w,"return !!("+expression+");")))return;SystemClock.sleep(500);}fail("PWA state not ready: "+expression+" diagnostics="+js(w,"return JSON.stringify({url:location.href,state:document.readyState,title:document.title,browse:typeof browse,library:typeof NoaBrowse,text:document.body?.innerText.slice(0,1200),scripts:[...document.scripts].map(s=>s.src).filter(Boolean)});"));}
 static void paint(WebView w)throws Exception{CountDownLatch done=new CountDownLatch(1);main(()->w.postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long id){done.countDown();}}));assertTrue("WebView paint timeout",done.await(10,TimeUnit.SECONDS));SystemClock.sleep(300);}
 static void music(WebView w)throws Exception{until(w,"document.readyState==='complete'&&document.querySelector('a[href=\"/noa-music.php\"]')");js(w,"document.querySelector('a[href=\"/noa-music.php\"]').click();return true;");until(w,"document.readyState==='complete'&&typeof browse!=='undefined'&&browse&&document.querySelector('#music-browse button')&&document.fonts.status==='loaded'");paint(w);}
 static long position(MediaController p){AtomicLong out=new AtomicLong();main(()->out.set(p.getCurrentPosition()));return out.get();}
 static void playing(MediaController p,boolean expected)throws Exception{AtomicBoolean result=new AtomicBoolean();for(int i=0;i<180;i++){main(()->result.set(p.isPlaying()));if(result.get()==expected)return;SystemClock.sleep(500);}fail("Native playback did not reach "+expected);}
 static final String SIGNATURE="return JSON.stringify({width:innerWidth,overflow:document.body.scrollWidth>innerWidth+1,nav:[...document.querySelectorAll('.noa-mobile-nav a')].map(x=>[x.textContent.trim(),new URL(x.href).pathname]),browse:[...document.querySelectorAll('#music-browse button,#music-browse a')].filter(x=>x.getBoundingClientRect().height>0).map(x=>{const r=x.getBoundingClientRect();return [x.textContent.trim(),Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]}),cards:[...document.querySelectorAll('#songs .song')].map(x=>[x.dataset.key,x.dataset.ep,x.dataset.genre])});";
 @Test public void productionPwaParityAndNativePlayback()throws Exception{
  MemberTestSession.install();Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  for(int i=0;i<80&&activity()==null;i++)SystemClock.sleep(250);MainActivity a=activity();assertNotNull(a);WebView w=web(a);main(()->assertEquals("Always request the live PWA",WebSettings.LOAD_NO_CACHE,w.getSettings().getCacheMode()));for(String asset:c.getAssets().list(""))assertFalse("Web design must not be bundled: "+asset,asset.equals("noa-design.json")||asset.equals("noa-ui-words.json")||asset.endsWith(".html"));
  until(w,"document.querySelector('a[href=\"/noa-music.php\"]')");device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-home.png"));
  js(w,"document.querySelector('a[href=\"/noa-music.php\"]').click();return true;");
  until(w,"document.readyState==='complete'&&document.fonts.status==='loaded'&&typeof browse!=='undefined'&&browse&&document.querySelector('#music-browse button')&&window.NoaNativeBridge?.ready()");
  main(()->{ViewGroup content=a.findViewById(android.R.id.content);assertEquals("APK must contain only the production WebView",1,content.getChildCount());assertSame(w,content.getChildAt(0));});
  paint(w);String nativeView=(String)js(w,SIGNATURE);assertFalse(new JSONObject(nativeView).getBoolean("overflow"));assertTrue(new JSONObject(nativeView).getJSONArray("browse").length()>0);
  device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-music.png"));
  // Reference: the same live URL with no native bridge, sharing the authenticated PWA session.
  AtomicReference<WebView> reference=new AtomicReference<>();main(()->{WebView ref=new WebView(a);ref.getSettings().setJavaScriptEnabled(true);ref.getSettings().setDomStorageEnabled(true);ref.setWebChromeClient(new WebChromeClient());ref.setWebViewClient(new WebViewClient());((ViewGroup)a.findViewById(android.R.id.content)).addView(ref,new ViewGroup.LayoutParams(-1,-1));reference.set(ref);ref.loadUrl("https://noastudio.ai.kr/");});
  WebView ref=reference.get();try{music(ref);assertEquals("APK changed PWA category layout, navigation or song order",nativeView,js(ref,SIGNATURE));device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-reference.png"));}finally{device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-reference-final.png"));main(()->{((ViewGroup)ref.getParent()).removeView(ref);ref.destroy();});}
  AtomicReference<ListenableFuture<MediaController>> future=new AtomicReference<>();main(()->future.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));MediaController p=future.get().get(20,TimeUnit.SECONDS);
  JSONObject proof=new JSONObject().put("livePwaLayoutAndOrderMatch",true).put("nativeNavigationRemoved",true).put("physicalDevice",false);
  try{
   String keysRaw=(String)js(w,"const chosen=records.filter(r=>r.audio&&r.kind==='single'&&r.genre==='kpop-original'&&[1,2].includes(Number(r.ep))).slice(0,2).reverse().map(r=>r.key);activeQueue=null;filter();browse.focusTrack(chosen[0]);return JSON.stringify(chosen);");JSONArray keys=new JSONArray(keysRaw);assertEquals(2,keys.length());
   String visiblePlay="[...document.querySelectorAll('.noa-inline-song-row')].find(row=>row.dataset.inlineKey==="+JSONObject.quote(keys.getString(0))+")?.querySelector('.noa-song-action[aria-label$=\" 재생\"]')";
   until(w,"("+visiblePlay+")?.getBoundingClientRect().height>0");
   long playStarted=SystemClock.elapsedRealtime();js(w,"const action="+visiblePlay+";action.scrollIntoView({block:'center'});action.click();return true;");playing(p,true);assertTrue("PWA playback waited for a full catalogue",SystemClock.elapsedRealtime()-playStarted<15000);proof.put("visibleKpopPlayControl",true).put("startupMilliseconds",SystemClock.elapsedRealtime()-playStarted);
   until(w,"[...document.querySelectorAll('.noa-inline-song-row img')].filter(img=>img.closest('[data-inline-key]')?.dataset.inlineKey===selected.dataset.key).some(img=>img.complete&&img.naturalWidth>0&&!img.src.includes('papa-logo'))");paint(w);device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-playing.png"));
   js(w,"activeQueue="+keys.toString()+";collectionQueue=null;filter();player.play();return true;");
   AtomicBoolean ordered=new AtomicBoolean();for(int i=0;i<40;i++){main(()->ordered.set(p.getMediaItemCount()==2));if(ordered.get())break;SystemClock.sleep(100);}assertTrue("Explicit PWA queue not forwarded",ordered.get());
   main(()->{assertEquals(2,p.getMediaItemCount());try{assertEquals(keys.getString(0),p.getMediaItemAt(0).mediaId);assertEquals(keys.getString(1),p.getMediaItemAt(1).mediaId);}catch(JSONException e){throw new RuntimeException(e);}});
   until(w,"document.getElementById('pause-play').getAttribute('aria-pressed')==='true'&&player.currentTime>0");proof.put("pwaQueueOrderPreserved",true).put("webControlsDriveNative",true);
   js(w,"document.getElementById('pause-play').click();return true;");playing(p,false);js(w,"document.getElementById('pause-play').click();return true;");playing(p,true);
   js(w,"document.getElementById('next').click();return true;");until(w,"selected?.dataset.key==="+JSONObject.quote(keys.getString(1)));playing(p,true);main(()->{try{assertEquals(keys.getString(1),p.getCurrentMediaItem().mediaId);}catch(JSONException e){throw new RuntimeException(e);}});
   js(w,"collectionQueue="+keys.toString()+";activeQueue=null;player.play();return true;");AtomicBoolean looping=new AtomicBoolean();for(int i=0;i<40;i++){main(()->looping.set(p.getRepeatMode()==Player.REPEAT_MODE_ALL));if(looping.get())break;SystemClock.sleep(100);}assertTrue("Collection loop not forwarded",looping.get());main(()->p.seekTo(Math.max(0,p.getDuration()-700)));until(w,"selected?.dataset.key==="+JSONObject.quote(keys.getString(0)));playing(p,true);proof.put("collectionLoops",true);js(w,"activeQueue="+keys.toString()+";collectionQueue=null;filter();player.play();return true;");
   playing(p,true);SystemClock.sleep(500);long before=position(p);device.pressHome();SystemClock.sleep(2500);assertTrue("Background stopped audio",position(p)>before+1000);device.sleep();long screen=position(p);SystemClock.sleep(2500);assertTrue("Screen-off stopped audio",position(p)>screen+1000);device.wakeUp();device.executeShellCommand("wm dismiss-keyguard");proof.put("backgroundAndScreenOff",true);
   boolean notification=false;for(android.service.notification.StatusBarNotification n:((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications())notification|=n.getNotification().extras.containsKey(Notification.EXTRA_MEDIA_SESSION);assertTrue(notification);proof.put("nativeMediaNotification",true);
   device.executeShellCommand("input keyevent 127");playing(p,false);device.executeShellCommand("input keyevent 126");playing(p,true);proof.put("lockScreenMediaKeys",true);
   c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP));for(int i=0;i<80&&activity()==null;i++)SystemClock.sleep(250);
   long refreshBefore=position(p);js(w,"window.__qaBeforeReload=true;return true;");main(w::reload);until(w,"!window.__qaBeforeReload&&document.readyState==='complete'&&window.NoaNativeBridge?.ready()&&player.currentTime>0");paint(w);playing(p,true);assertTrue("Refresh reset playback",position(p)>=refreshBefore-200);proof.put("refreshPreservesAudio",true);
   js(w,"document.querySelector('a[href=\"/noa-my.php\"]').click();return true;");until(w,"document.getElementById('noa-shell-view')?.contentDocument?.location.pathname==='/noa-my.php'");playing(p,true);device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-my.png"));proof.put("pwaMyWhilePlaying",true);
   // User-facing web controls persist a paused position; no test-side optimistic save.
   js(w,"document.getElementById('shuffle').click();player.currentTime=7;player.pause();return true;");playing(p,false);PlaybackStateStore store=new PlaybackStateStore(c);for(int i=0;i<100&&(!store.shuffle()||store.position()<6900);i++)SystemClock.sleep(100);assertTrue(store.shuffle());assertTrue(store.position()>=6900);assertEquals(2,store.items().size());proof.put("durableWebCheckpoint",true).put("completed",true);
  }finally{device.wakeUp();device.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-pwa-final.png"));try(FileWriter out=new FileWriter(new File(c.getExternalFilesDir(null),"noa-pwa-proof.json"))){out.write(proof.toString());}main(p::release);}
 }
}
