package kr.ai.noastudio;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.*;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.*;

@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class PlaybackService extends MediaSessionService {
 public static final String CLOSE="noa.close";
 private MediaSession session;private ExoPlayer engine;private PlaybackStateStore store;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable checkpoint=new Runnable(){public void run(){if(session!=null&&!store.closed())store.save(session.getPlayer());handler.postDelayed(this,3000);}};
 @Override public void onCreate(){
  super.onCreate();store=new PlaybackStateStore(this);engine=new ExoPlayer.Builder(this).build();
  engine.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),true);
  engine.setHandleAudioBecomingNoisy(true);engine.setWakeMode(C.WAKE_MODE_LOCAL);
  Player player=new ForwardingPlayer(engine){
   @Override public void play(){if(!store.uploadBlocked()){store.setClosed(false);super.play();}}
   @Override public void setPlayWhenReady(boolean ready){if(ready&&!store.uploadBlocked())store.setClosed(false);super.setPlayWhenReady(ready&&!store.uploadBlocked());}
  };
  List<MediaItem> saved=store.items();if(!store.closed()&&!saved.isEmpty()){player.setMediaItems(saved,Math.min(store.index(),saved.size()-1),store.position());player.setRepeatMode(store.repeat());player.setShuffleModeEnabled(store.shuffle());}
  player.addListener(new Player.Listener(){@Override public void onEvents(Player p,Player.Events events){if(!store.closed())store.save(p);}});
  PendingIntent activity=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  session=new MediaSession.Builder(this,player).setSessionActivity(activity).setCallback(new MediaSession.Callback(){
   @Override public MediaSession.ConnectionResult onConnect(MediaSession s,MediaSession.ControllerInfo c){return new MediaSession.ConnectionResult.AcceptedResultBuilder(s).setAvailableSessionCommands(MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().add(new SessionCommand(CLOSE,Bundle.EMPTY)).build()).build();}
   @Override public ListenableFuture<SessionResult> onCustomCommand(MediaSession s,MediaSession.ControllerInfo c,SessionCommand command,Bundle args){if(CLOSE.equals(command.customAction)&&c.getUid()==android.os.Process.myUid()){store.save(s.getPlayer());store.setClosed(true);s.getPlayer().stop();s.getPlayer().clearMediaItems();return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));}return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED));}
   @Override public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onPlaybackResumption(MediaSession s,MediaSession.ControllerInfo c){List<MediaItem> rows=store.items();if(store.closed()||store.uploadBlocked()||rows.isEmpty())return Futures.immediateFailedFuture(new IllegalStateException("Playback not activated"));s.getPlayer().setRepeatMode(store.repeat());s.getPlayer().setShuffleModeEnabled(store.shuffle());return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(rows,Math.min(store.index(),rows.size()-1),store.position()));}
  }).build();handler.post(checkpoint);
 }
 @Override public MediaSession onGetSession(MediaSession.ControllerInfo c){return c.getUid()==android.os.Process.myUid()||c.isTrusted()?session:null;}
 @Override public void onDestroy(){handler.removeCallbacks(checkpoint);if(session!=null){if(!store.closed())store.save(session.getPlayer());session.release();session=null;}if(engine!=null){engine.release();engine=null;}super.onDestroy();}
}
