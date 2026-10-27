package kr.ai.noastudio;
import android.content.Context;
import android.webkit.CookieManager;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.io.File;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

final class NoaTestLogin {
 static void cookies(HttpURLConnection c)throws Exception{
  List<String> values=new ArrayList<>();for(Map.Entry<String,List<String>> h:c.getHeaderFields().entrySet())if("Set-Cookie".equalsIgnoreCase(h.getKey()))values.addAll(h.getValue());
  CountDownLatch latch=new CountDownLatch(values.size());
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{for(String value:values)CookieManager.getInstance().setCookie("https://noastudio.ai.kr",value,result->latch.countDown());});
  assertTrue(latch.await(10,TimeUnit.SECONDS));CookieManager.getInstance().flush();
 }
 static void login(Context c)throws Exception{
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->NoaSession.initialize(c));
  JSONObject data=new JSONObject(new String(Files.readAllBytes(new File(c.getFilesDir(),"noa-qa-credentials.json").toPath()),StandardCharsets.UTF_8));
  HttpURLConnection get=(HttpURLConnection)new URL("https://noastudio.ai.kr/bbs/login.php").openConnection();get.setConnectTimeout(20000);get.setReadTimeout(20000);NoaSession.attach(get);get.getResponseCode();cookies(get);get.disconnect();
  HttpURLConnection post=(HttpURLConnection)new URL("https://noastudio.ai.kr/bbs/login_check.php").openConnection();post.setConnectTimeout(20000);post.setReadTimeout(20000);post.setInstanceFollowRedirects(false);post.setRequestMethod("POST");post.setDoOutput(true);NoaSession.attach(post);post.setRequestProperty("Referer","https://noastudio.ai.kr/bbs/login.php");post.setRequestProperty("Content-Type","application/x-www-form-urlencoded");
  String body="mb_id="+URLEncoder.encode(data.getString("member"),"UTF-8")+"&mb_password="+URLEncoder.encode(data.getString("password"),"UTF-8")+"&url=%2Fnoa-my.php";
  try(java.io.OutputStream out=post.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}int status=post.getResponseCode();cookies(post);post.disconnect();assertTrue("Disposable account login failed",status==200||status==302||status==303);
  HttpURLConnection catalog=(HttpURLConnection)new URL("https://noastudio.ai.kr/noa-bridge/catalog.php").openConnection();catalog.setConnectTimeout(20000);catalog.setReadTimeout(20000);NoaSession.attach(catalog);try{assertEquals("Native request did not share the actual member session",200,catalog.getResponseCode());}finally{catalog.disconnect();}
 }
}
