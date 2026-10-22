package kr.ai.noastudio;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import org.json.*;
import java.util.*;

/** Queue and paused resume position survive activity/process recreation without autoplay. */
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public final class PlaybackStateStore {
 private final SharedPreferences pref;
 public PlaybackStateStore(Context c){pref=c.getSharedPreferences("noa-native-playback-v2",Context.MODE_PRIVATE);}
 public boolean closed(){return pref.getBoolean("closed",true);}
 public void setClosed(boolean closed){pref.edit().putBoolean("closed",closed).apply();}
 public boolean uploadBlocked(){return pref.getLong("uploadUntil",0)>System.currentTimeMillis();}
 public void upload(boolean busy){pref.edit().putLong("uploadUntil",busy?System.currentTimeMillis()+15000:0).apply();}
 public void save(Player p){
  if(p.getMediaItemCount()==0)return;
  try{JSONArray queue=new JSONArray();int mapped=0;int index=p.getCurrentMediaItemIndex();
   for(int i=0;i<Math.min(p.getMediaItemCount(),500);i++){MediaItem m=p.getMediaItemAt(i);if(m.localConfiguration==null||!NoaMediaPolicy.audio(m.localConfiguration.uri.toString()))continue;if(i<index)mapped++;JSONObject row=new JSONObject().put("id",m.mediaId).put("url",m.localConfiguration.uri.toString()).put("title",String.valueOf(m.mediaMetadata.title)).put("art",m.mediaMetadata.artworkUri==null?"":m.mediaMetadata.artworkUri.toString());queue.put(row);}
   if(queue.length()==0)return;
   pref.edit().putString("queue",queue.toString()).putInt("index",Math.min(mapped,queue.length()-1)).putLong("position",Math.max(0,p.getCurrentPosition())).putBoolean("shuffle",p.getShuffleModeEnabled()).putInt("repeat",p.getRepeatMode()).apply();
  }catch(JSONException ignored){}
 }
 public List<MediaItem> items(){List<MediaItem> out=new ArrayList<>();try{JSONArray rows=new JSONArray(pref.getString("queue","[]"));for(int i=0;i<Math.min(rows.length(),500);i++){JSONObject r=rows.getJSONObject(i);if(!NoaMediaPolicy.audio(r.optString("url")))continue;MediaMetadata.Builder md=new MediaMetadata.Builder().setTitle(r.optString("title")).setArtist("AI Artist Noa");if(NoaMediaPolicy.artwork(r.optString("art")))md.setArtworkUri(Uri.parse(r.optString("art")));out.add(new MediaItem.Builder().setMediaId(r.optString("id")).setUri(r.getString("url")).setMediaMetadata(md.build()).build());}}catch(JSONException ignored){}return out;}
 public int index(){return Math.max(0,pref.getInt("index",0));}
 public long position(){return Math.max(0,pref.getLong("position",0));}
 public boolean shuffle(){return pref.getBoolean("shuffle",false);}
 public int repeat(){int value=pref.getInt("repeat",Player.REPEAT_MODE_OFF);return value==Player.REPEAT_MODE_ONE?value:Player.REPEAT_MODE_OFF;}
}
