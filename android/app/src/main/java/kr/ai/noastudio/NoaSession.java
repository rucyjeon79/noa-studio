package kr.ai.noastudio;

import android.content.Context;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import java.net.HttpURLConnection;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;

/** Share the WebView login with native requests, never with another origin. */
final class NoaSession {
 private static volatile String userAgent="";
 static void initialize(Context context){if(userAgent.isEmpty())userAgent=WebSettings.getDefaultUserAgent(context.getApplicationContext());}
 static boolean trusted(String value){
  if(value==null)return false;
  Uri u=Uri.parse(value);
  return "https".equals(u.getScheme())&&"noastudio.ai.kr".equals(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443);
 }
 static String cookie(String url){if(!trusted(url))return "";String value=CookieManager.getInstance().getCookie(url);return value==null?"":value;}
 static void attach(HttpURLConnection connection){
  String url=connection.getURL().toString();if(!trusted(url))return;
  String cookies=cookie(url);if(!cookies.isEmpty())connection.setRequestProperty("Cookie",cookies);
  if(!userAgent.isEmpty())connection.setRequestProperty("User-Agent",userAgent);
 }
 static OkHttpClient mediaClient(){
  return new OkHttpClient.Builder().cookieJar(new CookieJar(){
   @Override public List<Cookie> loadForRequest(HttpUrl url){
    if(!trusted(url.toString()))return Collections.emptyList();
    List<Cookie> result=new ArrayList<>();
    for(String part:cookie(url.toString()).split(";")){Cookie value=Cookie.parse(url,part.trim());if(value!=null)result.add(value);}
    return result;
   }
   @Override public void saveFromResponse(HttpUrl url,List<Cookie> cookies){
    if(!trusted(url.toString()))return;
    for(Cookie cookie:cookies)CookieManager.getInstance().setCookie(url.toString(),cookie.toString());
   }
  }).addInterceptor(chain->{okhttp3.Request request=chain.request();if(trusted(request.url().toString())&&!userAgent.isEmpty())request=request.newBuilder().header("User-Agent",userAgent).build();return chain.proceed(request);}).build();
 }
}
