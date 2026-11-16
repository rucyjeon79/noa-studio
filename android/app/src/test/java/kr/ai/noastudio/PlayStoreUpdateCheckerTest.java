package kr.ai.noastudio;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Looper;
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallErrorCode;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;

/** Behavioral unit tests with Google's fake; not evidence of a real Play install. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class PlayStoreUpdateCheckerTest {
    public static class TestActivity extends Activity {
        boolean focused = true;
        @Override public boolean hasWindowFocus() { return focused; }
    }

    private ActivityController<TestActivity> lifecycle;
    private TestActivity activity;
    private FakeAppUpdateManager manager;
    private PlayStoreUpdateChecker checker;
    private int checkpoints;

    @Before public void setUp() {
        lifecycle = Robolectric.buildActivity(TestActivity.class).setup();
        activity = lifecycle.get();
        activity.getSharedPreferences("noa-app-update", 0).edit().clear().commit();
        manager = new FakeAppUpdateManager(activity);
        checker = newChecker();
    }

    private PlayStoreUpdateChecker newChecker() {
        return new PlayStoreUpdateChecker(activity, manager, () -> {
            assertFalse("Checkpoint must precede installation", manager.isInstallSplashScreenVisible());
            checkpoints++;
        });
    }

    @After public void tearDown() {
        checker.close();
        lifecycle.pause().stop().destroy();
    }

    private void drain() { shadowOf(Looper.getMainLooper()).idle(); }
    private AlertDialog dialog() { return ShadowAlertDialog.getLatestAlertDialog(); }
    private void click(int which) { dialog().getButton(which).performClick(); drain(); }
    private void startDownload() {
        manager.setUpdateAvailable(1794632998);
        checker.check(false);
        drain();
        assertTrue(dialog().isShowing());
        click(DialogInterface.BUTTON_POSITIVE);
        assertTrue(manager.isConfirmationDialogVisible());
        assertFalse(manager.isImmediateFlowVisible());
        manager.userAcceptsUpdate();
        manager.downloadStarts();
        drain();
        assertEquals(Integer.valueOf(AppUpdateType.FLEXIBLE), manager.getTypeForUpdateInProgress());
    }

    @Test public void downloadPreservesPlaybackUntilExplicitInstallApproval() {
        startDownload();
        assertEquals(0, checkpoints);
        manager.downloadCompletes(); drain();
        assertTrue(dialog().isShowing());
        assertFalse(manager.isInstallSplashScreenVisible());
        assertEquals(0, checkpoints);
        click(DialogInterface.BUTTON_POSITIVE);
        assertEquals(1, checkpoints);
        assertTrue(manager.isInstallSplashScreenVisible());
    }

    @Test public void postponingInstallKeepsDownloadAndManualCheckCanResume() {
        startDownload(); manager.downloadCompletes(); drain();
        click(DialogInterface.BUTTON_NEGATIVE);
        checker.check(false); drain();
        assertFalse(dialog().isShowing());
        assertFalse(manager.isInstallSplashScreenVisible());
        checker.check(true); drain();
        assertTrue(dialog().isShowing());
        assertEquals(0, checkpoints);
    }

    @Test public void downloadCompletedWithoutFocusIsOfferedOnReturn() {
        startDownload(); activity.focused = false;
        manager.downloadCompletes(); drain();
        assertFalse(dialog().isShowing());
        activity.focused = true; checker.onForeground(); drain();
        assertTrue(dialog().isShowing());
        assertEquals(0, checkpoints);
    }

    @Test public void newCheckerRecoversAcceptedDownloadDespiteCheckThrottle() {
        startDownload(); checker.close();
        manager.downloadCompletes(); drain();
        checker = newChecker(); checker.check(false); drain();
        assertTrue(dialog().isShowing());
        assertEquals(0, checkpoints);
        click(DialogInterface.BUTTON_POSITIVE);
        assertEquals(1, checkpoints);
    }

    @Test public void automaticNetworkFailureDoesNotNavigateOrShowDialog() {
        manager.setInstallErrorCode(InstallErrorCode.ERROR_INTERNAL_ERROR);
        checker.check(false); drain();
        assertNull(dialog());
        assertNull(shadowOf(activity).getNextStartedActivity());
        assertEquals(0, checkpoints);
    }

    @Test public void immediateOnlyUpdateNeverInterruptsPlayback() {
        manager.setUpdateAvailable(1794632998, AppUpdateType.IMMEDIATE);
        checker.check(false); drain();
        assertNull(dialog());
        assertFalse(manager.isImmediateFlowVisible());
        assertFalse(manager.isInstallSplashScreenVisible());
    }

    @Test public void backgroundUpdateCheckDefersPromptUntilForeground() {
        activity.focused = false;
        manager.setUpdateAvailable(1794632998);
        checker.check(false); drain();
        assertNull(dialog());
        activity.focused = true; checker.onForeground(); drain();
        assertTrue(dialog().isShowing());
    }

    @Test public void closedCheckerDoesNotOfferInstallAfterDownload() {
        startDownload(); checker.close(); manager.downloadCompletes(); drain();
        assertFalse(dialog().isShowing());
        assertEquals(0, checkpoints);
        assertFalse(manager.isInstallSplashScreenVisible());
    }

    @Test public void failedInstallCanBeRetriedWithoutLosingAcceptedDownload() {
        startDownload(); manager.downloadCompletes(); drain();
        manager.setInstallErrorCode(InstallErrorCode.ERROR_INTERNAL_ERROR);
        click(DialogInterface.BUTTON_POSITIVE);
        assertEquals(1, checkpoints);
        assertFalse(manager.isInstallSplashScreenVisible());
        manager.setInstallErrorCode(InstallErrorCode.NO_ERROR);
        checker.check(true); drain();
        assertTrue(dialog().isShowing());
        click(DialogInterface.BUTTON_POSITIVE);
        assertEquals(2, checkpoints);
        assertTrue(manager.isInstallSplashScreenVisible());
    }

    @Test public void failedPlaybackCheckpointPreventsInstallation() {
        checker.close();
        checker = new PlayStoreUpdateChecker(activity, manager, () -> {
            throw new IllegalStateException("Storage unavailable");
        });
        startDownload(); manager.downloadCompletes(); drain();
        click(DialogInterface.BUTTON_POSITIVE);
        assertFalse(manager.isInstallSplashScreenVisible());
        checker.check(true); drain();
        assertTrue(dialog().isShowing());
    }
}
