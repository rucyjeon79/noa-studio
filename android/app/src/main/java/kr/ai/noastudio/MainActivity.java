package kr.ai.noastudio;

import android.app.Activity;
import android.app.DownloadManager;
import android.os.Environment;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.URLUtil;
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
 private ValueCallback<Uri[]> fileSelection;
 private static final int AUDIO_PICK_REQUEST=7201;
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
 private void loadCover(ImageView image,String url){if(images.isShutdown()||isDestroyed())return;Bitmap hit=covers.get(url);if(hit!=null){image.setImageBitmap(hit);image.setContentDescription(image.getTag(R.id.noa_art_label) instanceof String?(String)image.getTag(R.id.noa_art_label):"앨범 아트");return;}images.execute(()->{try{Bitmap cached=covers.get(url);if(cached!=null){runOnUiThread(()->{if(url.equals(image.getTag())){image.setImageBitmap(cached);image.setContentDescription(image.getTag(R.id.noa_art_label) instanceof String?(String)image.getTag(R.id.noa_art_label):"앨범 아트");}});return;}HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(10000);c.setReadTimeout(10000);c.setInstanceFollowRedirects(false);if(c.getResponseCode()!=200){c.disconnect();return;}Bitmap bitmap;try(java.io.InputStream in=c.getInputStream()){BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=2;bitmap=BitmapFactory.decodeStream(in,null,options);}finally{c.disconnect();}if(bitmap!=null){covers.put(url,bitmap);runOnUiThread(()->{if(url.equals(image.getTag())){image.setImageBitmap(bitmap);image.setContentDescription(image.getTag(R.id.noa_art_label) instanceof String?(String)image.getTag(R.id.noa_art_label):"앨범 아트");}});}}catch(Exception ignored){}});}
 private void visibleCovers(){if(list==null)return;Rect rect=new Rect();for(int i=0;i<list.getChildCount();i++){View row=list.getChildAt(i);if(row instanceof LinearLayout&&row.getLocalVisibleRect(rect)){View v=((LinearLayout)row).getChildAt(0);if(v instanceof ImageView&&v.getTag() instanceof String&&v.getContentDescription()==null){v.setContentDescription("NOA STUDIO");loadCover((ImageView)v,(String)v.getTag());}}}}

 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final List<JSONObject> songs=new ArrayList<>();
 private String browseGroup="";private int browseAct=0,browsePage=0;private boolean browseAll=false;
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
  LinearLayout brandRow=new LinearLayout(this);brandRow.setGravity(android.view.Gravity.CENTER_VERTICAL);TextView brand=text("NOA STUDIO",23);brand.setLetterSpacing(.12f);brandRow.addView(brand,new LinearLayout.LayoutParams(0,-2,1));ImageButton preferences=new ImageButton(this);preferences.setImageResource(android.R.drawable.ic_menu_manage);preferences.setImageTintList(android.content.res.ColorStateList.valueOf(MUTED));preferences.setBackgroundColor(Color.TRANSPARENT);preferences.setContentDescription(t("설정"));preferences.setOnClickListener(v->chooseTheme());brandRow.addView(preferences,new LinearLayout.LayoutParams(dp(44),dp(44)));root.addView(brandRow);TextView kicker=text("MUSIC. STORIES. STARLIGHT.",10);kicker.setLetterSpacing(.16f);kicker.setTextColor(MUTED);root.addView(kicker);
  LinearLayout nav=new LinearLayout(this);nav.addView(button("홈",()->openPage(BASE+"/noa2.php")));nav.addView(button("음원",()->{browseGroup="";browseAct=0;browsePage=0;browseAll=false;showLibrary();}));nav.addView(button("YouTube",()->openPage(BASE+"/noa-youtube.php")));nav.addView(button("세계관",()->openPage(BASE+"/noa2.php#noa-world")));nav.addView(button("MY",()->openPage(BASE+"/noa-my.php")));for(int i=0;i<nav.getChildCount();i++){TextView item=(TextView)nav.getChildAt(i);item.setSingleLine(true);item.setBackgroundColor(Color.TRANSPARENT);item.setAutoSizeTextTypeUniformWithConfiguration(10,13,1,android.util.TypedValue.COMPLEX_UNIT_SP);item.setPadding(dp(4),dp(8),dp(4),dp(8));item.setLayoutParams(new LinearLayout.LayoutParams(0,dp(48),1));}root.addView(nav);
  search=new EditText(this);search.setSingleLine();search.setTextColor(FG);search.setHintTextColor(MUTED);search.setTextSize(15);search.setPadding(dp(14),dp(12),dp(14),dp(12));search.setBackground(surface(PANEL,10));search.setHint(t("음악 제목 · EP 검색"));root.addView(search);
  genres=new Spinner(this);String[] labels={"전체 장르","kpop-original","jpop-original","pop-original","thai-original","joseon-ballad","echoes-of-joseon","groovy-airy-pop","narrative-piano-indie","dreamy-deep-house","fantasy-ambient-edm","edm-kpop-club","latin-afrobeats-edm","panpop","your-story","cover-reborn"};
  ArrayAdapter<String> adapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_item,labels){@Override public View getView(int position,View convert,android.view.ViewGroup parent){TextView v=(TextView)super.getView(position,convert,parent);v.setTextColor(FG);v.setText(position==0?t(labels[position]):labels[position].replace('-',' ').toUpperCase(Locale.ROOT));v.setPadding(dp(6),dp(14),dp(6),dp(14));return v;}@Override public View getDropDownView(int position,View convert,android.view.ViewGroup parent){TextView v=(TextView)super.getDropDownView(position,convert,parent);v.setTextColor(FG);v.setBackgroundColor(PANEL);v.setText(position==0?t(labels[position]):labels[position].replace('-',' ').toUpperCase(Locale.ROOT));v.setPadding(dp(12),dp(12),dp(12),dp(12));return v;}};adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);genres.setBackgroundTintList(android.content.res.ColorStateList.valueOf(FG));genres.setAdapter(adapter);root.addView(genres);
  status=text(t("음악 목록을 불러오는 중입니다."),14);root.addView(status);
  ScrollView scroll=new ScrollView(this);scroll.setOnScrollChangeListener((v,x,y,oldX,oldY)->visibleCovers());list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);list.addOnLayoutChangeListener((v,l,t,r,b,oldL,oldT,oldR,oldB)->visibleCovers());scroll.addView(list);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  nativeControls=new LinearLayout(this);nativeControls.setOrientation(LinearLayout.VERTICAL);nativeControls.setVisibility(View.GONE);root.addView(nativeControls);now=text("NOA STUDIO",14);nativeControls.addView(now);seek=new SeekBar(this);seek.setMax(1000);nativeControls.addView(seek);seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int p,boolean user){}public void onStartTrackingTouch(SeekBar s){seeking=true;}public void onStopTrackingTouch(SeekBar s){if(controller!=null&&controller.getDuration()>0)controller.seekTo(controller.getDuration()*s.getProgress()/1000);seeking=false;}});
  LinearLayout controls=new LinearLayout(this);
  controls.addView(button("이전",()->{if(controller!=null)controller.seekToPreviousMediaItem();}));
  controls.addView(button("재생/일시정지",()->{if(controller!=null){if(controller.isPlaying())controller.pause();else controller.play();}}));
  controls.addView(button("다음",()->{if(controller!=null)controller.seekToNextMediaItem();}));nativeControls.addView(controls);
  LinearLayout modes=new LinearLayout(this);modes.addView(button("반복",()->{if(controller!=null)controller.setRepeatMode(controller.getRepeatMode()==Player.REPEAT_MODE_OFF?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);}));
  modes.addView(button("셔플",()->{if(controller!=null)controller.setShuffleModeEnabled(!controller.getShuffleModeEnabled());}));nativeControls.addView(modes);
  search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int c,int a){}public void onTextChanged(CharSequence s,int st,int before,int count){browsePage=0;render();}public void afterTextChanged(Editable e){}});
  genres.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int pos,long id){browseAct=0;browsePage=0;render();}public void onNothingSelected(AdapterView<?> p){}});
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
   JSONArray items=new JSONObject(raw).getJSONArray("items");List<JSONObject> fetched=new ArrayList<>();for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);if("playlist".equals(item.optString("kind"))||!item.optString("sunoUrl").isEmpty()||ownAudio(item.optString("audioUrl")))fetched.add(item);};
   runOnUiThread(()->{loading=false;songs.clear();songs.addAll(fetched);if(browser==null)render();});
  }catch(Exception e){android.util.Log.e("NoaApi","Catalog request failed: "+e.getClass().getSimpleName()+": "+e.getMessage(),e);runOnUiThread(()->{if(attempt<2&&!isDestroyed()&&!String.valueOf(e.getMessage()).matches(".*HTTP (400|401|403|404|429).*")){handler.postDelayed(()->loadCatalog(attempt+1),1500);return;}loading=false;if(browser==null)status.setText(t("목록을 불러오지 못했습니다. 인터넷 연결 후 새로고침해 주세요."));});}});
 }
 private void render(){
  if(list==null||browser!=null)return;boolean hasAudio=false;for(JSONObject record:songs)if(ownAudio(record.optString("audioUrl")))hasAudio=true;if(nativeControls!=null)nativeControls.setVisibility(hasAudio?View.VISIBLE:View.GONE);list.removeAllViews();String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);String genre=genres.getSelectedItemPosition()==0?"":String.valueOf(genres.getSelectedItem());int count=0;
  if(!query.isEmpty())genre="";
  if(query.isEmpty()&&genre.isEmpty()&&!browseAll){
   if(browseGroup.isEmpty()){
    String[][] groups={{"original","오리지널 장르"},{"ep","EP 장르"},{"story","사연곡"},{"cover","커버곡"}};
    for(String[] group:groups){JSONObject first=null;int total=0;for(JSONObject r:songs)if(group[0].equals(groupOf(r.optString("genre")))){if(first==null)first=r;if(!"playlist".equals(r.optString("kind")))total++;}browseCard(t(group[1])+" · "+total+"곡",first,()->{browseGroup=group[0];browseAct=0;browsePage=0;render();});}
   }else{
    browseCard("← "+t("음원"),null,()->{browseGroup="";render();});
    for(int i=1;i<genres.getCount();i++){final int position=i;String g=String.valueOf(genres.getItemAtPosition(i));if(!browseGroup.equals(groupOf(g)))continue;JSONObject first=null;for(JSONObject r:songs)if(g.equals(r.optString("genre"))){first=r;break;}browseCard(g.replace('-',' ').toUpperCase(Locale.ROOT),first,()->genres.setSelection(position));}
   }
   browseCard(t("전체 검색·목록"),null,()->{browseAll=true;browsePage=0;render();});finishBrowseStatus();return;
  }
  if(query.isEmpty()&&!genre.isEmpty()&&browseAct==0&&!browseAll){
   java.util.SortedSet<Integer> acts=new java.util.TreeSet<>();for(JSONObject r:songs)if(genre.equals(r.optString("genre"))&&actOf(r)>0)acts.add(actOf(r));
   if(!acts.isEmpty()){browseCard("← "+t("음원"),null,()->{browseGroup="";genres.setSelection(0);});for(int act:acts){JSONObject first=null;for(JSONObject r:songs)if(genre.equals(r.optString("genre"))&&actOf(r)==act){first=r;break;}browseCard("ACT "+act+" · EP."+((act-1)*10+1)+"–"+(act*10),first,()->{browseAct=act;browsePage=0;render();});}finishBrowseStatus();return;}
  }
  final int offset=browsePage*24;int matched=0;
  for(JSONObject song:songs){if("playlist".equals(song.optString("kind")))continue;String title=song.optString("title");String ep=value(song,"ep");if(!genre.isEmpty()&&!genre.equals(song.optString("genre")))continue;if(query.isEmpty()&&browseAct>0&&actOf(song)!=browseAct)continue;if(!(title+" EP."+ep).toLowerCase(Locale.ROOT).contains(query))continue;
   matched++;if(matched<=offset||matched>offset+24)continue;
   count++;LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.HORIZONTAL);card.setGravity(android.view.Gravity.CENTER_VERTICAL);card.setPadding(dp(10),dp(10),dp(14),dp(10));card.setBackground(surface(PANEL,12));ImageView cover=new ImageView(this);cover.setImageResource(android.R.drawable.ic_media_play);cover.setScaleType(ImageView.ScaleType.FIT_CENTER);String art=song.optString("coverImageUrl");if(art.startsWith("/noa-assets/"))cover.setTag(BASE+art);card.addView(cover,new LinearLayout.LayoutParams(dp(56),dp(56)));LinearLayout copy=new LinearLayout(this);copy.setPadding(dp(14),0,0,0);copy.setOrientation(LinearLayout.VERTICAL);TextView heading=text((ep.isEmpty()?value(song,"act").isEmpty()?"":"ACT."+value(song,"act")+" · ":"EP."+ep+" · ")+title,15);heading.setPadding(0,0,0,dp(5));heading.setMaxLines(2);heading.setEllipsize(android.text.TextUtils.TruncateAt.END);TextView meta=text(song.optString("genre").replace('-',' ').toUpperCase(Locale.ROOT),10);meta.setPadding(0,0,0,0);meta.setTextColor(MUTED);copy.addView(heading);copy.addView(meta);card.addView(copy,new LinearLayout.LayoutParams(0,-2,1));card.setOnClickListener(v->showSong(song));card.setClickable(true);card.setFocusable(true);LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);params.bottomMargin=dp(10);list.addView(card,params);}
  if(matched>24){LinearLayout pages=new LinearLayout(this);if(browsePage>0)pages.addView(button("‹",()->{browsePage--;render();}));pages.addView(text((browsePage+1)+" / "+((matched+23)/24),13));if(matched>offset+24)pages.addView(button("›",()->{browsePage++;render();}));list.addView(pages);}
  handler.post(this::visibleCovers);status.setTextColor(MUTED);status.setText(loading&&songs.isEmpty()?t("음악 목록을 불러오는 중입니다."):matched+"개 항목 · 24개씩 표시");
 }
 private String value(JSONObject row,String key){return row.isNull(key)?"":row.optString(key,"");}
 private String genrePoster(String genre){switch(genre){case "kpop-original":return "/noa-assets/splash/kpop-original-g2-a.jpg";case "jpop-original":return "/noa-assets/splash/jpop-original-g2-a.jpg";case "pop-original":return "/noa-assets/splash/pop-original-g2-a.jpg";case "thai-original":return "/noa-assets/splash/thai-original-g2-a.jpg";case "joseon-ballad":return "/noa-assets/splash/joseon-g2-a.jpg";case "panpop":return "/noa-assets/splash/panpop-g2-a.jpg";case "echoes-of-joseon":return "/noa-assets/splash/rain-g2-a.jpg";case "latin-afrobeats-edm":return "/noa-assets/splash/latin-g2-a.jpg";case "edm-kpop-club":return "/noa-assets/splash/hall-g2-a.jpg";case "dreamy-deep-house":return "/noa-assets/splash/dream-g2-a.jpg";case "fantasy-ambient-edm":return "/noa-assets/splash/fantasy-g2-a.jpg";case "groovy-airy-pop":return "/noa-assets/splash/bridge-g2-a.jpg";case "narrative-piano-indie":return "/noa-assets/splash/room-g2-a.jpg";case "your-story":return "/noa-assets/splash/your-story-g2-a.jpg";case "cover-reborn":return "/noa-assets/splash/cover-reborn-g2-a.jpg";default:return "/noa-assets/papa-logo.png";}}
 private String groupOf(String genre){if(java.util.Arrays.asList("kpop-original","jpop-original","pop-original","thai-original").contains(genre))return "original";if(genre.equals("your-story"))return "story";if(genre.equals("cover-reborn"))return "cover";return "ep";}
 private int actOf(JSONObject row){return row.optInt("act")>0?row.optInt("act"):(row.optInt("ep")+9)/10;}
 private void finishBrowseStatus(){long songCount=songs.stream().filter(r->!"playlist".equals(r.optString("kind"))).count();status.setTextColor(MUTED);status.setText(loading&&songs.isEmpty()?t("음악 목록을 불러오는 중입니다."):songCount+"곡 · "+(songs.size()-songCount)+" ACT·목록");handler.post(this::visibleCovers);}
 private void browseCard(String label,JSONObject artwork,Runnable action){LinearLayout row=new LinearLayout(this);row.setGravity(android.view.Gravity.CENTER_VERTICAL);row.setPadding(dp(10),dp(10),dp(12),dp(10));row.setBackground(surface(PANEL,12));if(artwork!=null){ImageView cover=new ImageView(this);cover.setImageResource(kr.ai.noastudio.R.drawable.noa_icon);cover.setScaleType(ImageView.ScaleType.FIT_CENTER);cover.setTag(BASE+genrePoster(artwork.optString("genre")));cover.setTag(R.id.noa_art_label,"장르 대표 이미지");row.addView(cover,new LinearLayout.LayoutParams(dp(82),dp(64)));}TextView copy=text(label,16);copy.setPadding(dp(12),dp(8),dp(8),dp(8));row.addView(copy,new LinearLayout.LayoutParams(0,-2,1));row.setClickable(true);row.setFocusable(true);row.setOnClickListener(v->action.run());LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(12);list.addView(row,lp);}
 private void showSong(JSONObject song){
  LinearLayout detail=new LinearLayout(this);detail.setOrientation(LinearLayout.VERTICAL);detail.setBackgroundColor(BLACK);detail.setPadding(12,12,12,12);
  detail.addView(button("← 라이브러리",this::showLibrary));detail.addView(text(song.optString("title"),25));detail.addView(text(song.optString("genre"),15));
  String cast=song.optString("cast");detail.addView(text(cast.equals("duet")?"노아 & 노엘":cast.equals("male")?"노엘":cast.equals("female")?"노아":"",14));
  if(ownAudio(song.optString("audioUrl")))detail.addView(button("음원 재생",()->playAudio(song)));
  if(!song.optString("sunoUrl").isEmpty()||ownAudio(song.optString("audioUrl")))detail.addView(button("곡 상세·Suno 링크",()->openPage(BASE+"/noa-music.php?track="+Uri.encode(song.optString("key")))));
  if(song.optString("youtubeId").matches("[A-Za-z0-9_-]{11}"))detail.addView(button("YouTube 영상",()->openPage(BASE+"/noa-youtube.php?track="+Uri.encode(song.optString("youtubeId")))));
  ScrollView scroll=new ScrollView(this);TextView lyrics=text(song.optString("kind").equals("playlist")?song.optString("tracklist"):song.optString("lyrics","등록된 가사가 없습니다."),16);lyrics.setTextColor(FG);lyrics.setTextIsSelectable(true);scroll.addView(lyrics);detail.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));setContentView(detail);
 }
 private boolean ownAudio(String value){Uri uri=Uri.parse(value);return "https".equals(uri.getScheme())&&"noastudio.ai.kr".equals(uri.getHost())&&uri.getPath()!=null&&uri.getPath().startsWith("/data/noa-audio/")&&!uri.getPath().contains("..");}
 private void playAudio(JSONObject selected){
  if(controller==null)return;List<MediaItem> queue=new ArrayList<>();int selectedIndex=0;
  for(JSONObject song:songs){String url=song.optString("audioUrl");if(!ownAudio(url))continue;if(song.optString("key").equals(selected.optString("key")))selectedIndex=queue.size();queue.add(new MediaItem.Builder().setMediaId(song.optString("key")).setUri(url).setMediaMetadata(new MediaMetadata.Builder().setTitle(song.optString("title")).setArtist("AI Artist Noa").build()).build());}
  if(queue.isEmpty())return;controller.setMediaItems(queue,selectedIndex,0);controller.prepare();controller.play();
 }
 private void openPage(String url){
  String targetPath=Uri.parse(url).getPath();if(controller!=null&&(targetPath.equals("/noa-youtube.php")||targetPath.equals("/noa-music.php")))controller.pause();
  LinearLayout frame=new LinearLayout(this);frame.setOrientation(LinearLayout.VERTICAL);frame.setBackgroundColor(BLACK);frame.addView(button("← NOA STUDIO 라이브러리",this::showLibrary));
  browser=new WebView(this);WebSettings settings=browser.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
  browser.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
   if(view.getUrl()==null||!trustedStudioUrl(view.getUrl()))return false;
   if(fileSelection!=null)fileSelection.onReceiveValue(null);fileSelection=callback;
   Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("audio/*");
   try{startActivityForResult(pick,AUDIO_PICK_REQUEST);}catch(android.content.ActivityNotFoundException e){fileSelection.onReceiveValue(null);fileSelection=null;Toast.makeText(MainActivity.this,"음원 파일 선택기를 찾을 수 없습니다.",Toast.LENGTH_LONG).show();}return true;
  }});
  browser.setDownloadListener((downloadUrl,userAgent,disposition,mime,length)->{if(!trustedStudioUrl(downloadUrl))return;Uri uri=Uri.parse(downloadUrl);if(!"/noa-bridge/lab-file.php".equals(uri.getPath()))return;String name=URLUtil.guessFileName(downloadUrl,disposition,mime).replaceAll("[^\\p{L}\\p{N}._-]","_");DownloadManager.Request request=new DownloadManager.Request(uri);String cookies=CookieManager.getInstance().getCookie(BASE);if(cookies!=null)request.addRequestHeader("Cookie",cookies);request.addRequestHeader("User-Agent",userAgent);request.setMimeType(mime);request.setTitle(name);request.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,name);request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);try{((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);Toast.makeText(this,"다운로드를 시작했습니다.",Toast.LENGTH_SHORT).show();}catch(RuntimeException e){Toast.makeText(this,"다운로드를 시작하지 못했습니다.",Toast.LENGTH_LONG).show();}});
  CookieManager.getInstance().setAcceptCookie(true);
  browser.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){if(!req.isForMainFrame())return false;Uri uri=req.getUrl();if(trustedStudioUrl(uri.toString())){if("/noa-bridge/lab-oauth.php".equals(uri.getPath())&&"start".equals(uri.getQueryParameter("action"))){startActivity(new Intent(Intent.ACTION_VIEW,uri));return true;}return false;}if("https".equals(uri.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,uri));return true;}});
  frame.addView(browser,new LinearLayout.LayoutParams(-1,0,1));setContentView(frame);browser.loadUrl(url);
 }
 private boolean trustedStudioUrl(String value){Uri uri=Uri.parse(value);return "https".equals(uri.getScheme())&&"noastudio.ai.kr".equals(uri.getHost())&&uri.getUserInfo()==null&&(uri.getPort()==-1||uri.getPort()==443);}
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==AUDIO_PICK_REQUEST&&fileSelection!=null){Uri uri=resultCode==RESULT_OK&&data!=null?data.getData():null;fileSelection.onReceiveValue(uri!=null&&"content".equals(uri.getScheme())?new Uri[]{uri}:null);fileSelection=null;}}
 @Override public void onBackPressed(){if(browser!=null&&browser.canGoBack())browser.goBack();else showLibrary();}
 @Override protected void onPause(){if(browser!=null){browser.evaluateJavascript("window.dispatchEvent(new Event('noa-background'));",null);browser.onPause();}CookieManager.getInstance().flush();super.onPause();}
 @Override protected void onResume(){super.onResume();if(browser!=null)browser.onResume();}
 @Override protected void onDestroy(){handler.removeCallbacks(tick);if(fileSelection!=null){fileSelection.onReceiveValue(null);fileSelection=null;}if(browser!=null)browser.destroy();if(controllerFuture!=null)MediaController.releaseFuture(controllerFuture);executor.shutdownNow();images.shutdownNow();super.onDestroy();}
}
