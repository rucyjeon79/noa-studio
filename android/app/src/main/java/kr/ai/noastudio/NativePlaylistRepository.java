package kr.ai.noastudio;

import android.content.Context;
import android.webkit.CookieManager;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Reuses the member API and revision checks; never invents a second SQL schema. */
public final class NativePlaylistRepository {
 private final Context context;
 public NativePlaylistRepository(Context c){context=c;}
 public String cookie(){String c=CookieManager.getInstance().getCookie("https://noastudio.ai.kr");return c==null?"":c;}
 private JSONObject call(String cookie,JSONObject body,String token)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL("https://noastudio.ai.kr/noa-bridge/user-playlists.php").openConnection();c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setInstanceFollowRedirects(false);if(!cookie.isEmpty())c.setRequestProperty("Cookie",cookie);
  try{if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Origin","https://noastudio.ai.kr");c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("X-NOA-CSRF",token);try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}int status=c.getResponseCode();if(status==401&&body==null)return new JSONObject().put("guest",true);if(status!=200)throw new IOException(status==409?"다른 기기에서 목록이 변경됐습니다. 다시 열어 주세요.":"재생목록을 저장하지 못했습니다. 연결과 로그인을 확인해 주세요.");try(InputStream input=c.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=input.read(b))!=-1){bytes.write(b,0,n);if(bytes.size()>512*1024)throw new IOException("재생목록이 너무 큽니다.");}return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));}}finally{c.disconnect();}
 }
 public JSONObject lists(String cookie)throws Exception{JSONObject response=call(cookie,null,"");if(response.optBoolean("guest")){JSONArray tracks=new JSONArray(context.getSharedPreferences("noa-native-my",Context.MODE_PRIVATE).getString("tracks","[]"));return new JSONObject().put("guest",true).put("items",new JSONArray().put(new JSONObject().put("title","My Playlist · 이 기기").put("tracks",tracks)));}return response;}
 public void add(String key,String cookie)throws Exception{JSONObject data=call(cookie,null,"");if(data.optBoolean("guest")){JSONArray list=new JSONArray(context.getSharedPreferences("noa-native-my",Context.MODE_PRIVATE).getString("tracks","[]"));for(int i=0;i<list.length();i++)if(key.equals(list.optString(i)))return;if(list.length()>=500)throw new IOException("한 목록에는 500곡까지 담을 수 있습니다.");list.put(key);context.getSharedPreferences("noa-native-my",Context.MODE_PRIVATE).edit().putString("tracks",list.toString()).apply();return;}JSONArray lists=data.getJSONArray("items");JSONObject chosen=null;for(int i=0;i<lists.length();i++)if("My Playlist".equals(lists.getJSONObject(i).optString("title")))chosen=lists.getJSONObject(i);if(chosen==null)chosen=new JSONObject().put("playlist_id",UUID.randomUUID().toString()).put("title","My Playlist").put("tracks",new JSONArray()).put("revision",0);JSONArray tracks=chosen.getJSONArray("tracks");boolean found=false;for(int i=0;i<tracks.length();i++)if(key.equals(tracks.optString(i)))found=true;if(!found)tracks.put(key);call(cookie,new JSONObject().put("id",chosen.getString("playlist_id")).put("title",chosen.getString("title")).put("tracks",tracks).put("expectedRevision",chosen.getInt("revision")),data.getString("csrf"));}
}
