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
  java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");
  try(java.io.InputStream input=context.getResources().openRawResource(R.drawable.noa_symbol)){byte[] block=new byte[4096];int n;while((n=input.read(block))!=-1)digest.update(block,0,n);}
  StringBuilder sha=new StringBuilder();for(byte b:digest.digest())sha.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
  assertEquals("Original icon bytes changed", "7a6b94a09ba10b951f15b6779c7d30c74e1ee44bdd5e2a9df7e6a676dd9f02cb",sha.toString());
  android.graphics.drawable.Drawable icon=context.getPackageManager().getApplicationIcon(context.getPackageName());
  assertTrue("Launcher must use the original adaptive icon",icon instanceof android.graphics.drawable.AdaptiveIconDrawable);
  android.graphics.Bitmap iconBitmap=android.graphics.Bitmap.createBitmap(256,256,android.graphics.Bitmap.Config.ARGB_8888);
  icon.setBounds(0,0,256,256);icon.draw(new android.graphics.Canvas(iconBitmap));
  try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(context.getExternalFilesDir(null),"noa-launcher-icon.png"))){assertTrue(iconBitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));}
  try(java.io.FileWriter out=new java.io.FileWriter(new java.io.File(context.getExternalFilesDir(null),"noa-brand-proof.json"))){out.write(new org.json.JSONObject().put("sourceSha256",sha.toString()).put("installedAdaptiveIcon",true).put("physicalDevice",false).toString());}
  context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  boolean loaded=device.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡.*ACT·목록"))),60000);
  if(loaded)assertTrue("Original genre artwork did not load",device.wait(Until.hasObject(By.desc("장르 대표 이미지")),20000));
  device.dumpWindowHierarchy(new java.io.File(context.getExternalFilesDir(null),"noa-ui.xml"));
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android.png")));
  assertTrue("Production catalog did not load; see captured screen",loaded);
  int previousNavLeft=-1;
  for(String label:new String[]{"홈","YouTube","세계관","음원","MY"}){UiObject2 item=device.findObject(By.text(label));assertNotNull("Missing native menu "+label,item);int left=item.getVisibleBounds().left;assertTrue("Native menu order differs from web",left>previousNavLeft);previousNavLeft=left;}

  assertTrue("All ACT metadata did not reach native sound browsing",device.hasObject(By.text("491곡 · 52 ACT·목록")));
  device.findObject(By.text(java.util.regex.Pattern.compile("오리지널 장르 · .*"))).click();
  UiObject2 kpop=device.wait(Until.findObject(By.text("KPOP ORIGINAL")),5000);assertNotNull(kpop);kpop.click();
  UiObject2 act=device.wait(Until.findObject(By.text("ACT 1 · EP.1–10")),5000);assertNotNull(act);act.click();
  assertTrue("ACT document was duplicated among its tracks",device.wait(Until.hasObject(By.text("10개 항목 · 24개씩 표시")),5000));
  device.findObject(By.text("음원")).click();
  device.waitForIdle();
  assertTrue(device.wait(Until.hasObject(By.text("491곡 · 52 ACT·목록")),5000));
  UiObject settingsButton=new UiObject(new UiSelector().description("설정"));
  assertTrue(settingsButton.waitForExists(5000));settingsButton.click();
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
  assertTrue(device.wait(Until.hasObject(By.text("곡 상세·Suno 링크")),5000));
  assertTrue(device.hasObject(By.text("하루의 끝에")));
  // The production lyrics are selectable native text, not a placeholder.
  boolean lyrics=false;
  for(UiObject2 v:device.findObjects(By.clazz("android.widget.TextView"))){
   String text=v.getText();if(text!=null&&text.length()>100)lyrics=true;
  }
  assertTrue("Full production lyrics were not displayed",lyrics);
  assertTrue(device.takeScreenshot(new java.io.File(context.getExternalFilesDir(null),"noa-android-detail.png")));
  UiObject2 youtube=device.findObject(By.text("YouTube 영상"));assertNotNull("Linked video action missing",youtube);youtube.click();device.waitForIdle();
  java.util.concurrent.atomic.AtomicReference<String> webUrl=new java.util.concurrent.atomic.AtomicReference<>("");
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{
   for(android.app.Activity activity:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED)){
    if(activity instanceof MainActivity){java.lang.reflect.Field field=MainActivity.class.getDeclaredField("browser");field.setAccessible(true);android.webkit.WebView web=(android.webkit.WebView)field.get(activity);if(web!=null)webUrl.set(web.getUrl());}
   }
  }catch(Exception e){throw new RuntimeException(e);}});
  assertTrue("Video action routed to the sound player: "+webUrl.get(),webUrl.get().startsWith("https://noastudio.ai.kr/noa-youtube.php?track="));

 }
}
