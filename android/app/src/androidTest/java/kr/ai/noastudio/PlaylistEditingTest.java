package kr.ai.noastudio;

import android.content.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PlaylistEditingTest {
 private Context context;private SharedPreferences preferences;private Map<String,?> backup;private NativePlaylistRepository repo;
 private static final String A="single:kpop-original:01",B="single:kpop-original:02";
 @Before public void setUp(){context=InstrumentationRegistry.getInstrumentation().getTargetContext();preferences=context.getSharedPreferences("noa-native-my",Context.MODE_PRIVATE);backup=preferences.getAll();preferences.edit().clear().commit();repo=new NativePlaylistRepository(context,(cookie,body,csrf)->{throw new AssertionError("Guest editing must not require network");});}
 @After public void restore(){SharedPreferences.Editor e=preferences.edit().clear();for(Map.Entry<String,?> row:backup.entrySet())if(row.getValue() instanceof String)e.putString(row.getKey(),(String)row.getValue());e.commit();}
 private JSONObject first(JSONObject session)throws Exception{return session.getJSONArray("items").getJSONObject(0);}
 @Test public void legacyGuestMigrationPreservesSongsAndAllowsOfflineEditing()throws Exception{
  preferences.edit().putString("tracks",new JSONArray().put(A).put(B).toString()).commit();JSONObject initial=repo.lists("");assertTrue(initial.getBoolean("guest"));JSONObject old=first(initial);assertEquals(2,old.getJSONArray("tracks").length());
  JSONObject saved=repo.save(initial,old,"나의 저녁",new JSONArray().put(B).put(A),"");assertEquals("나의 저녁",first(repo.lists("")).getString("title"));assertEquals(B,saved.getJSONArray("tracks").getString(0));assertEquals(A,new JSONArray(preferences.getString("tracks","[]")).getString(0));
  repo.add(A,"");assertEquals(2,first(repo.lists("")).getJSONArray("tracks").length());
  repo.save(repo.lists(""),saved,"나의 저녁",new JSONArray().put(B),"");assertEquals(1,first(new NativePlaylistRepository(context).lists("")).getJSONArray("tracks").length());
 }
 @Test public void multipleGuestListsAreIndependentAndLastDeletionKeepsAnEmptyDefault()throws Exception{
  repo.add(A,"");JSONObject session=repo.lists(""),original=first(session);JSONObject second=repo.create(session,"출근길","");repo.addTo(repo.lists(""),second,B,"");JSONObject after=repo.lists("");assertEquals(2,after.getJSONArray("items").length());assertEquals(A,first(after).getJSONArray("tracks").getString(0));JSONObject edited=after.getJSONArray("items").getJSONObject(1);assertEquals(B,edited.getJSONArray("tracks").getString(0));
  repo.deleteGuest(after,original);assertEquals("출근길",first(repo.lists("")).getString("title"));repo.deleteGuest(repo.lists(""),edited);JSONObject empty=repo.lists("");assertEquals(1,empty.getJSONArray("items").length());assertEquals(0,first(empty).getJSONArray("tracks").length());assertNotEquals(edited.getString("playlist_id"),first(empty).getString("playlist_id"));
 }
 @Test public void staleGuestWritesAndInvalidEditsDoNotOverwriteSavedState()throws Exception{
  JSONObject snapshot=repo.lists(""),before=first(snapshot);repo.save(snapshot,before,"먼저 저장",new JSONArray().put(A),"");
  try{repo.save(snapshot,before,"오래된 화면",new JSONArray().put(B),"");fail("Expected revision conflict");}catch(IOException expected){}
  JSONObject current=repo.lists("");try{repo.save(current,first(current)," ",new JSONArray(),"");fail("Empty name");}catch(IOException expected){}
  try{repo.save(current,first(current),"중복",new JSONArray().put(A).put(A),"");fail("Duplicate references");}catch(IOException expected){}
  assertEquals("먼저 저장",first(repo.lists("")).getString("title"));assertEquals(A,first(repo.lists("")).getJSONArray("tracks").getString(0));
 }
 @Test public void memberWritesUseTheDisplayedRevisionAndNeverFallBackToGuest()throws Exception{
  JSONObject member=new JSONObject().put("csrf","fixture-token").put("items",new JSONArray());JSONObject before=new JSONObject().put("playlist_id",UUID.randomUUID().toString()).put("title","계정 목록").put("tracks",new JSONArray().put(A)).put("revision",7);member.getJSONArray("items").put(before);AtomicReference<JSONObject> sent=new AtomicReference<>();AtomicInteger writes=new AtomicInteger();
  NativePlaylistRepository account=new NativePlaylistRepository(context,(cookie,body,csrf)->{assertEquals("member-cookie",cookie);if(body==null)return member;assertEquals("fixture-token",csrf);sent.set(body);writes.incrementAndGet();return new JSONObject().put("revision",8);});
  JSONObject view=account.lists("member-cookie");JSONObject saved=account.save(view,before,"이름 변경",new JSONArray().put(B).put(A),"member-cookie");assertEquals(7,sent.get().getInt("expectedRevision"));assertEquals(8,saved.getInt("revision"));assertEquals(B,sent.get().getJSONArray("tracks").getString(0));assertEquals(1,writes.get());assertNull(preferences.getString("items-v2",null));
  NativePlaylistRepository expired=new NativePlaylistRepository(context,(cookie,body,csrf)->{throw new IOException("로그인이 필요합니다.");});try{expired.save(view,before,"저장 실패",new JSONArray(),"member-cookie");fail("Expired login must fail");}catch(IOException expected){}assertNull(preferences.getString("items-v2",null));
 }
}
