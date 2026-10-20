package kr.ai.noastudio;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CatalogTest {
 @Test public void productionSearchAndLyrics() throws Exception {
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  assertTrue(device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*개 문서.*"))),30000));
  device.dumpWindowHierarchy(new java.io.File(context.getExternalFilesDir(null),"noa-ui.xml"));
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android.png")));
  device.findObject(By.text("설정")).click();
  assertTrue(device.wait(Until.hasObject(By.text("NOA STUDIO · Ivory")),5000));
  device.findObject(By.text("NOA STUDIO · Ivory")).click();
  assertTrue(device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*개 문서.*"))),30000));
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android-ivory.png")));
  device.findObject(By.text("설정")).click();
  UiObject2 graphite=device.wait(Until.findObject(By.text("NOA STUDIO · Graphite")),5000);
  assertNotNull("Theme picker did not open",graphite);graphite.click();
  assertTrue(device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*개 문서.*"))),30000));
  UiObject2 search=device.findObject(By.clazz("android.widget.EditText"));
  assertNotNull(search);search.setText("하루");
  UiObject2 first=device.wait(Until.findObject(By.textContains("EP.01 · 하루의 끝에")),5000);
  assertNotNull(first);first.click();
  assertTrue(device.wait(Until.hasObject(By.text("NOA STUDIO 플레이어")),5000));
  assertTrue(device.hasObject(By.text("하루의 끝에")));
  // The production lyrics are selectable native text, not a placeholder.
  boolean lyrics=false;
  for(UiObject2 v:device.findObjects(By.clazz("android.widget.TextView"))){
   String text=v.getText();if(text!=null&&text.length()>100)lyrics=true;
  }
  assertTrue("Full production lyrics were not displayed",lyrics);
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android-detail.png")));
 }
}
