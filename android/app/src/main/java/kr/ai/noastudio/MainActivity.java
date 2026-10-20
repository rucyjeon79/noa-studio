package kr.ai.noastudio;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.app.AlertDialog;
import android.content.SharedPreferences;
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
 private int GOLD=Color.rgb(213,185,121), BLACK=Color.rgb(23,25,28), FG=Color.rgb(241,238,231), MUTED=Color.rgb(182,181,179), PANEL=Color.rgb(32,35,40), LINE=Color.rgb(59,63,69);
 private JSONObject uiWords=new JSONObject();private String language="ko";private JSONArray themes;private String themeId="noa-studio";private final ExecutorService images=Executors.newFixedThreadPool(2);
 private final android.util.LruCache<String,Bitmap> covers=new android.util.LruCache<String,Bitmap>(8*1024*1024){protected int sizeOf(String k,Bitmap b){return b.getByteCount();}};
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private GradientDrawable surface(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));d.setStroke(dp(1),LINE);return d;}
 private String t(String key){if(language.equals("ko"))return key;JSONArray value=uiWords.optJSONArray(key);int index=language.equals("en")?0:language.equals("ja")?1:2;return value==null?key:value.optString(index,key);}
 private void chooseLanguage(){String[] names={"한국어","日本語","English","ไทย"},ids={"ko","ja","en","th"};int selected=0;for(int i=0;i<ids.length;i++)if(ids[i].equals(language))selected=i;new AlertDialog.Builder(this).setTitle(t("언어")).setSingleChoiceItems(names,selected,(dialog,index)->{getSharedPreferences("noa-design",MODE_PRIVATE).edit().putString("noa-view-lang",ids[index]).apply();language=ids[index];dialog.dismiss();showLibrary();}).setNegativeButton(t("닫기"),null).show();}
 private void readDesign(){try{SharedPreferences pref=getSharedPreferences("noa-design",MODE_PRIVATE);themeId=pref.getString("theme","noa-studio");language=pref.getString("noa-view-lang","ko");try(java.io.InputStream in=getAssets().open("noa-ui-words.json")){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] block=new byte[4096];int n;while((n=in.read(block))!=-1)bytes.write(block,0,n);uiWords=new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));}String raw;try(java.io.InputStream in=getAssets().open("noa-design.json")){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] block=new byte[4096];int n;while((n=in.read(block))!=-1)bytes.write(block,0,n);raw=bytes.toString(StandardCharsets.UTF_8.name());}themes=new JSONObject(raw).getJSONArray("themes");for(int i=0;i<themes.length();i++){JSONObject theme=themes.getJSONObject(i);if(!themeId.equals(theme.getString("id")))continue;JSONObject t=theme.getJSONObject("tokens");BLACK=Color.parseColor(t.getString("bg"));FG=Color.parseColor(t.getString("text"));MUTED=Color.parseColor(t.getString("muted"));PANEL=Color.parseColor(t.getString("surface"));LINE=Color.parseColor(t.getString("line"));GOLD=Color.parseColor(t.getString("accent"));}}catch(Exception e){android.util.Log.e("NoaDesign","Design asset unavailable",e);}}
 private void chooseTheme(){if(themes==null)return;String[] names=new String[themes.length()];int checked=0;for(int i=0;i<names.length;i++){names[i]=themes.optJSONObject(i).optString("name");if(themes.optJSONObject(i).optString("id").equals(themeId))checked=i;}new AlertDialog.Builder(this).setTitle("NOA STUDIO · "+t("테마")).setSingleChoiceItems(names,checked,(dialog,index)->{getSharedPreferences("noa-design",MODE_PRIVATE).edit().putString("theme",themes.optJSONObject(index).optString("id")).apply();readDesign();getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(BLACK));getWindow().getDecorView().setBackgroundColor(BLACK);getWindow().setStatusBarColor(BLACK);getWindow().setNavigationBarColor(BLACK);getWindow().getDecorView().setSystemUiVisibility(themeId.equals("noa-ivory")?View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0);dialog.dismiss();showLibrary();}).setNegativeButton(t("닫기"),null).setNeutralButton(t("언어"),(dialog,which)->chooseLanguage()).show();}
 private void loadCover(ImageView image,String url){if(images.isShutdown()||isDestroyed())return;Bitmap hit=covers.get(url);if(hit!=null){image.setImageBitmap(hit);return;}images.execute(()->{try{HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(10000);c.setReadTimeout(10000);c.setInstanceFollowRedirects(false);if(c.getResponseCode()!=200){c.disconnect();return;}Bitmap bitmap;try(java.io.InputStream in=c.getInputStream()){BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=2;bitmap=BitmapFactory.decodeStream(in,null,options);}finally{c.disconnect();}if(bitmap!=null){covers.put(url,bitmap);runOnUiThread(()->{if(url.equals(image.getTag()))image.setImageBitmap(bitmap);});}}catch(Exception ignored){}});}
 private void visibleCovers(){if(list==null)return;Rect rect=new Rect();for(int i=0;i<list.getChildCount();i++){View row=list.getChildAt(i);if(row instanceof LinearLayout&&row.getLocalVisibleRect(rect)){View v=((LinearLayout)row).getChildAt(0);if(v instanceof ImageView&&v.getTag() instanceof String&&v.getContentDescription()==null){v.setContentDescription("앨범 아트");loadCover((ImageView)v,(String)v.getTag());}}}}

 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final List<JSONObject> songs=new ArrayList<>();
 private LinearLayout root,list,nativeControls;private SeekBar seek;private boolean seeking=false,loading=true;private EditText search;private Spinner genres;private TextView status,now;
 private WebView browser;private MediaController controller;private ListenableFuture<MediaController> controllerFuture;
 private final Runnable tick=new Runnable(){public void run(){if(controller!=null&&now!=null){MediaItem item=controller.getCurrentMediaItem();now.setText(item==null?"NOA STUDIO":String.valueOf(item.mediaMetadata.title));if(seek!=null&&!seeking&&controller.getDuration()>0)seek.setProgress((int)(1000*controller.getCurrentPosition()/controller.getDuration()));}handler.postDelayed(this,1000);}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);readDesign();getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(BLACK));getWindow().getDecorView().setBackgroundColor(BLACK);getWindow().setStatusBarColor(BLACK);getWindow().setNavigationBarColor(BLACK);getWindow().getDecorView().setSystemUiVisibility(themeId.equals("noa-ivory")?View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0);getWindow().getDecorView().setOnApplyWindowInsetsListener((v,i)->{findViewById(android.R.id.content).setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});showLibrary();connectPlayer();handler.post(tick);}
 private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(FG);v.setFontFeatureSettings("kern");v.setPadding(dp(4),dp(8),dp(4),dp(8));return v;}
 private Button button(String value,Runnable action){Button b=new Button(this);b.setText(t(value));b.setTextColor(FG);b.setStateListAnimator(null);b.setElevation(0);b.setMinWidth(0);b.setTextSize(13);b.setBackground(surface(PANEL,9));b.setMinHeight(dp(44));b.setPadding(dp(14),dp(8),dp(14),dp(8));b.setAllCaps(false);b.setOnClickListener(v->action.run());return b;}
 private void connectPlayer(){
  controllerFuture=new MediaController.Builder(this,new SessionToken(this,new ComponentName(this,PlaybackService.class))).buildAsync();
  controllerFuture.addListener(()->{try{controller=controllerFuture.get();}catch(Exception e){if(status!=null)status.setText("자체 음원 플레이어를 연결하지 못했습니다.");}},this::runOnUiThread);
 }
 private void showLibrary(){
  if(browser!=null){browser.destroy();browser=null;}
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BLACK);root.setPadding(dp(20),dp(18),dp(20),dp(12));setContentView(root);
  TextView brand=text("NOA STUDIO",23);brand.setLetterSpacing(.12f);root.addView(brand);TextView kicker=text("MUSIC. STORIES. STARLIGHT.",10);kicker.setLetterSpacing(.16f);kicker.setTextColor(MUTED);root.addView(kicker);
  LinearLayout nav=new LinearLayout(this);nav.addView(button("홈",()->openPage(BASE+"/")));nav.addView(button("회원",()->openPage(BASE+"/bbs/login.php?url=%2Fnoa-music.php")));nav.addView(button("새로고침",this::loadCatalog));nav.addView(button("설정",this::chooseTheme));for(int i=0;i<nav.getChildCount();i++)nav.getChildAt(i).setLayoutParams(new LinearLayout.LayoutParams(0,-2,1));root.addView(nav);
  search=new EditText(this);search.setSingleLine();search.setTextColor(FG);search.setHintTextColor(MUTED);search.setTextSize(15);search.setPadding(dp(14),dp(12),dp(14),dp(12));search.setBackground(surface(PANEL,10));search.setHint(t("음악 제목 · EP 검색"));root.addView(search);
  genres=new Spinner(this);String[] labels={"전체 장르","kpop-original","jpop-original","pop-original","thai-original","joseon-ballad","echoes-of-joseon","groovy-airy-pop","narrative-piano-indie","dreamy-deep-house","fantasy-ambient-edm","edm-kpop-club","latin-afrobeats-edm","panpop","your-story","cover-reborn"};
  ArrayAdapter<String> adapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_item,labels){@Override public View getView(int position,View convert,android.view.ViewGroup parent){TextView v=(TextView)super.getView(position,convert,parent);v.setTextColor(FG);v.setText(position==0?t(labels[position]):labels[position].replace('-',' ').toUpperCase(Locale.ROOT));v.setPadding(dp(6),dp(14),dp(6),dp(14));return v;}@Override public View getDropDownView(int position,View convert,android.view.ViewGroup parent){TextView v=(TextView)super.getDropDownView(position,convert,parent);v.setTextColor(FG);v.setBackgroundColor(PANEL);v.setText(position==0?t(labels[position]):labels[position].replace('-',' ').toUpperCase(Locale.ROOT));v.setPadding(dp(12),dp(12),dp(12),dp(12));return v;}};adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);genres.setBackgroundTintList(android.content.res.ColorStateList.valueOf(FG));genres.setAdapter(adapter);root.addView(genres);
  status=text(t("음악 목록을 불러오는 중입니다."),14);root.addView(status);
  ScrollView scroll=new ScrollView(this);scroll.setOnScrollChangeListener((v,x,y,oldX,oldY)->visibleCovers());list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);scroll.addView(list);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  nativeControls=new LinearLayout(this);nativeControls.setOrientation(LinearLayout.VERTICAL);nativeControls.setVisibility(View.GONE);root.addView(nativeControls);now=text("NOA STUDIO",14);nativeControls.addView(now);seek=new SeekBar(this);seek.setMax(1000);nativeControls.addView(seek);seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int p,boolean user){}public void onStartTrackingTouch(SeekBar s){seeking=true;}public void onStopTrackingTouch(SeekBar s){if(controller!=null&&controller.getDuration()>0)controller.seekTo(controller.getDuration()*s.getProgress()/1000);seeking=false;}});
  LinearLayout controls=new LinearLayout(this);
  controls.addView(button("이전",()->{if(controller!=null)controller.seekToPreviousMediaItem();}));
  controls.addView(button("재생/일시정지",()->{if(controller!=null){if(controller.isPlaying())controller.pause();else controller.play();}}));
  controls.addView(button("다음",()->{if(controller!=null)controller.seekToNextMediaItem();}));nativeControls.addView(controls);
  LinearLayout modes=new LinearLayout(this);modes.addView(button("반복",()->{if(controller!=null)controller.setRepeatMode(controller.getRepeatMode()==Player.REPEAT_MODE_OFF?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);}));
  modes.addView(button("셔플",()->{if(controller!=null)controller.setShuffleModeEnabled(!controller.getShuffleModeEnabled());}));nativeControls.addView(modes);
  search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int c,int a){}public void onTextChanged(CharSequence s,int st,int before,int count){render();}public void afterTextChanged(Editable e){}});
  genres.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int pos,long id){render();}public void onNothingSelected(AdapterView<?> p){}});
  render();if(songs.isEmpty())loadCatalog();
 }
 private void loadCatalog(){loadCatalog(0);}
 private void loadCatalog(int attempt){
  loading=true;status.setText(t("음악 목록을 불러오는 중입니다."));
  // Native catalog is public. GnuBoard login remains in the same-origin web session.
  executor.execute(()->{try{
   HttpURLConnection c=(HttpURLConnection)new URL(BASE+"/noa-bridge/catalog.php").openConnection();c.setConnectTimeout(20000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);
   if(c.getResponseCode()!=200)throw new Exception("Catalog HTTP "+c.getResponseCode());
   String raw;try(java.io.InputStream stream=c.getInputStream()){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=stream.read(block))!=-1)bytes.write(block,0,n);raw=bytes.toString(StandardCharsets.UTF_8.name());}finally{c.disconnect();}
   JSONArray items=new JSONObject(raw).getJSONArray("items");List<JSONObject> fetched=new ArrayList<>();for(int i=0;i<items.length();i++)fetched.add(items.getJSONObject(i));
   runOnUiThread(()->{loading=false;songs.clear();songs.addAll(fetched);if(browser==null)render();});
  }catch(Exception e){android.util.Log.e("NoaApi","Catalog request failed: "+e.getClass().getSimpleName()+": "+e.getMessage(),e);runOnUiThread(()->{if(attempt<2&&!isDestroyed()&&!String.valueOf(e.getMessage()).matches(".*HTTP (400|401|403|404|429).*")){handler.postDelayed(()->loadCatalog(attempt+1),1500);return;}loading=false;if(browser==null)status.setText(t("목록을 불러오지 못했습니다. 인터넷 연결 후 새로고침해 주세요."));});}});
 }
 private void render(){
  if(list==null||browser!=null)return;boolean hasAudio=false;for(JSONObject record:songs)if(ownAudio(record.optString("audioUrl")))hasAudio=true;if(nativeControls!=null)nativeControls.setVisibility(hasAudio?View.VISIBLE:View.GONE);list.removeAllViews();String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);String genre=genres.getSelectedItemPosition()==0?"":String.valueOf(genres.getSelectedItem());int count=0;
  for(JSONObject song:songs){String title=song.optString("title");String ep=song.optString("ep");if(!genre.isEmpty()&&!genre.equals(song.optString("genre")))continue;if(!(title+" EP."+ep).toLowerCase(Locale.ROOT).contains(query))continue;
   count++;LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.HORIZONTAL);card.setGravity(android.view.Gravity.CENTER_VERTICAL);card.setPadding(dp(10),dp(10),dp(14),dp(10));card.setBackground(surface(PANEL,12));ImageView cover=new ImageView(this);cover.setScaleType(ImageView.ScaleType.CENTER_CROP);String id=song.optString("youtubeId");if(!id.isEmpty())cover.setTag("https://i.ytimg.com/vi/"+id+"/mqdefault.jpg");card.addView(cover,new LinearLayout.LayoutParams(dp(70),dp(62)));LinearLayout copy=new LinearLayout(this);copy.setPadding(dp(14),0,0,0);copy.setOrientation(LinearLayout.VERTICAL);TextView heading=text((ep.isEmpty()?song.optString("act").isEmpty()?"":"ACT."+song.optString("act")+" · ":"EP."+ep+" · ")+title,15);heading.setPadding(0,0,0,dp(5));TextView meta=text(song.optString("genre").replace('-',' ').toUpperCase(Locale.ROOT),10);meta.setPadding(0,0,0,0);meta.setTextColor(MUTED);copy.addView(heading);copy.addView(meta);card.addView(copy,new LinearLayout.LayoutParams(0,-2,1));card.setOnClickListener(v->showSong(song));card.setClickable(true);card.setFocusable(true);LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);params.bottomMargin=dp(10);list.addView(card,params);}
  handler.post(this::visibleCovers);status.setTextColor(MUTED);status.setText(loading&&songs.isEmpty()?t("음악 목록을 불러오는 중입니다."):count+t("개 문서 · 웹과 동일한 음악 데이터"));
 }
 private void showSong(JSONObject song){
  LinearLayout detail=new LinearLayout(this);detail.setOrientation(LinearLayout.VERTICAL);detail.setBackgroundColor(BLACK);detail.setPadding(12,12,12,12);
  detail.addView(button("← 라이브러리",this::showLibrary));detail.addView(text(song.optString("title"),25));detail.addView(text(song.optString("genre"),15));
  String cast=song.optString("cast");detail.addView(text(cast.equals("duet")?"노아 & 노엘":cast.equals("male")?"노엘":cast.equals("female")?"노아":"",14));
  if(ownAudio(song.optString("audioUrl")))detail.addView(button("음원 재생",()->playAudio(song)));
  if(!song.optString("youtubeId").isEmpty())detail.addView(button("NOA STUDIO 플레이어",()->openPage(BASE+"/noa-music.php?track="+Uri.encode(song.optString("key")))));
  ScrollView scroll=new ScrollView(this);TextView lyrics=text(song.optString("kind").equals("playlist")?song.optString("tracklist"):song.optString("lyrics","등록된 가사가 없습니다."),16);lyrics.setTextColor(FG);lyrics.setTextIsSelectable(true);scroll.addView(lyrics);detail.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));setContentView(detail);
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
 @Override protected void onPause(){if(browser!=null){browser.evaluateJavascript("window.dispatchEvent(new Event('noa-background'));",null);browser.onPause();}CookieManager.getInstance().flush();super.onPause();}
 @Override protected void onResume(){super.onResume();if(browser!=null)browser.onResume();}
 @Override protected void onDestroy(){handler.removeCallbacks(tick);if(browser!=null)browser.destroy();if(controllerFuture!=null)MediaController.releaseFuture(controllerFuture);executor.shutdownNow();images.shutdownNow();super.onDestroy();}
}
