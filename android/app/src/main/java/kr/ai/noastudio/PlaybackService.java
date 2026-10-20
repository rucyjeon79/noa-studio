package kr.ai.noastudio;

import android.os.Process;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

@android.annotation.SuppressLint({"UnsafeOptInUsageError","SetJavaScriptEnabled"})
public class PlaybackService extends MediaSessionService {
 private MediaSession session;
 @Override public void onCreate() {
  super.onCreate();
  ExoPlayer player=new ExoPlayer.Builder(this).build();
  player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),true);
  player.setHandleAudioBecomingNoisy(true);
  player.setWakeMode(C.WAKE_MODE_LOCAL);
  session=new MediaSession.Builder(this,player).build();
 }
 @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller) {
  return controller.getUid()==Process.myUid()||controller.isTrusted()?session:null;
 }
 @Override public void onDestroy() {
  if(session!=null){session.getPlayer().release();session.release();session=null;}
  super.onDestroy();
 }
}
