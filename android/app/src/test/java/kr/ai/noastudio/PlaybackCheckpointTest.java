package kr.ai.noastudio;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import java.lang.reflect.Proxy;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public class PlaybackCheckpointTest {
    private Context context;
    @Before public void setUp() {
        context = RuntimeEnvironment.getApplication();
        context.getSharedPreferences("noa-native-playback-v2", 0).edit().clear().commit();
    }

    private Player player(String url) {
        MediaItem item = new MediaItem.Builder().setMediaId("track-1").setUri(url)
                .setMediaMetadata(new MediaMetadata.Builder().setTitle("NOA test").build()).build();
        return (Player) Proxy.newProxyInstance(Player.class.getClassLoader(), new Class<?>[]{Player.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getMediaItemCount": return 1;
                        case "getMediaItemAt": return item;
                        case "getCurrentMediaItemIndex": return 0;
                        case "getCurrentPosition": return 27123L;
                        case "getShuffleModeEnabled": return true;
                        case "getRepeatMode": return Player.REPEAT_MODE_ALL;
                        default: throw new AssertionError("Checkpoint must not control playback: " + method.getName());
                    }
                });
    }

    @Test public void checkpointSurvivesStoreRecreationWithoutControllingPlayback() {
        PlaybackStateStore store = new PlaybackStateStore(context);
        store.setClosed(false);
        assertTrue(store.saveForUpdate(player("https://noastudio.ai.kr/noa-app/jukebox/stream.php?key=track-1&type=audio")));
        PlaybackStateStore reopened = new PlaybackStateStore(context);
        assertFalse(reopened.closed());
        assertEquals(1, reopened.items().size());
        assertEquals("track-1", reopened.items().get(0).mediaId);
        assertEquals(27123L, reopened.position());
        assertTrue(reopened.shuffle());
        assertEquals(Player.REPEAT_MODE_ALL, reopened.repeat());
    }

    @Test public void unsafeMediaCannotReplaceLastKnownSafeCheckpoint() {
        PlaybackStateStore store = new PlaybackStateStore(context);
        assertTrue(store.saveForUpdate(player("https://noastudio.ai.kr/noa-app/jukebox/stream.php?key=track-1&type=audio")));
        assertFalse(store.saveForUpdate(player("https://example.invalid/private.mp3")));
        assertEquals("track-1", new PlaybackStateStore(context).items().get(0).mediaId);
    }
}
