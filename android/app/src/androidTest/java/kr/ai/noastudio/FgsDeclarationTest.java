package kr.ai.noastudio;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.*;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.media3.session.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Records the real, hash-pinned Play candidate; never fabricates a service demonstration. */
@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class FgsDeclarationTest {
 @Test public void recordUserStartedBackgroundPlayback() throws Exception {
  MemberTestSession.install();
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  for(int i=0;i<80&&WebParityTest.activity()==null;i++)SystemClock.sleep(250);
  MainActivity a=WebParityTest.activity();assertNotNull(a);WebView w=WebParityTest.web(a);
  WebParityTest.music(w);
  WebParityTest.until(w,"window.NoaNativeBridge?.ready()");
  WebParityTest.js(w,"document.querySelector('#noa-amt-fan button[aria-label]')?.click();document.querySelector('[aria-label=\"AInoa 말풍선 닫기\"]')?.click();return true;");
  String key=(String)WebParityTest.js(w,"const r=records.find(r=>r.audio&&r.kind==='single'&&r.genre==='kpop-original'&&Number(r.ep)===1);if(!r)throw Error('No real song');activeQueue=null;filter();browse.focusTrack(r.key);return r.key;");
  String control="[...document.querySelectorAll('.noa-inline-song-row')].find(r=>r.dataset.inlineKey==="+JSONObject.quote(key)+")?.querySelector('.noa-song-action[aria-label$=\" 재생\"]')";
  WebParityTest.until(w,"("+control+")?.getBoundingClientRect().height>0");
  WebParityTest.js(w,"("+control+").scrollIntoView({block:'center'});return true;");
  WebParityTest.paint(w);
  AtomicReference<ListenableFuture<MediaController>> future=new AtomicReference<>();
  WebParityTest.main(()->future.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));
  MediaController player=future.get().get(20,TimeUnit.SECONDS);
  File video=new File(c.getExternalFilesDir(null),"noa-fgs-media-playback.mp4");
  File proofFile=new File(c.getExternalFilesDir(null),"noa-fgs-media-playback.json");
  JSONObject proof=new JSONObject().put("physicalDevice",false).put("androidApi",android.os.Build.VERSION.SDK_INT).put("package",c.getPackageName()).put("versionCode",c.getPackageManager().getPackageInfo(c.getPackageName(),0).getLongVersionCode()).put("completed",false);
  String pid="";
  try {
   assertEquals(1794853670L,proof.getLong("versionCode"));
   device.executeShellCommand("settings put system show_touches 1");
   pid=device.executeShellCommand("sh -c 'screenrecord --bit-rate 6000000 --time-limit 110 "+video.getAbsolutePath()+" >/dev/null 2>&1 & echo $!' ").trim();
   assertTrue("Recorder PID missing",pid.matches("[0-9]+"));SystemClock.sleep(3000);
   // Use an actual touch on the visible production play button.
   JSONArray rect=(JSONArray)WebParityTest.js(w,"const r=("+control+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth];");
   int[] origin=new int[2];int[] width=new int[1];WebParityTest.main(()->{w.getLocationOnScreen(origin);width[0]=w.getWidth();});
   double scale=width[0]/rect.getDouble(2);
   device.click(origin[0]+(int)(rect.getDouble(0)*scale),origin[1]+(int)(rect.getDouble(1)*scale));
   WebParityTest.playing(player,true);proof.put("visiblePlayTap",true);SystemClock.sleep(7000);
   long before=WebParityTest.position(player);device.pressHome();SystemClock.sleep(6000);
   assertTrue("Audio must continue outside the app",WebParityTest.position(player)>before+3000);proof.put("backgroundPlayback",true);
   boolean mediaNotification=false;
   for(android.service.notification.StatusBarNotification n:((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications())mediaNotification|=n.getNotification().extras.containsKey(Notification.EXTRA_MEDIA_SESSION);
   assertTrue("Media notification must be present",mediaNotification);device.openNotification();SystemClock.sleep(7000);proof.put("mediaNotification",true);
   device.pressBack();c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP));
   for(int i=0;i<80&&WebParityTest.activity()==null;i++)SystemClock.sleep(250);
   SystemClock.sleep(4000);
   WebParityTest.js(w,"document.getElementById('pause-play').click();return true;");WebParityTest.playing(player,false);SystemClock.sleep(4000);
   WebParityTest.js(w,"document.getElementById('pause-play').click();return true;");WebParityTest.playing(player,true);SystemClock.sleep(4000);
   WebParityTest.js(w,"document.getElementById('dock-close').click();return true;");WebParityTest.playing(player,false);SystemClock.sleep(4000);
   proof.put("userControlsPauseResumeClose",true).put("completed",true);
  } finally {
   if(pid.matches("[0-9]+")){device.executeShellCommand("kill -2 "+pid);SystemClock.sleep(2000);}
   device.executeShellCommand("settings put system show_touches 0");
   WebParityTest.main(player::release);
   try(FileWriter out=new FileWriter(proofFile)){out.write(proof.toString(2));}
  }
  assertTrue("Actual recording is missing",video.isFile()&&video.length()>100000);
 }
}
