package kr.ai.noastudio;
import android.content.*;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.session.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class PlaybackRestoreTest {
 @Test public void processRestartRestoresPausedAndClosePreservesQueue()throws Exception{
  android.content.Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();PlaybackStateStore store=new PlaybackStateStore(c);assertEquals(2,store.items().size());assertEquals(2,new org.json.JSONArray(c.getSharedPreferences("noa-native-my",Context.MODE_PRIVATE).getString("tracks","[]")).length());assertFalse(store.closed());long expected=store.position();c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));UiDevice d=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());assertNotNull(d.wait(Until.findObject(By.res(c.getPackageName(),"noa_nav_home")),20000));AtomicReference<ListenableFuture<MediaController>> f=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->f.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));MediaController p=f.get().get(20,TimeUnit.SECONDS);try{AtomicReference<ListenableFuture<SessionResult>> close=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{assertEquals(2,p.getMediaItemCount());assertFalse("Must await user playback after restart",p.getPlayWhenReady());assertTrue("Restored position "+p.getCurrentPosition()+" expected "+expected,Math.abs(p.getCurrentPosition()-expected)<1500);assertTrue("Shuffle not restored",p.getShuffleModeEnabled());close.set(p.sendCustomCommand(new SessionCommand(PlaybackService.CLOSE,Bundle.EMPTY),Bundle.EMPTY));});assertEquals(SessionResult.RESULT_SUCCESS,close.get().get(10,TimeUnit.SECONDS).resultCode);SystemClock.sleep(1000);assertTrue(store.closed());assertEquals(2,store.items().size());assertTrue("Close destroyed resume position",store.position()>=6900);assertFalse(d.hasObject(By.res(c.getPackageName(),"noa_dock")));try(java.io.FileWriter out=new java.io.FileWriter(new java.io.File(c.getExternalFilesDir(null),"noa-restore-proof.json"))){out.write(new org.json.JSONObject().put("processRestartPaused",true).put("queueCount",store.items().size()).put("positionMs",store.position()).put("closedPreservesQueue",true).toString());}}finally{InstrumentationRegistry.getInstrumentation().runOnMainSync(p::release);}
 }
}
