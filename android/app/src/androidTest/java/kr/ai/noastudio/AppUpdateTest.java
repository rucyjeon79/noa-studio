package kr.ai.noastudio;

import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class AppUpdateTest {
    private JSONObject release() throws Exception {
        return new JSONObject().put("schemaVersion",1).put("app","NOA STUDIO")
                .put("applicationId","kr.ai.noastudio").put("versionCode",42)
                .put("file","noa-studio-android-build-42.apk").put("sha256",new String(new char[64]).replace('\0','a'));
    }
    @Test public void onlyNewerVersionsAreOffered() throws Exception {
        assertEquals(42,AppUpdateChecker.newerVersion(release(),41));
        assertEquals(0,AppUpdateChecker.newerVersion(release(),42));
        assertEquals(0,AppUpdateChecker.newerVersion(release(),43));
    }
    @Test public void rejectsForeignOrMalformedReleases() throws Exception {
        String[] fields={"applicationId","file","sha256","schemaVersion","versionCode"};
        Object[] values={"other.app","../evil.apk","invalid",2,-1};
        for(int i=0;i<fields.length;i++) {
            try { AppUpdateChecker.newerVersion(release().put(fields[i],values[i]),1); fail(fields[i]); }
            catch(IllegalArgumentException expected) { }
        }
    }
}
