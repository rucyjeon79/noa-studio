package kr.ai.noastudio;

import android.os.ParcelFileDescriptor;
import android.webkit.CookieManager;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Instrumentation-only scoped live QA session. Never included in the application APK. */
final class MemberTestSession {
    static void install() throws Exception {
        ParcelFileDescriptor pipe=InstrumentationRegistry.getInstrumentation().getUiAutomation()
            .executeShellCommand("cat /data/local/tmp/noa-android-qa-cookie.txt");
        String cookie;
        try(FileInputStream input=new ParcelFileDescriptor.AutoCloseInputStream(pipe)) {
            byte[] bytes=new byte[4096];int n=input.read(bytes);
            cookie=n>0?new String(bytes,0,n,StandardCharsets.UTF_8).trim():"";
        }
        if(!cookie.matches("PHPSESSID=[A-Za-z0-9,-]{16,128}"))throw new AssertionError("QA session unavailable");
        // Only music requests use this member. Existing guest-playlist UI tests remain guest tests.
        String[] paths={"/noa-bridge/catalog.php","/noa-app/jukebox/","/data/noa-audio/"};
        CountDownLatch latch=new CountDownLatch(paths.length);
        for(String path:paths) InstrumentationRegistry.getInstrumentation().runOnMainSync(()->
            CookieManager.getInstance().setCookie("https://noastudio.ai.kr"+path,cookie+"; Path="+path+"; Secure; HttpOnly",ok->latch.countDown()));
        if(!latch.await(10,TimeUnit.SECONDS))throw new AssertionError("QA session initialization timed out");
        CookieManager.getInstance().flush();
    }
}
