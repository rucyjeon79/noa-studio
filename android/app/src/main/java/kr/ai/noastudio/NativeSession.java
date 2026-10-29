package kr.ai.noastudio;

import android.webkit.CookieManager;
import java.net.HttpURLConnection;
import okhttp3.OkHttpClient;
import okhttp3.Request;

/** Use the current WebView session only for the exact first-party HTTPS origin. */
final class NativeSession {
    static final String CATALOG="https://noastudio.ai.kr/noa-bridge/catalog.php";
    static String cookie(String url) {
        if (!NoaMediaPolicy.studio(url)) return "";
        String value=CookieManager.getInstance().getCookie(url);
        return value==null?"":value;
    }
    static void authenticate(HttpURLConnection connection) {
        connection.setInstanceFollowRedirects(false);
        String value=cookie(connection.getURL().toString());
        if (!value.isEmpty()) connection.setRequestProperty("Cookie",value);
    }
    static OkHttpClient mediaClient() {
        return new OkHttpClient.Builder().connectTimeout(20,java.util.concurrent.TimeUnit.SECONDS).readTimeout(30,java.util.concurrent.TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false)
            .addInterceptor(chain -> {
                String url=chain.request().url().toString();
                if (!NoaMediaPolicy.audio(url)) throw new java.io.IOException("Untrusted audio origin");
                Request.Builder request=chain.request().newBuilder().removeHeader("Cookie");
                String value=cookie(url);
                if (!value.isEmpty()) request.header("Cookie",value);
                return chain.proceed(request.build());
            }).build();
    }
}
