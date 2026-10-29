package kr.ai.noastudio;
import android.content.*;
import android.os.*;
import android.webkit.WebView;
import androidx.media3.session.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class WebPlaybackRestoreTest {
 @Test public void nativeQueueRestoresPausedIntoThePwa()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();PlaybackStateStore store=new PlaybackStateStore(c);assertEquals(2,store.items().size());assertTrue(store.shuffle());long expected=store.position();
  c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));for(int i=0;i<80&&WebParityTest.activity()==null;i++)SystemClock.sleep(250);WebView w=WebParityTest.web(WebParityTest.activity());
  AtomicReference<ListenableFuture<MediaController>> f=new AtomicReference<>();WebParityTest.main(()->f.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));MediaController p=f.get().get(20,TimeUnit.SECONDS);
  try{WebParityTest.main(()->{assertEquals(2,p.getMediaItemCount());assertFalse(p.getPlayWhenReady());assertTrue(p.getShuffleModeEnabled());assertTrue(Math.abs(p.getCurrentPosition()-expected)<1500);});WebParityTest.main(()->w.loadUrl("https://noastudio.ai.kr/noa-music.php"));WebParityTest.until(w,"window.NoaNativeBridge?.ready()&&player.currentTime>=6.9&&player.paused");WebParityTest.js(w,"document.getElementById('dock-close').click();return true;");for(int i=0;i<50&&!store.closed();i++)SystemClock.sleep(100);assertTrue(store.closed());assertEquals(2,store.items().size());assertTrue(store.position()>=6900);}finally{WebParityTest.main(p::release);}
 }
}
