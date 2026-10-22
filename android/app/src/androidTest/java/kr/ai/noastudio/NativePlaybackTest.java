package kr.ai.noastudio;
import android.app.*;
import android.content.*;
import android.media.AudioManager;
import android.media.AudioFocusRequest;
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
 void waitPlaying(MediaController p,boolean expected)throws Exception{for(int i=0;i<240&&playing(p)!=expected;i++)SystemClock.sleep(250);AtomicReference<String> detail=new AtomicReference<>();main(()->detail.set("state="+p.getPlaybackState()+", ready="+p.getPlayWhenReady()+", suppression="+p.getPlaybackSuppressionReason()+", error="+p.getPlayerError()));assertEquals("Playback state: "+detail.get(),expected,playing(p));}
 MainActivity activity(){for(Activity a:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED))if(a instanceof MainActivity)return (MainActivity)a;throw new AssertionError("Activity missing");}
 @Test public void realMp3BackgroundFocusAndTwoRows()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();UiDevice d=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));assertNotNull(d.wait(Until.findObject(By.res(c.getPackageName(),"noa_nav_music")),20000));
  java.net.URLConnection source=new URL("https://noastudio.ai.kr/noa-bridge/catalog.php").openConnection();source.setConnectTimeout(20000);source.setReadTimeout(20000);JSONObject catalog;try(InputStream in=source.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);catalog=new JSONObject(out.toString("UTF-8"));}
  List<MediaItem> items=new ArrayList<>();JSONArray rows=catalog.getJSONArray("items");for(int i=0;i<rows.length()&&items.size()<2;i++){JSONObject row=rows.getJSONObject(i);if(!row.optBoolean("audioVerified")||!NoaMediaPolicy.audio(row.optString("audioUrl")))continue;MediaMetadata.Builder md=new MediaMetadata.Builder().setTitle(row.getString("title")).setArtist("AI Artist Noa");String art=row.optString("coverImageUrl");if(NoaMediaPolicy.artwork(art))md.setArtworkUri(android.net.Uri.parse(art));items.add(new MediaItem.Builder().setMediaId(row.getString("key")).setUri(row.getString("audioUrl")).setMediaMetadata(md.build()).build());}assertEquals("Need two actual production MP3s",2,items.size());
  AtomicReference<ListenableFuture<MediaController>> future=new AtomicReference<>();main(()->future.set(new MediaController.Builder(c,new SessionToken(c,new ComponentName(c,PlaybackService.class))).buildAsync()));MediaController p=future.get().get(20,TimeUnit.SECONDS);PlaybackStateStore store=new PlaybackStateStore(c);JSONObject proof=new JSONObject().put("fixture","actual public production MP3").put("firstKey",items.get(0).mediaId).put("physicalDevice",false);
  try{
   d.findObject(By.res(c.getPackageName(),"noa_nav_music")).click();assertTrue(d.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡 · MP3 [1-9][0-9]*곡"))),60000));UiObject2 play=d.findObject(By.clazz("android.widget.ImageButton").desc(java.util.regex.Pattern.compile(".+ 재생")));assertNotNull("MUSIC has no actual MP3 play control",play);play.click();waitPlaying(p,true);main(()->assertTrue("MUSIC next/previous need a playable queue",p.getMediaItemCount()>=2));proof.put("musicPlayControl",true);
   NativePlaylistRepository my=new NativePlaylistRepository(c);my.add(items.get(0).mediaId,"");my.add(items.get(1).mediaId,"");my.add(items.get(0).mediaId,"");JSONObject guest=my.lists("");assertTrue(guest.optBoolean("guest"));assertEquals(2,guest.getJSONArray("items").getJSONObject(0).getJSONArray("tracks").length());proof.put("guestAddDeduplicated",true);
   d.findObject(By.res(c.getPackageName(),"noa_nav_my")).click();UiObject2 listPlay=d.wait(Until.findObject(By.desc("My Playlist · 이 기기")),20000);assertNotNull(listPlay);listPlay.click();waitPlaying(p,true);main(()->assertEquals(2,p.getMediaItemCount()));proof.put("nativeMyPlaylistPlay",true);
   main(()->{store.upload(false);store.setClosed(false);p.setMediaItems(items,0,0);p.prepare();p.play();});waitPlaying(p,true);SystemClock.sleep(2000);long foreground=pos(p);assertTrue(foreground>500);
   d.findObject(By.res(c.getPackageName(),"noa_nav_music")).click();SystemClock.sleep(700);
   main(()->{JukeboxView dock=activity().findViewById(R.id.noa_dock);assertEquals(View.VISIBLE,dock.getVisibility());assertEquals(2,dock.getChildCount());View nav=activity().findViewById(R.id.noa_nav_music);assertTrue(dock.getBottom()<=((View)nav.getParent()).getTop());});
   JSONArray widths=new JSONArray();for(int width:new int[]{320,390,430,768,1024,1280,1920}){main(()->{JukeboxView v=new JukeboxView(c,new JukeboxView.Actions(){public void play(){}public void close(){}public void queue(){}});float density=c.getResources().getDisplayMetrics().density;int w=Math.round(width*density);v.theme(0xff202328,0xffeeeeee,0xffd5b979);v.bind(p,true);v.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(Math.round(100*density),View.MeasureSpec.AT_MOST));v.layout(0,0,w,v.getMeasuredHeight());assertEquals(2,v.getChildCount());for(int row=0;row<2;row++){android.widget.LinearLayout line=(android.widget.LinearLayout)v.getChildAt(row);assertTrue(line.getRight()<=w);for(int k=0;k<line.getChildCount();k++){View child=line.getChildAt(k);if(child.getVisibility()!=View.GONE){assertTrue(child.getLeft()>=0);assertTrue(child.getRight()<=line.getWidth());}}}v.release();});widths.put(width);}proof.put("nativeLayoutWidthsDp",widths).put("twoRows",true);
   d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-android-playing.png"));
   for(String theme:new String[]{"NOA STUDIO · Ivory","NOA STUDIO · Graphite"}){d.findObject(By.desc("설정")).click();UiObject2 option=d.wait(Until.findObject(By.text(theme)),5000);assertNotNull(option);option.click();SystemClock.sleep(700);assertTrue("Theme switch interrupted playback",playing(p));main(()->{JukeboxView view=activity().findViewById(R.id.noa_dock);assertEquals(2,view.getChildCount());android.widget.SeekBar seek=(android.widget.SeekBar)((android.widget.LinearLayout)view.getChildAt(1)).getChildAt(1);int accent=seek.getProgressTintList().getDefaultColor();int bg=((android.graphics.drawable.GradientDrawable)view.getBackground()).getColor().getDefaultColor();double a=android.graphics.Color.luminance(accent),b=android.graphics.Color.luminance(bg);assertTrue("Progress contrast below 3:1",(Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3);});if(theme.contains("Ivory"))d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-android-playing-ivory.png"));}proof.put("darkIvoryProgressContrast",true);

   for(String menu:new String[]{"home","youtube","my","music"}){d.findObject(By.res(c.getPackageName(),"noa_nav_"+menu)).click();SystemClock.sleep(500);assertTrue("Navigation interrupted audio: "+menu,playing(p));}proof.put("navigationRetainsPlayback",true);
   d.setOrientationLeft();SystemClock.sleep(1500);assertTrue("Rotation interrupted playback",playing(p));main(()->assertEquals(2,((JukeboxView)activity().findViewById(R.id.noa_dock)).getChildCount()));d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-android-landscape.png"));d.setOrientationNatural();SystemClock.sleep(1500);assertTrue(playing(p));proof.put("rotationRetainsPlayback",true);
   // The same origin message emitted by the video bridge transfers focus to video.
   AtomicReference<android.webkit.WebView> web=new AtomicReference<>();main(()->{try{java.lang.reflect.Field field=MainActivity.class.getDeclaredField("browser");field.setAccessible(true);web.set((android.webkit.WebView)field.get(activity()));}catch(Exception e){throw new RuntimeException(e);}});assertNotNull(web.get());main(()->web.get().evaluateJavascript("if(window.NoaAndroid)NoaAndroid.postMessage(JSON.stringify({type:'video'}));",null));SystemClock.sleep(500);assertTrue("Hidden web page stole native audio focus",playing(p));proof.put("hiddenWebFocusIgnored",true);d.findObject(By.res(c.getPackageName(),"noa_nav_youtube")).click();for(int i=0;i<60&&playing(p);i++){main(()->web.get().evaluateJavascript("if(window.NoaAndroid)NoaAndroid.postMessage(JSON.stringify({type:'video'}));",null));SystemClock.sleep(250);}waitPlaying(p,false);proof.put("videoFocusMessagePausesMusic",true);main(p::play);waitPlaying(p,true);
   AudioManager audio=(AudioManager)c.getSystemService(Context.AUDIO_SERVICE);AudioFocusRequest focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION).build()).setOnAudioFocusChangeListener(n->{}).build();assertEquals(AudioManager.AUDIOFOCUS_REQUEST_GRANTED,audio.requestAudioFocus(focus));waitPlaying(p,false);audio.abandonAudioFocusRequest(focus);main(p::play);waitPlaying(p,true);proof.put("transientFocusLossPausesMusic",true);
   d.pressHome();SystemClock.sleep(2500);long background=pos(p);assertTrue("Background stalled",background>foreground+1000);d.sleep();SystemClock.sleep(3000);long screenOff=pos(p);assertTrue("Screen off stalled",screenOff>background+1500);d.wakeUp();d.executeShellCommand("wm dismiss-keyguard");proof.put("foregroundMs",foreground).put("backgroundMs",background).put("screenOffMs",screenOff);
   boolean notification=false,token=false;for(android.service.notification.StatusBarNotification n:((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications()){notification=true;token|=n.getNotification().extras.containsKey(Notification.EXTRA_MEDIA_SESSION);}assertTrue("Media notification missing",notification);assertTrue("Media session token missing",token);proof.put("mediaNotification",notification).put("mediaSessionToken",token);
   // Hardware/Bluetooth media keys use the same session transport path.
   d.executeShellCommand("input keyevent 127");waitPlaying(p,false);d.executeShellCommand("input keyevent 126");waitPlaying(p,true);proof.put("mediaKeyPauseResume",true);
   main(()->{store.upload(true);p.pause();p.play();});SystemClock.sleep(500);assertFalse("Upload device gate bypassed",playing(p));main(()->{store.upload(false);p.play();});waitPlaying(p,true);proof.put("deviceUploadGate",true);
   main(()->{p.setShuffleModeEnabled(true);p.setRepeatMode(Player.REPEAT_MODE_OFF);p.seekTo(0,7000);p.pause();store.save(p);});for(int i=0;i<50&&store.position()<6900;i++)SystemClock.sleep(100);assertEquals(2,store.items().size());assertTrue(store.position()>=6900);assertTrue(store.shuffle());proof.put("persistedQueueCount",store.items().size()).put("persistedPositionMs",store.position());
   proof.put("completed",true);
  }finally{d.wakeUp();d.unfreezeRotation();if(!proof.optBoolean("completed"))d.takeScreenshot(new File(c.getExternalFilesDir(null),"noa-android-playing.png"));try(FileWriter out=new FileWriter(new File(c.getExternalFilesDir(null),"noa-native-playback.json"))){out.write(proof.toString());}main(()->{p.pause();p.release();});}
 }
}
