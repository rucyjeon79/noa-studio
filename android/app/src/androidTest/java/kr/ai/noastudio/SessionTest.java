package kr.ai.noastudio;
import android.webkit.CookieManager;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import java.net.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import okhttp3.HttpUrl;
import static org.junit.Assert.*;

public class SessionTest {
 @Test public void nativeRequestsReadCurrentWebCookieOnlyForStudio()throws Exception{
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->NoaSession.initialize(InstrumentationRegistry.getInstrumentation().getTargetContext()));
  CountDownLatch ready=new CountDownLatch(1);
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->CookieManager.getInstance().setCookie("https://noastudio.ai.kr","NOA_QA_SESSION_TEST=native-shared; Path=/; Secure; HttpOnly",value->ready.countDown()));
  assertTrue(ready.await(10,TimeUnit.SECONDS));
  try{
   HttpURLConnection own=(HttpURLConnection)new URL("https://noastudio.ai.kr/noa-bridge/catalog.php").openConnection();NoaSession.attach(own);
   assertTrue(own.getRequestProperty("Cookie").contains("NOA_QA_SESSION_TEST=native-shared"));assertNotNull(own.getRequestProperty("User-Agent"));
   okhttp3.CookieJar jar=NoaSession.mediaClient().cookieJar();assertTrue(jar.loadForRequest(HttpUrl.parse("https://noastudio.ai.kr/noa-app/jukebox/stream.php")).stream().anyMatch(c->c.name().equals("NOA_QA_SESSION_TEST")));
   for(String url:new String[]{"https://example.com","https://noastudio.ai.kr.evil.example","http://noastudio.ai.kr","https://noastudio.ai.kr:444","https://user@noastudio.ai.kr"}){assertFalse(NoaSession.trusted(url));assertTrue(NoaSession.cookie(url).isEmpty());assertTrue(jar.loadForRequest(HttpUrl.parse(url)).isEmpty());}
  }finally{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->CookieManager.getInstance().setCookie("https://noastudio.ai.kr","NOA_QA_SESSION_TEST=; Path=/; Max-Age=0; Secure"));}
 }
}
