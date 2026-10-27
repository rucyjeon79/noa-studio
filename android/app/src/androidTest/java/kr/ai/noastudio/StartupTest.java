package kr.ai.noastudio;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import androidx.test.uiautomator.*;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileWriter;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class StartupTest {
 @Test public void coldStartLoadsProductionHomeAndNativeBridge() throws Exception {
  long networkEnd=SystemClock.elapsedRealtime()+90000;boolean network=false;
  while(SystemClock.elapsedRealtime()<networkEnd&&!network){java.net.HttpURLConnection probe=null;try{probe=(java.net.HttpURLConnection)new java.net.URL("https://noastudio.ai.kr/").openConnection();probe.setConnectTimeout(5000);probe.setReadTimeout(5000);network=probe.getResponseCode()==200;}catch(java.io.IOException ignored){}finally{if(probe!=null)probe.disconnect();}if(!network)SystemClock.sleep(500);}assertTrue("Emulator network unavailable",network);
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
  UiDevice d=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));
  assertNotNull(d.wait(Until.findObject(By.res(c.getPackageName(),"noa_nav_home")),20000));
  AtomicReference<String> state=new AtomicReference<>("null");
  long end=SystemClock.elapsedRealtime()+90000;
  JSONObject observed=new JSONObject();
  while(SystemClock.elapsedRealtime()<end){
   InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
    for(Activity a:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)){
     if(!(a instanceof MainActivity))continue;
     try{
      java.lang.reflect.Field field=MainActivity.class.getDeclaredField("browser");field.setAccessible(true);
      WebView w=(WebView)field.get(a);
      if(w!=null)w.evaluateJavascript("JSON.stringify({origin:location.origin,path:location.pathname,ready:document.readyState,home:!!document.querySelector('[data-home-section=hero]'),bridge:!!window.__noaNativeBridge,text:document.body?document.body.innerText.length:0})",state::set);
     }catch(ReflectiveOperationException e){throw new AssertionError(e);}
    }
   });
   SystemClock.sleep(250);
   String value=state.get();
   if(value!=null&&!value.equals("null")){
    observed=new JSONObject(new org.json.JSONTokener(value).nextValue().toString());
    if("complete".equals(observed.optString("ready"))&&observed.optBoolean("home")&&observed.optBoolean("bridge")&&observed.optInt("text")>50)break;
   }
  }
  observed.put("api",android.os.Build.VERSION.SDK_INT).put("physicalDevice",false);
  java.util.concurrent.CountDownLatch frame=new java.util.concurrent.CountDownLatch(1);
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
   for(Activity a:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))if(a instanceof MainActivity)try{
    java.lang.reflect.Field field=MainActivity.class.getDeclaredField("browser");field.setAccessible(true);WebView w=(WebView)field.get(a);
    w.evaluateJavascript("window.scrollTo(0,0)",ignored->w.postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long id){frame.countDown();}}));
   }catch(ReflectiveOperationException e){throw new AssertionError(e);}
  });
  assertTrue("Home compositor did not finish",frame.await(15,java.util.concurrent.TimeUnit.SECONDS));d.waitForIdle();
  d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-startup-home.png"));
  try(FileWriter out=new FileWriter(new File(c.getExternalFilesDir(null),"noa-startup-proof.json"))){out.write(observed.toString());}
  assertEquals("https://noastudio.ai.kr",observed.optString("origin"));
  assertEquals("/",observed.optString("path"));
  assertTrue("Production home did not render: "+observed,observed.optBoolean("home")&&observed.optInt("text")>50);
  assertTrue("Native media bridge was not installed",observed.optBoolean("bridge"));
  d.findObject(By.res(c.getPackageName(),"noa_nav_music")).click();
  assertNotNull("Guest catalog needs a visible sign-in action",d.wait(Until.findObject(By.text("로그인하면 곡 목록을 불러옵니다.")),30000));
  assertNotNull(d.findObject(By.desc("로그인")));
  observed.put("guestCatalogLoginAction",true);
  d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-guest-login.png"));
  try(FileWriter out=new FileWriter(new File(c.getExternalFilesDir(null),"noa-startup-proof.json"))){out.write(observed.toString());}
 }
}
