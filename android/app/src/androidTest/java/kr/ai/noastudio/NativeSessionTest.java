package kr.ai.noastudio;

import android.webkit.CookieManager;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class NativeSessionTest {
    private void set(String value) throws Exception {
        CountDownLatch done=new CountDownLatch(1);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->CookieManager.getInstance()
            .setCookie(NativeSession.CATALOG,value,ok->done.countDown()));
        assertTrue(done.await(10,TimeUnit.SECONDS));
    }
    @Test public void sessionIsReadFreshAndNeverSharedWithForeignOrigins() throws Exception {
        try {
            set("NOA_TEST_COOKIE=first; Path=/; Secure");
            assertTrue(NativeSession.cookie(NativeSession.CATALOG).contains("NOA_TEST_COOKIE=first"));
            assertEquals("",NativeSession.cookie("https://noastudio.ai.kr.evil.example/file"));
            assertEquals("",NativeSession.cookie("http://noastudio.ai.kr/file"));
            assertEquals("",NativeSession.cookie("https://noastudio.ai.kr:444/file"));
            set("NOA_TEST_COOKIE=second; Path=/; Secure");
            assertTrue(NativeSession.cookie(NativeSession.CATALOG).contains("NOA_TEST_COOKIE=second"));
        } finally { set("NOA_TEST_COOKIE=; Path=/; Max-Age=0; Secure"); }
    }
    @Test public void authenticatedMediaNeverFollowsRedirects() {
        okhttp3.OkHttpClient client=NativeSession.mediaClient();
        assertFalse(client.followRedirects());assertFalse(client.followSslRedirects());
    }
}
