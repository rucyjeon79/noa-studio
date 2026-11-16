package kr.ai.noastudio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.Toast;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/** Play-only flexible updates. Downloading never controls or stops the player. */
final class PlayStoreUpdateChecker {
    private static final long CHECK_INTERVAL_MS = 6L * 60 * 60 * 1000;
    private static final long PROMPT_INTERVAL_MS = 24L * 60 * 60 * 1000;
    private static final String ACTIVE = "play-download-active";
    private static final String VERSION = "play-download-version";
    private final Activity activity;
    private final AppUpdateManager manager;
    private final Runnable beforeInstall;
    private final SharedPreferences preferences;
    private final InstallStateUpdatedListener listener;
    private long lastAttemptElapsed = -1;
    private boolean closed, busy, downloadedPending, deferredCheck, installing;
    private int latestAvailableVersion;
    private AlertDialog offerDialog, installDialog, fallbackDialog;

    PlayStoreUpdateChecker(Activity activity, Runnable beforeInstall) {
        this(activity, AppUpdateManagerFactory.create(activity), beforeInstall);
    }

    // Production always uses Play's manager; injection is for Android tests.
    PlayStoreUpdateChecker(Activity activity, AppUpdateManager manager, Runnable beforeInstall) {
        this.activity = activity;
        this.manager = manager;
        this.beforeInstall = beforeInstall;
        preferences = activity.getSharedPreferences("noa-app-update", Activity.MODE_PRIVATE);
        latestAvailableVersion = preferences.getInt(VERSION, 0);
        listener = state -> activity.runOnUiThread(() -> {
            if (!alive()) return;
            switch (state.installStatus()) {
                case InstallStatus.PENDING:
                case InstallStatus.DOWNLOADING:
                    preferences.edit().putBoolean(ACTIVE, true).apply();
                    break;
                case InstallStatus.DOWNLOADED:
                    downloadedPending = true;
                    preferences.edit().putBoolean(ACTIVE, true).apply();
                    showReadyToInstall(false);
                    break;
                case InstallStatus.CANCELED:
                case InstallStatus.FAILED:
                    installing = false;
                    downloadedPending = false;
                    preferences.edit().putBoolean(ACTIVE, false).apply();
                    break;
                case InstallStatus.INSTALLED:
                    downloadedPending = false;
                    preferences.edit().remove(ACTIVE).remove(VERSION).apply();
                    break;
                default:
                    break;
            }
        });
        manager.registerListener(listener);
    }

    private boolean alive() {
        return !closed && !activity.isFinishing() && !activity.isDestroyed();
    }

    private boolean visible() { return alive() && activity.hasWindowFocus(); }

    void onForeground() {
        if (!visible()) return;
        if (downloadedPending) showReadyToInstall(false);
        else if (deferredCheck) { deferredCheck = false; check(false); }
    }

    void check(boolean manual) {
        if (!alive() || busy || installing) return;
        if (downloadedPending) { showReadyToInstall(manual); return; }
        long now = SystemClock.elapsedRealtime();
        // Recover accepted downloads on resume, including activity/process recreation.
        if (!manual && !preferences.getBoolean(ACTIVE, false)
                && lastAttemptElapsed >= 0 && now - lastAttemptElapsed < CHECK_INTERVAL_MS) return;
        lastAttemptElapsed = now;
        busy = true;
        try {
            manager.getAppUpdateInfo().addOnSuccessListener(info -> {
                busy = false;
                if (!alive()) return;
                if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    downloadedPending = true;
                    latestAvailableVersion = Math.max(latestAvailableVersion, info.availableVersionCode());
                    preferences.edit().putBoolean(ACTIVE, true).putInt(VERSION, latestAvailableVersion).apply();
                    showReadyToInstall(manual);
                    return;
                }
                if (info.installStatus() == InstallStatus.PENDING || info.installStatus() == InstallStatus.DOWNLOADING) {
                    preferences.edit().putBoolean(ACTIVE, true).apply();
                    if (manual) notice("업데이트를 다운로드하고 있습니다. 음악은 계속 들을 수 있습니다.");
                    return;
                }
                preferences.edit().putBoolean(ACTIVE, false).apply();
                if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) {
                    if (manual) notice("Google Play에서 설치 가능한 새 버전이 없습니다.");
                    return;
                }
                latestAvailableVersion = info.availableVersionCode();
                if (latestAvailableVersion <= 0) {
                    if (manual) notice("업데이트 버전을 확인하지 못했습니다.");
                    return;
                }
                if (!info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    // An immediate update can interrupt music; never switch to it.
                    if (manual) offerPlayStoreFallback();
                    return;
                }
                String key = "play-prompt-" + latestAvailableVersion;
                if (!manual && recentlyPrompted(key)) return;
                if (offerDialog != null && offerDialog.isShowing()) return;
                if (!visible()) { deferredCheck = true; lastAttemptElapsed = -1; return; }
                offerDialog = new AlertDialog.Builder(activity)
                        .setTitle("NOA STUDIO 업데이트")
                        .setMessage("Google Play에 새 버전이 준비되었습니다. 음악을 들으며 다운로드할 수 있고, 설치 전 다시 확인합니다.")
                        .setPositiveButton("업데이트", (dialog, which) -> beginUpdate(info, manual))
                        .setNegativeButton("나중에", null).show();
                preferences.edit().putLong(key, System.currentTimeMillis()).apply();
            }).addOnFailureListener(error -> {
                busy = false;
                if (manual && visible()) offerPlayStoreFallback();
            });
        } catch (RuntimeException error) {
            busy = false;
            if (manual && visible()) offerPlayStoreFallback();
        }
    }

    private boolean recentlyPrompted(String key) {
        long previous = preferences.getLong(key, 0L);
        long delta = System.currentTimeMillis() - previous;
        return previous > 0 && delta >= 0 && delta < PROMPT_INTERVAL_MS;
    }

    private void beginUpdate(AppUpdateInfo info, boolean manual) {
        if (!alive()) return;
        preferences.edit().putBoolean(ACTIVE, true).putInt(VERSION, latestAvailableVersion).apply();
        try {
            manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
                    .addOnSuccessListener(result -> {
                        if (!alive()) return;
                        if (result != Activity.RESULT_OK) preferences.edit().putBoolean(ACTIVE, false).apply();
                    })
                    .addOnFailureListener(error -> updateStartFailed(manual));
        } catch (RuntimeException error) { updateStartFailed(manual); }
    }

    private void updateStartFailed(boolean manual) {
        preferences.edit().putBoolean(ACTIVE, false).apply();
        if (manual && visible()) offerPlayStoreFallback();
    }

    private void showReadyToInstall(boolean manual) {
        if (!visible() || installing || (installDialog != null && installDialog.isShowing())) return;
        String key = "play-install-ready-" + latestAvailableVersion;
        if (!manual && recentlyPrompted(key)) return;
        installDialog = new AlertDialog.Builder(activity)
                .setTitle("업데이트 설치 준비 완료")
                .setMessage("다운로드가 끝났습니다. 지금 설치하면 앱이 다시 시작되고 음악이 잠시 중단됩니다. 재생 목록과 위치를 저장한 뒤 설치합니다.")
                .setPositiveButton("지금 설치", (dialog, which) -> {
                    if (!alive() || installing) return;
                    try {
                        beforeInstall.run();
                        installing = true;
                        manager.completeUpdate().addOnFailureListener(error -> installFailed(key));
                    } catch (RuntimeException error) { installFailed(key); }
                })
                .setNegativeButton("나중에", null).show();
        preferences.edit().putLong(key, System.currentTimeMillis()).apply();
    }

    private void installFailed(String key) {
        installing = false;
        preferences.edit().remove(key).apply();
        if (alive()) notice("설치를 완료하지 못했습니다. 음악은 계속 이용할 수 있습니다. 나중에 다시 시도해 주세요.");
    }

    private void offerPlayStoreFallback() {
        if (!visible() || (fallbackDialog != null && fallbackDialog.isShowing())) return;
        fallbackDialog = new AlertDialog.Builder(activity)
                .setTitle("Google Play 업데이트 확인")
                .setMessage("앱 안에서 업데이트를 진행할 수 없습니다. Google Play에서 확인하시겠어요?")
                .setPositiveButton("Google Play 열기", (d, w) -> openPlayStore())
                .setNegativeButton("나중에", null).show();
    }

    private void openPlayStore() {
        Uri web = Uri.parse("https://play.google.com/store/apps/details?id=" + activity.getPackageName());
        try { activity.startActivity(new Intent(Intent.ACTION_VIEW, web)); }
        catch (android.content.ActivityNotFoundException ignored) { notice("Google Play를 열 수 없습니다."); }
    }

    private void notice(String message) { if (visible()) Toast.makeText(activity, message, Toast.LENGTH_LONG).show(); }

    void close() {
        if (closed) return;
        closed = true;
        try { manager.unregisterListener(listener); } catch (RuntimeException ignored) { }
        if (offerDialog != null) offerDialog.dismiss();
        if (installDialog != null) installDialog.dismiss();
        if (fallbackDialog != null) fallbackDialog.dismiss();
    }
}
