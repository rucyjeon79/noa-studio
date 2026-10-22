package kr.ai.noastudio;

import android.net.Uri;
import java.util.Set;

/** The public catalogue is the source of playable URLs; share URLs are never streams. */
public final class NoaMediaPolicy {
 private NoaMediaPolicy() {}
 public static boolean studio(String value){
  if(value==null)return false;
  Uri u=Uri.parse(value);
  return "https".equals(u.getScheme())&&"noastudio.ai.kr".equals(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&u.getFragment()==null;
 }
 public static boolean audio(String value){
  if(!studio(value))return false;Uri u=Uri.parse(value);String path=u.getPath();
  if(path==null||path.contains(".."))return false;
  if(path.matches("/data/noa-audio/[A-Za-z0-9_-][A-Za-z0-9_.-]*\\.(mp3|m4a|ogg|wav|flac|aac)"))return u.getQuery()==null;
  return stream(u,"audio");
 }
 public static boolean artwork(String value){
  if(!studio(value))return false;Uri u=Uri.parse(value);String p=u.getPath();
  return p!=null&&!p.contains("..")&&(p.startsWith("/noa-assets/")&&u.getQuery()==null||stream(u,"cover"));
 }
 private static boolean stream(Uri u,String type){
  if(!"/noa-app/jukebox/stream.php".equals(u.getPath()))return false;
  if(!u.getQueryParameterNames().equals(new java.util.HashSet<>(java.util.Arrays.asList("key","type"))))return false;
  String key=u.getQueryParameter("key");
  return u.getQueryParameters("key").size()==1&&u.getQueryParameters("type").size()==1&&type.equals(u.getQueryParameter("type"))&&key!=null&&key.matches("[A-Za-z0-9:_-]{1,191}");
 }
}
