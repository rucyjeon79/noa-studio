package kr.ai.noastudio;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.CookieManager;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Account writes retain server CSRF/revision checks; guest writes stay on this device. */
public final class NativePlaylistRepository {
 interface Transport { JSONObject call(String cookie,JSONObject body,String token)throws Exception; }
 private static final Object GUEST_LOCK=new Object();
 private static final String DEFAULT_ID="00000000-0000-4000-8000-000000000001";
 private final SharedPreferences local;
 private final Transport transport;
 public NativePlaylistRepository(Context c){this(c,null);}
 NativePlaylistRepository(Context c,Transport t){local=c.getSharedPreferences("noa-native-my",Context.MODE_PRIVATE);transport=t==null?this::request:t;}
 public String cookie(){String c=CookieManager.getInstance().getCookie("https://noastudio.ai.kr");return c==null?"":c;}
 private JSONObject request(String cookie,JSONObject body,String token)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL("https://noastudio.ai.kr/noa-bridge/user-playlists.php").openConnection();c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setInstanceFollowRedirects(false);if(!cookie.isEmpty())c.setRequestProperty("Cookie",cookie);
  try{if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Origin","https://noastudio.ai.kr");c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("X-NOA-CSRF",token);try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}int status=c.getResponseCode();if(status==401&&body==null)return new JSONObject().put("guest",true);if(status!=200)throw new IOException(status==409?"다른 기기에서 목록이 변경됐습니다. 다시 열어 주세요.":"재생목록을 저장하지 못했습니다. 연결과 로그인을 확인해 주세요.");try(InputStream input=c.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=input.read(b))!=-1){bytes.write(b,0,n);if(bytes.size()>512*1024)throw new IOException("재생목록이 너무 큽니다.");}return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));}}finally{c.disconnect();}
 }
 private JSONObject item(String id,String title,JSONArray tracks,int revision)throws JSONException{return new JSONObject().put("playlist_id",id).put("title",title).put("tracks",tracks).put("revision",revision);}
 private JSONArray guestItems()throws Exception{
  String saved=local.getString("items-v2",null);
  if(saved!=null)return new JSONArray(saved);
  // Read the original single-list value once without removing or overwriting it.
  return new JSONArray().put(item(DEFAULT_ID,"My Playlist · 이 기기",new JSONArray(local.getString("tracks","[]")),1));
 }
 private void persist(JSONArray items)throws IOException{if(!local.edit().putString("items-v2",items.toString()).commit())throw new IOException("재생목록을 기기에 저장하지 못했습니다.");}
 public JSONObject lists(String cookie)throws Exception{
  JSONObject response=cookie.isEmpty()?new JSONObject().put("guest",true):transport.call(cookie,null,"");
  if(response.optBoolean("guest")){synchronized(GUEST_LOCK){return new JSONObject().put("guest",true).put("items",guestItems());}}
  return response;
 }
 private void validate(String title,JSONArray tracks)throws Exception{
  if(title.trim().isEmpty()||title.codePointCount(0,title.length())>160)throw new IOException("이름은 1~160자로 입력해 주세요.");
  if(tracks.length()>500)throw new IOException("한 목록에는 500곡까지 담을 수 있습니다.");
  Set<String> seen=new HashSet<>();for(int i=0;i<tracks.length();i++){String key=tracks.getString(i);if(!key.matches("^(single|playlist|story):[a-z0-9:_-]{1,180}$")||!seen.add(key))throw new IOException("곡 목록을 다시 확인해 주세요.");}
 }
 /** A snapshot is never silently refreshed before a write: conflicting edits remain detectable. */
 public JSONObject save(JSONObject session,JSONObject previous,String title,JSONArray tracks,String cookie)throws Exception{
  validate(title,tracks);String id=previous.getString("playlist_id");int revision=previous.getInt("revision");
  if(session.optBoolean("guest")){synchronized(GUEST_LOCK){JSONArray items=guestItems();int at=-1;for(int i=0;i<items.length();i++)if(id.equals(items.getJSONObject(i).getString("playlist_id")))at=i;
   if(at<0&&revision!=0||at>=0&&items.getJSONObject(at).getInt("revision")!=revision)throw new IOException("목록이 변경됐습니다. 다시 열어 주세요.");
   if(at<0&&items.length()>=50)throw new IOException("재생목록은 50개까지 만들 수 있습니다.");
   JSONObject updated=item(id,title,new JSONArray(tracks.toString()),revision+1);items.put(at<0?items.length():at,updated);persist(items);return updated;
  }}
  JSONObject result=transport.call(cookie,new JSONObject().put("id",id).put("title",title).put("tracks",tracks).put("expectedRevision",revision),session.getString("csrf"));
  return item(id,title,new JSONArray(tracks.toString()),result.getInt("revision"));
 }
 public JSONObject create(JSONObject session,String title,String cookie)throws Exception{return save(session,item(UUID.randomUUID().toString(),title,new JSONArray(),0),title,new JSONArray(),cookie);}
 public void deleteGuest(JSONObject session,JSONObject previous)throws Exception{
  if(!session.optBoolean("guest"))throw new IOException("계정 재생목록 삭제는 현재 지원되지 않습니다.");
  synchronized(GUEST_LOCK){JSONArray current=guestItems(),kept=new JSONArray();boolean found=false;for(int i=0;i<current.length();i++){JSONObject row=current.getJSONObject(i);if(row.getString("playlist_id").equals(previous.getString("playlist_id"))){if(row.getInt("revision")!=previous.getInt("revision"))throw new IOException("목록이 변경됐습니다. 다시 열어 주세요.");found=true;}else kept.put(row);}if(!found)throw new IOException("목록이 변경됐습니다. 다시 열어 주세요.");if(kept.length()==0)kept.put(item(UUID.randomUUID().toString(),"My Playlist · 이 기기",new JSONArray(),1));persist(kept);}
 }
 public void addTo(JSONObject session,JSONObject chosen,String key,String cookie)throws Exception{
  JSONArray tracks=new JSONArray(chosen.getJSONArray("tracks").toString());for(int i=0;i<tracks.length();i++)if(key.equals(tracks.getString(i)))return;tracks.put(key);save(session,chosen,chosen.getString("title"),tracks,cookie);
 }
 public void add(String key,String cookie)throws Exception{
  JSONObject data=lists(cookie);JSONArray items=data.getJSONArray("items");JSONObject chosen=null;
  for(int i=0;i<items.length();i++)if("My Playlist".equals(items.getJSONObject(i).optString("title")))chosen=items.getJSONObject(i);
  if(chosen==null&&items.length()>0)chosen=items.getJSONObject(0);
  if(chosen==null)chosen=item(UUID.randomUUID().toString(),"My Playlist",new JSONArray(),0);
  addTo(data,chosen,key,cookie);
 }
}
