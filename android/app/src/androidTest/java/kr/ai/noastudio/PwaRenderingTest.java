package kr.ai.noastudio;

import android.content.*;
import android.os.*;
import android.webkit.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import androidx.media3.session.*;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

/** Export the actual APK layout for comparison with independent Chrome, not another WebView. */
@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class PwaRenderingTest {
 private static void navigate(WebView w,String route)throws Exception{
  WebParityTest.js(w,"window.__noaQaPreviousDocument=true;return true;");
  if(route.equals("/noa-music.php"))WebParityTest.js(w,"document.querySelector('.noa-mobile-nav a[href=\"/noa-music.php\"]').click();return true;");
  else WebParityTest.js(w,"location.assign("+JSONObject.quote(route)+");return true;");
  WebParityTest.until(w,"!window.__noaQaPreviousDocument&&location.pathname==="+JSONObject.quote(route)+"&&document.readyState==='complete'");
 }
 private static String asset(String name)throws Exception{
  try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(name)){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[4096];int count;while((count=in.read(block))!=-1)out.write(block,0,count);return out.toString(StandardCharsets.UTF_8.name());}
 }
 @Test public void liveScreensAndHomeRecommendation()throws Exception{
  MemberTestSession.install();Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
  c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  for(int i=0;i<80&&WebParityTest.activity()==null;i++)SystemClock.sleep(250);
  MainActivity a=WebParityTest.activity();assertNotNull(a);WebView w=WebParityTest.web(a);
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  String probe=asset("pwa-layout-probe.js"),imagesReady=asset("pwa-images-ready.js");
  WebParityTest.main(()->{assertTrue(w.getSettings().getUseWideViewPort());assertTrue(w.getSettings().getLoadWithOverviewMode());});
  for(String route:new String[]{"/","/noa-music.php"})for(String theme:new String[]{"noa-ivory","noa-studio"}){
   android.util.Log.i("TestRunner","Capturing "+route+" "+theme);
   if(route.equals("/noa-music.php")&&theme.equals("noa-ivory"))navigate(w,route);
   WebParityTest.until(w,"document.readyState==='complete'&&window.NoaUI?.getState()&&document.fonts.status==='loaded'&&document.querySelector('.noa-mobile-nav a')");
   // Wait for authenticated theme preferences, then exercise the PWA's own theme control.
   SystemClock.sleep(1500);
   WebParityTest.js(w,"localStorage.setItem('noa-device-theme',"+JSONObject.quote(theme)+");NoaUI.apply({...NoaUI.getState(),theme:"+JSONObject.quote(theme)+"});document.querySelector('#noa-amt-fan button[aria-label]')?.click();document.querySelector('[aria-label=\"AInoa 말풍선 닫기\"]')?.click();scrollTo(0,0);return true;");
   WebParityTest.until(w,"document.documentElement.dataset.noaTheme==="+JSONObject.quote(theme));
   WebParityTest.js(w,"window.__noaQaImages=null;("+imagesReady+").then(()=>window.__noaQaImages=true,error=>window.__noaQaImages=String(error));return true;");
   WebParityTest.until(w,"window.__noaQaImages!==null");assertEquals(Boolean.TRUE,WebParityTest.js(w,"return window.__noaQaImages;"));
   WebParityTest.paint(w);SystemClock.sleep(700);
   JSONObject data=(JSONObject)WebParityTest.js(w,"return "+probe+";");assertEquals("https://noastudio.ai.kr"+route,data.getString("url"));assertEquals(theme,data.getString("theme"));assertFalse(data.getBoolean("overflow"));
   assertEquals(5,data.getJSONObject("nodes").getJSONArray(".noa-mobile-nav a").length());
   String name=(route.equals("/")?"home":"music")+"-"+theme;
   try(FileWriter out=new FileWriter(new File(c.getExternalFilesDir(null),"layout-"+name+".json"))){out.write(data.toString());}
   assertTrue(device.takeScreenshot(new File(c.getExternalFilesDir(null),"layout-"+name+".png")));
  }
  // The actual production homepage hosts its recommendation player in a same-origin frame.
  navigate(w,"/");
  WebParityTest.until(w,"document.querySelector('iframe.nl-play-shell')?.contentWindow?.NoaNativeBridge?.ready()");
  AtomicReference<ListenableFuture<MediaController>> future=new AtomicReference<>();
  WebParityTest.main(()->future.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));
  MediaController controller=future.get().get(20,TimeUnit.SECONDS);
  try{
   assertEquals(Boolean.TRUE,WebParityTest.js(w,"const music=document.querySelector('iframe.nl-play-shell').contentWindow.NoaMusic;const rows=music.catalog().filter(r=>r.audio&&r.genre==='kpop-original').slice(0,2);return music.playRecommendedMix(rows.map(r=>r.key));"));
   WebParityTest.playing(controller,true);long before=WebParityTest.position(controller);
   device.pressHome();SystemClock.sleep(2000);device.sleep();SystemClock.sleep(2000);
   assertTrue("Home recommendation must use background native playback",WebParityTest.position(controller)>before+2000);
   device.wakeUp();device.executeShellCommand("wm dismiss-keyguard");
   c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP));
   for(int i=0;i<80&&WebParityTest.activity()==null;i++)SystemClock.sleep(250);
   WebParityTest.js(w,"document.querySelector('iframe.nl-play-shell').contentDocument.getElementById('dock-close').click();return true;");
   WebParityTest.playing(controller,false);
  }finally{device.wakeUp();WebParityTest.main(controller::release);}
 }
}
