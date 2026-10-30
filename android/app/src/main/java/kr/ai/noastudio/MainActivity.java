package kr.ai.noastudio;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.webkit.CookieManager;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.media3.common.*;
import androidx.media3.session.*;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** The production PWA owns every screen. Android supplies only the media engine. */
@android.annotation.SuppressLint({"UnsafeOptInUsageError","SetJavaScriptEnabled"})
public class MainActivity extends Activity {
 private static final String BASE="https://noastudio.ai.kr";
 private static final int FILE_PICK=7201;
 private WebView browser;
 private MediaController controller;
 private ListenableFuture<MediaController> controllerFuture;
 private PlaybackStateStore playbackStore;
 private AppUpdateChecker appUpdates;
 private ValueCallback<Uri[]> fileSelection;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private String sessionCookie,bridge="";
 private JSONObject pending;
 private final Runnable tick=new Runnable(){public void run(){publishState();handler.postDelayed(this,500);}};

 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);playbackStore=new PlaybackStateStore(this);appUpdates=new AppUpdateChecker(this);
  getWindow().setStatusBarColor(Color.rgb(17,19,22));getWindow().setNavigationBarColor(Color.rgb(17,19,22));
  getWindow().getDecorView().setOnApplyWindowInsetsListener((v,i)->{findViewById(android.R.id.content).setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i.consumeSystemWindowInsets();});
  try(InputStream in=getAssets().open("noa-native-bridge.js")){bridge=read(in);}catch(IOException e){throw new IllegalStateException("Media bridge missing",e);}
  browser=new WebView(this);WebSettings settings=browser.getSettings();settings.setJavaScriptEnabled(true);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptCookie(true);
  if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
   WebViewCompat.addWebMessageListener(browser,"NoaAndroid",Collections.singleton(BASE),(view,message,origin,mainFrame,reply)->{
    if(!mainFrame||!BASE.equals(origin.toString())||!trusted(view.getUrl()))return;
    String raw=message.getData();if(raw==null||raw.length()>524288)return;
    try{nativeMessage(new JSONObject(raw));}catch(JSONException ignored){}
   });
   if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))WebViewCompat.addDocumentStartJavaScript(browser,bridge,Collections.singleton(BASE));
  }
  browser.setWebViewClient(new WebViewClient(){
   @Override public void onPageFinished(WebView view,String url){if(trusted(url)){view.evaluateJavascript(bridge,null);syncSession();publishState();}}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    if(!request.isForMainFrame())return false;Uri u=request.getUrl();
    if(trusted(u.toString())){if("/noa-bridge/lab-oauth.php".equals(u.getPath())&&"start".equals(u.getQueryParameter("action"))){external(u);return true;}return false;}
    if("https".equals(u.getScheme())||"mailto".equals(u.getScheme())||"tel".equals(u.getScheme()))external(u);
    return true;
   }
  });
  browser.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(!trusted(view.getUrl()))return false;if(fileSelection!=null)fileSelection.onReceiveValue(null);fileSelection=callback;
    Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
    String[] accept=params.getAcceptTypes();if(accept!=null&&accept.length>0&&!accept[0].isEmpty())pick.putExtra(Intent.EXTRA_MIME_TYPES,accept);
    pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
    try{startActivityForResult(pick,FILE_PICK);}catch(ActivityNotFoundException e){fileSelection.onReceiveValue(null);fileSelection=null;notice("파일 선택기를 찾을 수 없습니다.");}return true;
   }
  });
  browser.setDownloadListener((url,agent,disposition,mime,length)->{
   if(!trusted(url))return;Uri u=Uri.parse(url);String path=u.getPath();
   if(path!=null&&(path.endsWith(".apk")||path.equals("/noa-download.php"))){external(u);return;}
   if(!Arrays.asList("/noa-bridge/lab-file.php","/noa-music-download.php","/noa-app/jukebox/download.php","/bbs/download.php").contains(path))return;
   DownloadManager.Request request=new DownloadManager.Request(u);String cookie=CookieManager.getInstance().getCookie(url);if(cookie!=null)request.addRequestHeader("Cookie",cookie);request.addRequestHeader("User-Agent",agent);request.setMimeType(mime);String name=URLUtil.guessFileName(url,disposition,mime).replaceAll("[^\\p{L}\\p{N}._-]","_");request.setTitle(name);request.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,name);request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
   try{((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);notice("다운로드를 시작했습니다.");}catch(RuntimeException e){notice("다운로드를 시작하지 못했습니다.");}
  });
  setContentView(browser);browser.loadUrl(BASE+"/");
  controllerFuture=new MediaController.Builder(this,new SessionToken(this,new ComponentName(this,PlaybackService.class))).buildAsync();
  controllerFuture.addListener(()->{try{controller=controllerFuture.get();controller.addListener(new Player.Listener(){@Override public void onEvents(Player p,Player.Events e){publishState();}});drain();publishState();}catch(Exception e){notice("음악 재생기를 연결하지 못했습니다.");}},this::runOnUiThread);
  handler.post(tick);
 }
 private static String read(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=in.read(block))!=-1){if(out.size()+n>4*1024*1024)throw new IOException("Response too large");out.write(block,0,n);}return out.toString(StandardCharsets.UTF_8.name());}
 private void external(Uri uri){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException e){notice("링크를 열 수 있는 앱이 없습니다.");}}
 private void notice(String message){Toast.makeText(this,message,Toast.LENGTH_LONG).show();}
 private boolean trusted(String value){if(value==null)return false;Uri u=Uri.parse(value);return "https".equals(u.getScheme())&&"noastudio.ai.kr".equals(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443);}
 private void syncSession(){
  String cookie=NativeSession.cookie(NativeSession.CATALOG),identity="";
  for(String part:cookie.split(";"))if(part.trim().startsWith("PHPSESSID="))identity=part.trim();
  if(sessionCookie!=null&&!sessionCookie.equals(identity)&&controller!=null){pending=null;controller.pause();controller.clearMediaItems();}
  sessionCookie=identity;
 }
 private void drain(){if(controller==null||pending==null)return;JSONObject request=pending;pending=null;nativeMessage(request);}
 // Only the authenticated, same-origin main PWA document can provide these rows.
 // The stream endpoint still enforces the member's current entitlement on every request.
 static Map<String,JSONObject> tracks(JSONObject message){
  Map<String,JSONObject> valid=new LinkedHashMap<>();JSONArray rows=message.optJSONArray("tracks");
  if(rows==null)return valid;
  for(int i=0;i<Math.min(rows.length(),500);i++){
   JSONObject row=rows.optJSONObject(i);if(row==null)continue;
   String key=row.optString("key"),url=row.optString("audioUrl");
   if(!key.matches("[A-Za-z0-9:_-]{1,191}")||url.length()>2048||!NoaMediaPolicy.audio(url))continue;
   Uri uri=Uri.parse(url);if("/noa-app/jukebox/stream.php".equals(uri.getPath())&&!key.equals(uri.getQueryParameter("key")))continue;
   valid.put(key,row);
  }
  return valid;
 }
 private int repeatMode(JSONObject message){return message.optBoolean("repeat")?Player.REPEAT_MODE_ONE:message.optBoolean("collectionLoop")?Player.REPEAT_MODE_ALL:Player.REPEAT_MODE_OFF;}
 private void nativeMessage(JSONObject message){
  String type=message.optString("type");
  if(type.equals("ready")){syncSession();publishState();return;}
  if(type.equals("upload")){boolean active=message.optBoolean("active");playbackStore.upload(active);if(active&&controller!=null)controller.pause();return;}
  if(type.equals("update")){appUpdates.check(true);return;}
  if(type.equals("play")||type.equals("prepare")){
   syncSession();if(controller==null){pending=message;return;}
   Map<String,JSONObject> songs=tracks(message);
   JSONObject selected=songs.get(message.optString("key"));if(selected==null){bridgeError("이 곡의 재생 권한 또는 음원 정보를 확인해 주세요.");return;}
   JSONArray order=message.optJSONArray("queue");List<MediaItem> items=new ArrayList<>();Set<String> seen=new HashSet<>();int index=-1;
   if(order!=null)for(int i=0;i<Math.min(order.length(),500);i++){String key=order.optString(i);JSONObject row=songs.get(key);if(row!=null&&seen.add(key)){if(key.equals(selected.optString("key")))index=items.size();items.add(media(row));}}
   if(index<0){index=0;items.clear();items.add(media(selected));}
   boolean play=type.equals("play");MediaItem current=controller.getCurrentMediaItem();
   long position=current!=null&&current.mediaId.equals(selected.optString("key"))?controller.getCurrentPosition():0;
   playbackStore.setClosed(false);boolean same=controller.getMediaItemCount()==items.size()&&current!=null&&current.mediaId.equals(selected.optString("key"));for(int i=0;same&&i<items.size();i++)same=controller.getMediaItemAt(i).mediaId.equals(items.get(i).mediaId);if(!same)controller.setMediaItems(items,index,position);controller.setRepeatMode(repeatMode(message));controller.setShuffleModeEnabled(message.optBoolean("shuffle"));controller.setVolume((float)Math.max(0,Math.min(1,message.optDouble("volume",.7))));if(controller.getPlaybackState()==Player.STATE_IDLE)controller.prepare();if(play)controller.play();else controller.pause();return;
  }
  if(type.equals("close")){pending=null;playbackStore.setClosed(true);}
  if((type.equals("pause")||type.equals("video"))&&pending!=null)try{pending.put("type","prepare");}catch(JSONException ignored){}
  if(controller==null)return;
  switch(type){
   case "pause":case "video":controller.pause();break;
   case "seek":long at=(long)(message.optDouble("seconds",0)*1000);if(at>=0)controller.seekTo(Math.min(at,Math.max(0,controller.getDuration())));break;
   case "volume":controller.setVolume((float)Math.max(0,Math.min(1,message.optDouble("value",.7))));break;
   case "modes":controller.setShuffleModeEnabled(message.optBoolean("shuffle"));controller.setRepeatMode(repeatMode(message));break;
   case "close":controller.sendCustomCommand(new SessionCommand(PlaybackService.CLOSE,Bundle.EMPTY),Bundle.EMPTY);break;
  }
  publishState();
 }
 private MediaItem media(JSONObject row){MediaMetadata.Builder md=new MediaMetadata.Builder().setTitle(row.optString("title").substring(0,Math.min(256,row.optString("title").length()))).setArtist("AI Artist Noa");String art=row.optString("coverImageUrl");if(NoaMediaPolicy.artwork(art))md.setArtworkUri(Uri.parse(art));return new MediaItem.Builder().setMediaId(row.optString("key")).setUri(row.optString("audioUrl")).setMediaMetadata(md.build()).build();}
 private void bridgeError(String text){if(browser!=null&&trusted(browser.getUrl()))browser.evaluateJavascript("window.NoaNativeBridge?.error("+JSONObject.quote(text)+");",null);}
 private void publishState(){
  if(controller==null||browser==null||!trusted(browser.getUrl()))return;
  try{MediaItem item=controller.getCurrentMediaItem();JSONArray keys=new JSONArray();for(int i=0;i<controller.getMediaItemCount();i++)keys.put(controller.getMediaItemAt(i).mediaId);
   JSONObject state=new JSONObject().put("key",item==null?"":item.mediaId).put("queue",keys).put("position",Math.max(0,controller.getCurrentPosition())/1000.0).put("duration",Math.max(0,controller.getDuration())/1000.0).put("paused",!controller.getPlayWhenReady()||controller.getPlaybackState()==Player.STATE_ENDED).put("playing",controller.isPlaying()).put("ended",controller.getPlaybackState()==Player.STATE_ENDED).put("repeat",controller.getRepeatMode()==Player.REPEAT_MODE_ONE).put("collectionLoop",controller.getRepeatMode()==Player.REPEAT_MODE_ALL).put("shuffle",controller.getShuffleModeEnabled()).put("volume",controller.getVolume()).put("closed",playbackStore.closed()).put("error",controller.getPlayerError()!=null);
   browser.evaluateJavascript("window.NoaNativeBridge?.state("+state+");",null);
  }catch(JSONException ignored){}
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==FILE_PICK&&fileSelection!=null){List<Uri> uris=new ArrayList<>();if(resultCode==RESULT_OK&&data!=null){if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());else if(data.getData()!=null)uris.add(data.getData());}uris.removeIf(u->!"content".equals(u.getScheme()));fileSelection.onReceiveValue(uris.isEmpty()?null:uris.toArray(new Uri[0]));fileSelection=null;}}
 @Override public void onBackPressed(){if(browser.canGoBack())browser.goBack();else moveTaskToBack(true);}
 @Override protected void onPause(){if(browser!=null)browser.onPause();CookieManager.getInstance().flush();super.onPause();}
 @Override protected void onResume(){super.onResume();if(browser!=null){browser.onResume();syncSession();publishState();}if(appUpdates!=null)handler.postDelayed(()->{if(!isFinishing()&&!isDestroyed())appUpdates.check(false);},1500);}
 @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(appUpdates!=null)appUpdates.close();if(fileSelection!=null)fileSelection.onReceiveValue(null);if(browser!=null)browser.destroy();if(controllerFuture!=null)MediaController.releaseFuture(controllerFuture);super.onDestroy();}
}
