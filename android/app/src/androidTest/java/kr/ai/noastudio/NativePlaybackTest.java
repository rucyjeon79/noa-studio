package kr.ai.noastudio;
import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import android.view.*;
import androidx.media3.common.*;
import androidx.media3.session.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import com.google.common.util.concurrent.ListenableFuture;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class NativePlaybackTest {
 void main(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 long pos(MediaController p){AtomicLong n=new AtomicLong();main(()->n.set(p.getCurrentPosition()));return n.get();}
 boolean playing(MediaController p){AtomicBoolean b=new AtomicBoolean();main(()->b.set(p.isPlaying()));return b.get();}
 void waitPlaying(MediaController p,boolean expected)throws Exception{for(int i=0;i<120&&playing(p)!=expected;i++)SystemClock.sleep(250);assertEquals("Playback state",expected,playing(p));}
 MainActivity activity(){for(Activity a:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED))if(a instanceof MainActivity)return (MainActivity)a;throw new AssertionError("Activity missing");}
 @Test public void realMp3BackgroundFocusAndTwoRows()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();UiDevice d=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));assertNotNull(d.wait(Until.findObject(By.res(c.getPackageName(),"noa_nav_music")),20000));
  JSONObject catalog;try(InputStream in=new URL("https://noastudio.ai.kr/noa-bridge/catalog.php").openStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);catalog=new JSONObject(out.toString("UTF-8"));}
  List<MediaItem> items=new ArrayList<>();JSONArray rows=catalog.getJSONArray("items");for(int i=0;i<rows.length()&&items.size()<2;i++){JSONObject row=rows.getJSONObject(i);if(!row.optBoolean("audioVerified")||!NoaMediaPolicy.audio(row.optString("audioUrl")))continue;MediaMetadata.Builder md=new MediaMetadata.Builder().setTitle(row.getString("title")).setArtist("AI Artist Noa");String art=row.optString("coverImageUrl");if(NoaMediaPolicy.artwork(art))md.setArtworkUri(android.net.Uri.parse(art));items.add(new MediaItem.Builder().setMediaId(row.getString("key")).setUri(row.getString("audioUrl")).setMediaMetadata(md.build()).build());}assertEquals("Need two actual production MP3s",2,items.size());
  AtomicReference<ListenableFuture<MediaController>> future=new AtomicReference<>();main(()->future.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));MediaController p=future.get().get(20,TimeUnit.SECONDS);PlaybackStateStore store=new PlaybackStateStore(c);JSONObject proof=new JSONObject().put("fixture","actual public production MP3").put("firstKey",items.get(0).mediaId).put("physicalDevice",false);
  try{
   main(()->{store.upload(false);store.setClosed(false);p.setMediaItems(items,0,0);p.prepare();p.play();});waitPlaying(p,true);SystemClock.sleep(2000);long foreground=pos(p);assertTrue(foreground>500);
   d.findObject(By.res(c.getPackageName(),"noa_nav_music")).click();SystemClock.sleep(700);
   main(()->{JukeboxView dock=activity().findViewById(R.id.noa_dock);assertEquals(View.VISIBLE,dock.getVisibility());assertEquals(2,dock.getChildCount());View nav=activity().findViewById(R.id.noa_nav_music);assertTrue(dock.getBottom()<=((View)nav.getParent()).getTop());});
   JSONArray widths=new JSONArray();for(int width:new int[]{320,390,430,768,1024,1280,1920}){main(()->{JukeboxView v=new JukeboxView(c,new JukeboxView.Actions(){public void play(){}public void close(){}public void queue(){}});float density=c.getResources().getDisplayMetrics().density;int w=Math.round(width*density);v.theme(0xff202328,0xffeeeeee,0xffd5b979);v.bind(p,true);v.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(Math.round(100*density),View.MeasureSpec.AT_MOST));v.layout(0,0,w,v.getMeasuredHeight());assertEquals(2,v.getChildCount());for(int row=0;row<2;row++){android.widget.LinearLayout line=(android.widget.LinearLayout)v.getChildAt(row);assertTrue(line.getRight()<=w);for(int k=0;k<line.getChildCount();k++){View child=line.getChildAt(k);if(child.getVisibility()!=View.GONE){assertTrue(child.getLeft()>=0);assertTrue(child.getRight()<=line.getWidth());}}}v.release();});widths.put(width);}proof.put("nativeLayoutWidthsDp",widths).put("twoRows",true);
   d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-android-playing.png"));
   for(String menu:new String[]{"home","youtube","my","music"}){d.findObject(By.res(c.getPackageName(),"noa_nav_"+menu)).click();SystemClock.sleep(500);assertTrue("Navigation interrupted audio: "+menu,playing(p));}proof.put("navigationRetainsPlayback",true);
   // The same origin message emitted by the video bridge transfers focus to video.
   main(()->{try{java.lang.reflect.Method method=MainActivity.class.getDeclaredMethod("nativeMessage",JSONObject.class);method.setAccessible(true);method.invoke(activity(),new JSONObject().put("type","video"));}catch(Exception e){throw new RuntimeException(e);}});waitPlaying(p,false);proof.put("videoFocusMessagePausesMusic",true);main(p::play);waitPlaying(p,true);
   AudioManager audio=(AudioManager)c.getSystemService(Context.AUDIO_SERVICE);AudioFocusRequest focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION).build()).setOnAudioFocusChangeListener(n->{}).build();assertEquals(AudioManager.AUDIOFOCUS_REQUEST_GRANTED,audio.requestAudioFocus(focus));waitPlaying(p,false);audio.abandonAudioFocusRequest(focus);main(p::play);waitPlaying(p,true);proof.put("transientFocusLossPausesMusic",true);
   d.pressHome();SystemClock.sleep(2500);long background=pos(p);assertTrue("Background stalled",background>foreground+1000);d.sleep();SystemClock.sleep(3000);long screenOff=pos(p);assertTrue("Screen off stalled",screenOff>background+1500);d.wakeUp();d.executeShellCommand("wm dismiss-keyguard");proof.put("foregroundMs",foreground).put("backgroundMs",background).put("screenOffMs",screenOff);
   boolean notification=false,token=false;for(android.service.notification.StatusBarNotification n:((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications()){notification=true;token|=n.getNotification().extras.containsKey(Notification.EXTRA_MEDIA_SESSION);}assertTrue("Media notification missing",notification);assertTrue("Media session token missing",token);proof.put("mediaNotification",notification).put("mediaSessionToken",token);
   // Hardware/Bluetooth media keys use the same session transport path.
   d.executeShellCommand("input keyevent 127");waitPlaying(p,false);d.executeShellCommand("input keyevent 126");waitPlaying(p,true);proof.put("mediaKeyPauseResume",true);
   main(()->{store.upload(true);p.pause();p.play();});SystemClock.sleep(500);assertFalse("Upload device gate bypassed",playing(p));main(()->{store.upload(false);p.play();});waitPlaying(p,true);proof.put("deviceUploadGate",true);
   main(()->{p.setShuffleModeEnabled(true);p.setRepeatMode(Player.REPEAT_MODE_OFF);p.seekTo(0,7000);p.pause();store.save(p);});assertEquals(2,store.items().size());assertTrue(store.position()>=6900);assertTrue(store.shuffle());proof.put("persistedQueueCount",store.items().size()).put("persistedPositionMs",store.position());
   try(FileWriter out=new FileWriter(new File(c.getExternalFilesDir(null),"noa-native-playback.json"))){out.write(proof.toString());}
  }finally{d.wakeUp();main(()->{p.pause();p.release();});}
 }
}
