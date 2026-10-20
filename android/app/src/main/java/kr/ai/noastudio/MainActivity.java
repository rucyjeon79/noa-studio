package kr.ai.noastudio;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

@android.annotation.SuppressLint({"UnsafeOptInUsageError","SetJavaScriptEnabled"})
public class MainActivity extends Activity {
 private static final String BASE="https://noastudio.ai.kr";
 private final int GOLD=Color.rgb(215,173,98), BLACK=Color.rgb(9,10,14);
 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final List<JSONObject> songs=new ArrayList<>();
 private LinearLayout root,list;private EditText search;private Spinner genres;private TextView status,now;
 private WebView browser;private MediaController controller;private ListenableFuture<MediaController> controllerFuture;
 private final Runnable tick=new Runnable(){public void run(){if(controller!=null&&now!=null){MediaItem item=controller.getCurrentMediaItem();now.setText(item==null?"NOA STUDIO":String.valueOf(item.mediaMetadata.title));}handler.postDelayed(this,1000);}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().setStatusBarColor(BLACK);getWindow().setNavigationBarColor(BLACK);getWindow().getDecorView().setOnApplyWindowInsetsListener((v,i)->{findViewById(android.R.id.content).setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});showLibrary();connectPlayer();handler.post(tick);}
 private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(GOLD);v.setPadding(18,14,18,14);return v;}
 private Button button(String value,Runnable action){Button b=new Button(this);b.setText(value);b.setTextColor(GOLD);b.setAllCaps(false);b.setOnClickListener(v->action.run());return b;}
 private void connectPlayer(){
  controllerFuture=new MediaController.Builder(this,new SessionToken(this,new ComponentName(this,PlaybackService.class))).buildAsync();
  controllerFuture.addListener(()->{try{controller=controllerFuture.get();}catch(Exception e){if(status!=null)status.setText("자체 음원 플레이어를 연결하지 못했습니다.");}},this::runOnUiThread);
 }
 private void showLibrary(){
  if(browser!=null){browser.destroy();browser=null;}
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BLACK);root.setPadding(12,12,12,12);setContentView(root);
  root.addView(text("NOA STUDIO",27));
  LinearLayout nav=new LinearLayout(this);nav.addView(button("홈",()->openPage(BASE+"/")));nav.addView(button("회원",()->openPage(BASE+"/bbs/login.php?url=%2Fnoa-music.php")));nav.addView(button("새로고침",this::loadCatalog));root.addView(nav);
  search=new EditText(this);search.setSingleLine();search.setTextColor(Color.WHITE);search.setHintTextColor(Color.GRAY);search.setHint("음악 제목 · EP 검색");root.addView(search);
  genres=new Spinner(this);String[] labels={"전체 장르","kpop-original","jpop-original","pop-original","thai-original","joseon-ballad","echoes-of-joseon","groovy-airy-pop","narrative-piano-indie","dreamy-deep-house","fantasy-ambient-edm","edm-kpop-club","latin-afrobeats-edm","panpop","your-story","cover-reborn"};
  ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,labels);adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);genres.setAdapter(adapter);root.addView(genres);
  status=text("음악 목록을 불러오는 중입니다.",14);root.addView(status);
  ScrollView scroll=new ScrollView(this);list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);scroll.addView(list);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  now=text("NOA STUDIO",14);root.addView(now);
  LinearLayout controls=new LinearLayout(this);
  controls.addView(button("이전",()->{if(controller!=null)controller.seekToPreviousMediaItem();}));
  controls.addView(button("재생/일시정지",()->{if(controller!=null){if(controller.isPlaying())controller.pause();else controller.play();}}));
  controls.addView(button("다음",()->{if(controller!=null)controller.seekToNextMediaItem();}));root.addView(controls);
  LinearLayout modes=new LinearLayout(this);modes.addView(button("반복",()->{if(controller!=null)controller.setRepeatMode(controller.getRepeatMode()==Player.REPEAT_MODE_OFF?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);}));
  modes.addView(button("셔플",()->{if(controller!=null)controller.setShuffleModeEnabled(!controller.getShuffleModeEnabled());}));root.addView(modes);
  search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int c,int a){}public void onTextChanged(CharSequence s,int st,int before,int count){render();}public void afterTextChanged(Editable e){}});
  genres.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int pos,long id){render();}public void onNothingSelected(AdapterView<?> p){}});
  render();loadCatalog();
 }
 private void loadCatalog(){
  status.setText("음악 목록을 불러오는 중입니다.");
  String cookie=CookieManager.getInstance().getCookie(BASE);
  executor.execute(()->{try{
   HttpURLConnection c=(HttpURLConnection)new URL(BASE+"/noa-bridge/catalog.php").openConnection();c.setConnectTimeout(20000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);
   if(cookie!=null)c.setRequestProperty("Cookie",cookie);
   if(c.getResponseCode()!=200)throw new Exception("Catalog HTTP "+c.getResponseCode());
   String raw;try(java.io.InputStream stream=c.getInputStream()){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=stream.read(block))!=-1)bytes.write(block,0,n);raw=bytes.toString(StandardCharsets.UTF_8.name());}finally{c.disconnect();}
   JSONArray items=new JSONObject(raw).getJSONArray("items");List<JSONObject> fetched=new ArrayList<>();for(int i=0;i<items.length();i++)fetched.add(items.getJSONObject(i));
   runOnUiThread(()->{songs.clear();songs.addAll(fetched);if(browser==null)render();});
  }catch(Exception e){android.util.Log.e("NoaApi","Catalog request failed",e);runOnUiThread(()->{if(browser==null)status.setText("목록을 불러오지 못했습니다. 인터넷 연결 후 새로고침해 주세요.");});}});
 }
 private void render(){
  if(list==null||browser!=null)return;list.removeAllViews();String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);String genre=genres.getSelectedItemPosition()==0?"":String.valueOf(genres.getSelectedItem());int count=0;
  for(JSONObject song:songs){String title=song.optString("title");String ep=song.optString("ep");if(!genre.isEmpty()&&!genre.equals(song.optString("genre")))continue;if(!(title+" EP."+ep).toLowerCase(Locale.ROOT).contains(query))continue;
   count++;Button card=button((ep.isEmpty()?"":"EP."+ep+" · ")+title+"\n"+song.optString("genre"),()->showSong(song));card.setGravity(android.view.Gravity.START);list.addView(card,new LinearLayout.LayoutParams(-1,-2));}
  status.setText(count+"개 문서 · 웹과 동일한 음악 데이터");
 }
 private void showSong(JSONObject song){
  LinearLayout detail=new LinearLayout(this);detail.setOrientation(LinearLayout.VERTICAL);detail.setBackgroundColor(BLACK);detail.setPadding(12,12,12,12);
  detail.addView(button("← 라이브러리",this::showLibrary));detail.addView(text(song.optString("title"),25));detail.addView(text(song.optString("genre"),15));
  String cast=song.optString("cast");detail.addView(text(cast.equals("duet")?"노아 & 노엘":cast.equals("male")?"노엘":cast.equals("female")?"노아":"",14));
  if(ownAudio(song.optString("audioUrl")))detail.addView(button("음원 재생",()->playAudio(song)));
  if(!song.optString("youtubeId").isEmpty())detail.addView(button("NOA STUDIO 플레이어",()->openPage(BASE+"/noa-music.php?track="+Uri.encode(song.optString("key")))));
  ScrollView scroll=new ScrollView(this);TextView lyrics=text(song.optString("lyrics","등록된 가사가 없습니다."),16);lyrics.setTextColor(Color.WHITE);lyrics.setTextIsSelectable(true);scroll.addView(lyrics);detail.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));setContentView(detail);
 }
 private boolean ownAudio(String value){Uri uri=Uri.parse(value);return "https".equals(uri.getScheme())&&"noastudio.ai.kr".equals(uri.getHost())&&uri.getPath()!=null&&uri.getPath().startsWith("/data/noa-audio/")&&!uri.getPath().contains("..");}
 private void playAudio(JSONObject selected){
  if(controller==null)return;List<MediaItem> queue=new ArrayList<>();int selectedIndex=0;
  for(JSONObject song:songs){String url=song.optString("audioUrl");if(!ownAudio(url))continue;if(song.optString("key").equals(selected.optString("key")))selectedIndex=queue.size();queue.add(new MediaItem.Builder().setMediaId(song.optString("key")).setUri(url).setMediaMetadata(new MediaMetadata.Builder().setTitle(song.optString("title")).setArtist("AI Artist Noa").build()).build());}
  if(queue.isEmpty())return;controller.setMediaItems(queue,selectedIndex,0);controller.prepare();controller.play();
 }
 private void openPage(String url){
  if(controller!=null)controller.pause();
  LinearLayout frame=new LinearLayout(this);frame.setOrientation(LinearLayout.VERTICAL);frame.setBackgroundColor(BLACK);frame.addView(button("← NOA STUDIO 라이브러리",this::showLibrary));
  browser=new WebView(this);WebSettings settings=browser.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptCookie(true);
  browser.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){if(!req.isForMainFrame())return false;Uri uri=req.getUrl();if("https".equals(uri.getScheme())&&"noastudio.ai.kr".equals(uri.getHost()))return false;if("https".equals(uri.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,uri));return true;}});
  frame.addView(browser,new LinearLayout.LayoutParams(-1,0,1));setContentView(frame);browser.loadUrl(url);
 }
 @Override public void onBackPressed(){if(browser!=null&&browser.canGoBack())browser.goBack();else showLibrary();}
 @Override protected void onPause(){if(browser!=null)browser.onPause();CookieManager.getInstance().flush();super.onPause();}
 @Override protected void onResume(){super.onResume();if(browser!=null)browser.onResume();}
 @Override protected void onDestroy(){handler.removeCallbacks(tick);if(browser!=null)browser.destroy();if(controllerFuture!=null)MediaController.releaseFuture(controllerFuture);executor.shutdownNow();super.onDestroy();}
}
