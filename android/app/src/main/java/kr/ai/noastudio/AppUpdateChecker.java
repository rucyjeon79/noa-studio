package kr.ai.noastudio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Same-origin release discovery. Installation always remains an Android/user action. */
final class AppUpdateChecker {
    static final String ORIGIN = "https://noastudio.ai.kr";
    private final Activity activity;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean busy, closed;
    private long lastAttempt = -1;
    private AlertDialog dialog;

    AppUpdateChecker(Activity activity) { this.activity = activity; }

    static long newerVersion(JSONObject release, long installed) throws Exception {
        long version = release.getLong("versionCode");
        if (!"NOA STUDIO".equals(release.getString("app"))
                || !"kr.ai.noastudio".equals(release.getString("applicationId"))
                || release.getInt("schemaVersion") != 1
                || version <= 0 || version > 2100000000L
                || !release.getString("file").equals("noa-studio-android-build-" + version + ".apk")
                || !release.getString("sha256").matches("[a-f0-9]{64}"))
            throw new IllegalArgumentException("Invalid release");
        return version > installed ? version : 0;
    }

    @SuppressWarnings("deprecation")
    private boolean fromPlay() {
        return "com.android.vending".equals(activity.getPackageManager()
                .getInstallerPackageName(activity.getPackageName()));
    }

    void check(boolean manual) {
        if (closed || busy) return;
        // A website release is not evidence that Google Play has approved that release.
        if (fromPlay()) {
            if (manual) open("https://play.google.com/store/apps/details?id=" + activity.getPackageName());
            return;
        }
        long now = SystemClock.elapsedRealtime();
        if (!manual && lastAttempt >= 0 && now - lastAttempt < 6 * 60 * 60 * 1000L) return;
        lastAttempt = now;
        busy = true;
        worker.execute(() -> {
            JSONObject release = null;
            long version = -1;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(ORIGIN + "/noa-android-release.json?t="
                        + System.currentTimeMillis()).openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setInstanceFollowRedirects(false);
                connection.setUseCaches(false);
                connection.setRequestProperty("Cache-Control", "no-cache");
                if (connection.getResponseCode() != 200) throw new IllegalStateException("Release unavailable");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream input = connection.getInputStream()) {
                    byte[] block = new byte[1024]; int count;
                    while ((count = input.read(block)) != -1) {
                        if (bytes.size() + count > 16384) throw new IllegalStateException("Release too large");
                        bytes.write(block, 0, count);
                    }
                }
                release = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
                android.content.pm.PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
                long installed = android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
                version = newerVersion(release, installed);
            } catch (Exception ignored) {
                // Offline/invalid metadata must never interrupt playback or prompt installation.
            } finally { if (connection != null) connection.disconnect(); }
            JSONObject result = release; long available = version;
            activity.runOnUiThread(() -> {
                busy = false;
                if (closed || activity.isFinishing() || activity.isDestroyed()) return;
                if (available <= 0) {
                    if (manual) Toast.makeText(activity, available == 0 ? "최신 버전입니다." : "업데이트를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", Toast.LENGTH_LONG).show();
                    return;
                }
                SharedPreferences preferences = activity.getSharedPreferences("noa-app-update", Activity.MODE_PRIVATE);
                if (!manual && System.currentTimeMillis() - preferences.getLong("prompt-" + available, 0) < 86400000L) return;
                if (dialog != null && dialog.isShowing()) return;
                // Do not show a dialog over another app or after this activity was paused.
                if (!manual && !activity.hasWindowFocus()) { lastAttempt = -1; return; }
                preferences.edit().putLong("prompt-" + available, System.currentTimeMillis()).apply();
                dialog = new AlertDialog.Builder(activity).setTitle("NOA STUDIO 업데이트")
                        .setMessage("새 버전 2.0." + available + "이 준비되었습니다. 다운로드 후 설치를 완료해 주세요. 기존 앱을 삭제할 필요는 없습니다.")
                        .setPositiveButton("업데이트", (d, which) -> open(ORIGIN + "/" + result.optString("file")))
                        .setNegativeButton("나중에", null).show();
            });
        });
    }

    private void open(String url) {
        try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (android.content.ActivityNotFoundException error) {
            Toast.makeText(activity, "링크를 열 수 있는 앱이 없습니다.", Toast.LENGTH_LONG).show();
        }
    }

    void close() { closed = true; if (dialog != null) dialog.dismiss(); worker.shutdownNow(); }
}
