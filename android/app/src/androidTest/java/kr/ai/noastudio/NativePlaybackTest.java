package kr.ai.noastudio;

import android.content.ComponentName;
import android.content.Intent;
import android.app.Notification;
import android.app.NotificationManager;
import android.service.notification.StatusBarNotification;
import android.net.Uri;
import android.os.SystemClock;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import com.google.common.util.concurrent.ListenableFuture;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Engine/lifecycle verification with an explicitly synthetic, test-only local PCM fixture. */
@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class NativePlaybackTest {
 private void main(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 private long position(MediaController controller){AtomicLong value=new AtomicLong();main(()->value.set(controller.getCurrentPosition()));return value.get();}
 @Test public void pcmFixtureContinuesInBackgroundAndScreenOff() throws Exception {
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  SystemClock.sleep(1500);
  int rate=8000,count=rate*30;File fixture=new File(context.getCacheDir(),"noa-qa-only-pcm.wav");
  ByteBuffer wav=ByteBuffer.allocate(44+count*2).order(ByteOrder.LITTLE_ENDIAN);
  wav.put("RIFF".getBytes("US-ASCII")).putInt(36+count*2).put("WAVEfmt ".getBytes("US-ASCII")).putInt(16).putShort((short)1).putShort((short)1).putInt(rate).putInt(rate*2).putShort((short)2).putShort((short)16).put("data".getBytes("US-ASCII")).putInt(count*2);
  for(int i=0;i<count;i++)wav.putShort((short)(Math.sin(2*Math.PI*330*i/rate)*1200));
  try(FileOutputStream out=new FileOutputStream(fixture)){out.write(wav.array());}
  AtomicReference<ListenableFuture<MediaController>> future=new AtomicReference<>();
  main(()->future.set(new MediaController.Builder(context,new SessionToken(context,new ComponentName(context,PlaybackService.class))).buildAsync()));
  MediaController controller=future.get().get(15,TimeUnit.SECONDS);
  try{
   main(()->{controller.setMediaItem(new MediaItem.Builder().setMediaId("qa-synthetic-fixture").setUri(Uri.fromFile(fixture)).setMediaMetadata(new MediaMetadata.Builder().setTitle("NOA QA · synthetic PCM fixture").setArtist("Playback engine verification only").build()).build());controller.prepare();controller.play();});
   long deadline=SystemClock.elapsedRealtime()+15000;while(position(controller)<1000&&SystemClock.elapsedRealtime()<deadline)SystemClock.sleep(100);
   long foreground=position(controller);assertTrue("Local PCM did not actually advance",foreground>1000);
   device.pressHome();SystemClock.sleep(2500);long background=position(controller);assertTrue("Background playback stopped",background>foreground+1500);
   device.sleep();SystemClock.sleep(2500);long screenOff=position(controller);assertTrue("Screen-off playback stopped",screenOff>background+1500);
   boolean notification=false,sessionToken=false,actions=false;
   for(StatusBarNotification entry:((NotificationManager)context.getSystemService(android.content.Context.NOTIFICATION_SERVICE)).getActiveNotifications()){
    Notification n=entry.getNotification();if(!Notification.CATEGORY_TRANSPORT.equals(n.category))continue;notification=true;sessionToken=n.extras.containsKey(Notification.EXTRA_MEDIA_SESSION);actions=n.actions!=null&&n.actions.length>0;
   }
   assertTrue("No active media notification",notification);assertTrue("No media session token on notification",sessionToken);assertTrue("No playback actions on notification",actions);
   main(controller::pause);long paused=position(controller);SystemClock.sleep(600);assertTrue("Pause control did not stop position",position(controller)-paused<250);
   JSONObject result=new JSONObject().put("fixture","synthetic local PCM; not a library song").put("foregroundMs",foreground).put("backgroundMs",background).put("screenOffMs",screenOff).put("mediaNotification",notification).put("mediaSessionToken",sessionToken).put("mediaActions",actions).put("physicalDevice",false);
   try(FileOutputStream out=new FileOutputStream(new File(context.getExternalFilesDir(null),"noa-native-playback.json"))){out.write(result.toString().getBytes("UTF-8"));}
  }finally{device.wakeUp();device.pressMenu();main(()->{controller.stop();controller.release();});fixture.delete();}
 }
}
