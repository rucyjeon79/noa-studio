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
 @Test public void productionMusicAndBrandRemainAvailable()throws Exception{
  android.content.Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();UiDevice d=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");try(java.io.InputStream in=c.getResources().openRawResource(R.drawable.noa_symbol)){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);}StringBuilder sha=new StringBuilder();for(byte b:digest.digest())sha.append(String.format(java.util.Locale.ROOT,"%02x",b&255));assertEquals("7a6b94a09ba10b951f15b6779c7d30c74e1ee44bdd5e2a9df7e6a676dd9f02cb",sha.toString());
  android.graphics.drawable.Drawable icon=c.getPackageManager().getApplicationIcon(c.getPackageName());assertTrue(icon instanceof android.graphics.drawable.AdaptiveIconDrawable);android.graphics.Bitmap bmp=android.graphics.Bitmap.createBitmap(256,256,android.graphics.Bitmap.Config.ARGB_8888);icon.setBounds(0,0,256,256);icon.draw(new android.graphics.Canvas(bmp));try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(c.getExternalFilesDir(null),"noa-launcher-icon.png"))){bmp.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}try(java.io.FileWriter out=new java.io.FileWriter(new java.io.File(c.getExternalFilesDir(null),"noa-brand-proof.json"))){out.write(new org.json.JSONObject().put("sourceSha256",sha.toString()).put("installedAdaptiveIcon",true).put("physicalDevice",false).toString());}
  c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));UiObject2 music=d.wait(Until.findObject(By.res(c.getPackageName(),"noa_nav_music")),15000);assertNotNull(music);music.click();assertTrue("Live catalog unavailable",d.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡 · MP3 [1-9][0-9]*곡"))),60000));assertFalse("Removed search returned",d.hasObject(By.clazz("android.widget.EditText")));
  for(String id:new String[]{"home","youtube","world","music","my"})assertNotNull(d.findObject(By.res(c.getPackageName(),"noa_nav_"+id)));
  d.dumpWindowHierarchy(new java.io.File(c.getExternalFilesDir(null),"noa-ui.xml"));d.takeScreenshot(new java.io.File(c.getExternalFilesDir(null),"noa-android.png"));
  d.findObject(By.desc("설정")).click();UiObject2 ivory=d.wait(Until.findObject(By.text("NOA STUDIO · Ivory")),5000);assertNotNull(ivory);ivory.click();assertTrue(d.wait(Until.hasObject(By.text(java.util.regex.Pattern.compile("[1-9][0-9]*곡 · MP3.*"))),10000));d.takeScreenshot(new java.io.File(c.getExternalFilesDir(null),"noa-android-ivory.png"));d.findObject(By.desc("설정")).click();UiObject2 graphite=d.wait(Until.findObject(By.text("NOA STUDIO · Graphite")),5000);assertNotNull(graphite);graphite.click();
 }
}
