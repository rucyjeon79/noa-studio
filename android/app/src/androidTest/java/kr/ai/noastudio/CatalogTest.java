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
  boolean loaded=device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡.*ACT·목록"))),60000);
  if(loaded)assertTrue("Registered album artwork did not load",device.wait(Until.hasObject(By.desc("앨범 아트")),20000));
  device.dumpWindowHierarchy(new java.io.File(context.getExternalFilesDir(null),"noa-ui.xml"));
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android.png")));
  assertTrue("Production catalog did not load; see captured screen",loaded);
  device.findObject(By.desc("설정")).click();
  assertTrue(device.wait(Until.hasObject(By.text("NOA STUDIO · Ivory")),5000));
  device.findObject(By.text("NOA STUDIO · Ivory")).click();
  assertTrue(device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡.*ACT·목록"))),30000));
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android-ivory.png")));
  device.findObject(By.desc("설정")).click();
  UiObject2 graphite=device.wait(Until.findObject(By.text("NOA STUDIO · Graphite")),5000);
  assertNotNull("Theme picker did not open",graphite);graphite.click();
  assertTrue(device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡.*ACT·목록"))),30000));
  device.findObject(By.desc("설정")).click();
  UiObject2 language=device.wait(Until.findObject(By.text("언어")),5000);assertNotNull(language);language.click();
  UiObject2 japanese=device.wait(Until.findObject(By.text("日本語")),5000);assertNotNull(japanese);japanese.click();
  assertTrue(device.wait(Until.hasObject(By.desc("設定")),5000));
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android-japanese.png")));
  device.findObject(By.desc("設定")).click();
  UiObject2 languageAgain=device.wait(Until.findObject(By.text("言語")),5000);assertNotNull(languageAgain);languageAgain.click();
  UiObject2 korean=device.wait(Until.findObject(By.text("한국어")),5000);assertNotNull(korean);korean.click();
  assertTrue(device.wait(Until.hasObject(By.desc("설정")),5000));
  UiObject2 search=device.findObject(By.clazz("android.widget.EditText"));
  assertNotNull(search);search.setText("하루");
  device.waitForIdle();
  UiObject first=new UiObject(new UiSelector().textContains("EP.01 · 하루의 끝에"));
  assertTrue(first.waitForExists(5000));first.click();
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
