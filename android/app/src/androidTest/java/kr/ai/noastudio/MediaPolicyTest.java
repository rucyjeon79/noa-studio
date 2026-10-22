package kr.ai.noastudio;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaPolicyTest {
 @Test public void onlyOfficialVerifiedMediaLocationsAreAccepted(){
  String base="https://noastudio.ai.kr/noa-app/jukebox/stream.php?key=single%3Akpop-original%3A01&type=";assertTrue(NoaMediaPolicy.audio(base+"audio"));assertTrue(NoaMediaPolicy.artwork(base+"cover"));assertFalse(NoaMediaPolicy.audio(base+"cover"));assertFalse(NoaMediaPolicy.audio(base+"audio&type=audio"));assertFalse(NoaMediaPolicy.audio(base+"audio&redirect=1"));assertFalse(NoaMediaPolicy.audio(base.replace("noastudio.ai.kr","noastudio.ai.kr.evil.example")+"audio"));assertFalse(NoaMediaPolicy.audio("https://youtube.com/watch?v=test"));assertFalse(NoaMediaPolicy.audio("https://noastudio.ai.kr/data/noa-audio/../private.mp3"));assertTrue(NoaMediaPolicy.audio("https://noastudio.ai.kr/data/noa-audio/song.mp3"));assertFalse(NoaMediaPolicy.audio("http://noastudio.ai.kr/data/noa-audio/song.mp3"));
 }
}
