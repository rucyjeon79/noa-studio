package kr.ai.noastudio;

import android.animation.ValueAnimator;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.view.*;
import android.widget.*;
import androidx.media3.common.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/** Exactly two layout rows. Additional controls live in an anchored menu. */
@android.annotation.SuppressLint("UnsafeOptInUsageError")
public final class JukeboxView extends LinearLayout {
 public interface Actions{void play();void close();void queue();}
 private final Actions actions;private Player player;
 private final LinearLayout top,bottom;private final ImageView art;private final TextView title,current,total;private final ImageButton previous,play,next,more;
 private final SeekBar seek;private boolean seeking;private int foreground,background,gold;private String artUrl="";
 private final ExecutorService images=Executors.newSingleThreadExecutor();private final Map<String,Art> cache=new LinkedHashMap<>();
 private static final class Art{final Bitmap bitmap;final int color;Art(Bitmap b,int c){bitmap=b;color=c;}}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 public JukeboxView(Context c,Actions a){
  super(c);actions=a;setOrientation(VERTICAL);setPadding(dp(8),dp(6),dp(8),dp(2));setId(R.id.noa_dock);setContentDescription("JUKEBOX");
  top=new LinearLayout(c);top.setId(R.id.noa_dock_top);top.setGravity(Gravity.CENTER_VERTICAL);addView(top,new LayoutParams(-1,dp(48)));
  art=new ImageView(c);art.setImageResource(R.drawable.noa_symbol);art.setScaleType(ImageView.ScaleType.CENTER_CROP);art.setContentDescription("재생 중인 곡 카드 이미지");top.addView(art,new LayoutParams(dp(40),dp(40)));
  title=new TextView(c);title.setTextSize(14);title.setSingleLine();title.setMarqueeRepeatLimit(-1);title.setPadding(dp(10),0,dp(6),0);top.addView(title,new LayoutParams(0,-2,1));
  previous=icon("이전 곡",android.R.drawable.ic_media_previous,()->{if(player!=null)player.seekToPreviousMediaItem();});play=icon("재생",android.R.drawable.ic_media_play,actions::play);play.setId(R.id.noa_play);next=icon("다음 곡",android.R.drawable.ic_media_next,()->{if(player!=null)player.seekToNextMediaItem();});more=icon("재생 방식과 재생목록",android.R.drawable.ic_menu_more,this::menu);more.setId(R.id.noa_more);
  bottom=new LinearLayout(c);bottom.setId(R.id.noa_dock_bottom);bottom.setGravity(Gravity.CENTER_VERTICAL);addView(bottom,new LayoutParams(-1,dp(32)));
  current=clock(c);bottom.addView(current,new LayoutParams(dp(48),-2));seek=new SeekBar(c);seek.setMax(1000);seek.setContentDescription("재생 위치");bottom.addView(seek,new LayoutParams(0,dp(32),1));total=clock(c);total.setGravity(Gravity.END);bottom.addView(total,new LayoutParams(dp(48),-2));
  seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int n,boolean user){}public void onStartTrackingTouch(SeekBar b){seeking=true;}public void onStopTrackingTouch(SeekBar b){if(player!=null&&player.getDuration()>0)player.seekTo(player.getDuration()*b.getProgress()/1000);seeking=false;}});
 }
 private TextView clock(Context c){TextView v=new TextView(c);v.setTextSize(11);v.setSingleLine();v.setText("0:00");return v;}
 private ImageButton icon(String label,int drawable,Runnable click){ImageButton b=new ImageButton(getContext());b.setContentDescription(label);b.setImageResource(drawable);b.setPadding(dp(10),dp(10),dp(10),dp(10));b.setBackgroundColor(Color.TRANSPARENT);b.setOnClickListener(v->click.run());top.addView(b,new LayoutParams(dp(44),dp(44)));return b;}
 @Override protected void onMeasure(int width,int height){previous.setVisibility(MeasureSpec.getSize(width)/getResources().getDisplayMetrics().density<360?GONE:VISIBLE);super.onMeasure(width,height);}
 public void theme(int bg,int fg,int accent){background=bg;foreground=fg;gold=accent;GradientDrawable surface=new GradientDrawable();surface.setColor(bg);surface.setStroke(dp(1),Color.argb(70,128,128,128));setBackground(surface);title.setTextColor(fg);current.setTextColor(fg);total.setTextColor(fg);for(ImageButton b:new ImageButton[]{previous,play,next,more})b.setImageTintList(ColorStateList.valueOf(fg));tint(cache.containsKey(artUrl)?cache.get(artUrl).color:gold);}
 public void bind(Player p,boolean visible){player=p;setVisibility(visible&&p!=null&&p.getMediaItemCount()>0?VISIBLE:GONE);if(p==null)return;MediaItem item=p.getCurrentMediaItem();String text=item==null?"NOA STUDIO":String.valueOf(item.mediaMetadata.title);if(!text.contentEquals(title.getText())){title.setText(text);title.setContentDescription(text);}title.setEllipsize(ValueAnimator.areAnimatorsEnabled()?TextUtils.TruncateAt.MARQUEE:TextUtils.TruncateAt.END);title.setSelected(ValueAnimator.areAnimatorsEnabled());play.setImageResource(p.isPlaying()?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play);play.setContentDescription(p.isPlaying()?"일시정지":"재생");more.setActivated(p.getShuffleModeEnabled()||p.getRepeatMode()==Player.REPEAT_MODE_ONE);more.setImageTintList(ColorStateList.valueOf(more.isActivated()?gold:foreground));more.setContentDescription("재생 방식과 재생목록 · "+(p.getRepeatMode()==Player.REPEAT_MODE_ONE?"한 곡 반복":p.getShuffleModeEnabled()?"셔플":"순차재생"));long duration=p.getDuration();current.setText(time(p.getCurrentPosition()));total.setText(duration>0?time(duration):"--:--");seek.setEnabled(duration>0);if(!seeking&&duration>0)seek.setProgress((int)(1000*p.getCurrentPosition()/duration));String url=item==null||item.mediaMetadata.artworkUri==null?"":item.mediaMetadata.artworkUri.toString();if(!url.equals(artUrl)){artUrl=url;art.setImageResource(R.drawable.noa_symbol);tint(gold);loadArt(url);}}
 private String time(long ms){long s=Math.max(0,ms)/1000;return String.format(Locale.ROOT,"%d:%02d",s/60,s%60);}
 private void menu(){if(player==null)return;PopupMenu menu=new PopupMenu(getContext(),more);String[] labels={"이전 곡","순차재생","셔플","한 곡 반복","재생목록 열기","JUKEBOX 닫기"};for(int i=0;i<labels.length;i++){android.view.MenuItem item=menu.getMenu().add(0,i,i,labels[i]);if(i>=1&&i<=3)item.setCheckable(true).setChecked(i==1&&!player.getShuffleModeEnabled()&&player.getRepeatMode()==Player.REPEAT_MODE_OFF||i==2&&player.getShuffleModeEnabled()||i==3&&player.getRepeatMode()==Player.REPEAT_MODE_ONE);}
  menu.setOnMenuItemClickListener(item->{switch(item.getItemId()){case 0:player.seekToPreviousMediaItem();break;case 1:player.setRepeatMode(Player.REPEAT_MODE_OFF);player.setShuffleModeEnabled(false);break;case 2:player.setRepeatMode(Player.REPEAT_MODE_OFF);player.setShuffleModeEnabled(true);break;case 3:player.setShuffleModeEnabled(false);player.setRepeatMode(Player.REPEAT_MODE_ONE);break;case 4:actions.queue();break;case 5:actions.close();return true;default:return false;}bind(player,true);return true;});menu.show();
 }
 private void loadArt(String url){if(!NoaMediaPolicy.artwork(url)||images.isShutdown())return;Art hit=cache.get(url);if(hit!=null){art.setImageBitmap(hit.bitmap);tint(hit.color);return;}images.execute(()->{try{HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setInstanceFollowRedirects(false);Art result;try{if(c.getResponseCode()!=200)return;BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=4;Bitmap b=BitmapFactory.decodeStream(c.getInputStream(),null,options);if(b==null)return;result=new Art(b,palette(b,gold));}finally{c.disconnect();}post(()->{if(cache.size()>32)cache.remove(cache.keySet().iterator().next());cache.put(url,result);if(url.equals(artUrl)){art.setImageBitmap(result.bitmap);tint(result.color);}});}catch(Exception ignored){}});}
 static int palette(Bitmap b,int fallback){long r=0,g=0,blue=0,n=0;float[] hsv=new float[3];for(int y=0;y<b.getHeight();y+=Math.max(1,b.getHeight()/16))for(int x=0;x<b.getWidth();x+=Math.max(1,b.getWidth()/16)){int color=b.getPixel(x,y);Color.colorToHSV(color,hsv);if(Color.alpha(color)<200||hsv[2]<.2||hsv[2]>.9||hsv[1]<.15)continue;r+=Color.red(color);g+=Color.green(color);blue+=Color.blue(color);n++;}return n==0?fallback:Color.rgb((int)(r/n),(int)(g/n),(int)(blue/n));}
 private static double luminance(int c){double[] v={Color.red(c)/255.,Color.green(c)/255.,Color.blue(c)/255.};for(int i=0;i<3;i++)v[i]=v[i]<=.04045?v[i]/12.92:Math.pow((v[i]+.055)/1.055,2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];}
 private void tint(int color){double bg=luminance(background),fg=luminance(color);float[] hsv=new float[3];Color.colorToHSV(color,hsv);for(int i=0;i<10&&(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)<3;i++){hsv[2]=Math.max(.1f,Math.min(.9f,hsv[2]+(bg>.4?-.07f:.07f)));color=Color.HSVToColor(hsv);fg=luminance(color);}if((Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)<3)color=bg>.4?Color.rgb(129,92,25):Color.rgb(213,185,121);seek.setProgressTintList(ColorStateList.valueOf(color));seek.setThumbTintList(ColorStateList.valueOf(color));seek.setProgressBackgroundTintList(ColorStateList.valueOf(Color.argb(80,128,128,128)));}
 public void release(){images.shutdownNow();}
}
