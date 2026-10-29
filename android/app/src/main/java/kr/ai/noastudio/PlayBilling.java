package kr.ai.noastudio;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.widget.Toast;
import com.android.billingclient.api.*;
import org.json.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Google owns the payment sheet; only the authenticated server grants points. */
final class PlayBilling implements PurchasesUpdatedListener {
    private static final String ORIGIN="https://noastudio.ai.kr";
    private final Activity activity;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Set<String> verifying=new HashSet<>();
    private final BillingClient client;
    private boolean connecting=false,closed=false;
    PlayBilling(Activity activity) {
        this.activity=activity;
        client=BillingClient.newBuilder(activity).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    private void message(String text) {if(!closed)Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
    private void connected(Runnable action) {
        if(closed)return;
        if(client.isReady()){action.run();return;}
        if(connecting){message("Google Play에 연결 중입니다. 잠시 후 다시 눌러 주세요.");return;}
        connecting=true;
        client.startConnection(new BillingClientStateListener(){
            public void onBillingSetupFinished(BillingResult r){main.post(()->{connecting=false;if(closed)return;if(r.getResponseCode()==BillingClient.BillingResponseCode.OK)action.run();else message("Google Play 결제에 연결하지 못했습니다.");});}
            public void onBillingServiceDisconnected(){main.post(()->connecting=false);}
        });
    }
    private JSONObject request(String cookies,String csrf,JSONObject body) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(ORIGIN+"/noa-bridge/google-play.php").openConnection();
        c.setInstanceFollowRedirects(false);c.setConnectTimeout(5000);c.setReadTimeout(25000);
        c.setRequestProperty("Cookie",cookies==null?"":cookies);c.setRequestProperty("Accept","application/json");
        try {
            if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Origin",ORIGIN);c.setRequestProperty("X-Noa-CSRF",csrf);c.setRequestProperty("Content-Type","application/json");try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
            int code=c.getResponseCode();if(code<200||code>=300)throw new IOException("verification_failed");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] chunk=new byte[4096];int n;while((n=in.read(chunk))!=-1){bytes.write(chunk,0,n);if(bytes.size()>65536)throw new IOException("response_too_large");}}
            JSONObject result=new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));if(!result.optBoolean("ok"))throw new IOException("verification_failed");return result;
        }finally{c.disconnect();}
    }
    void showProducts() {
        String cookies=CookieManager.getInstance().getCookie(ORIGIN);
        io.execute(()->{try{JSONObject context=request(cookies,null,null);main.post(()->{
            if(closed)return;
            if(!context.optBoolean("ready")){message("Google Play 결제 준비 중입니다. 아직 결제되지 않습니다.");return;}
            connected(()->queryProducts(context));
        });}catch(Exception e){main.post(()->message("로그인 상태와 결제 연결을 확인해 주세요."));}});
    }
    private void queryProducts(JSONObject context) {
        List<QueryProductDetailsParams.Product> products=new ArrayList<>();JSONArray ids=context.optJSONArray("products");
        if(ids==null)return;
        for(int i=0;i<ids.length();i++)products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(ids.optString(i)).setProductType(BillingClient.ProductType.INAPP).build());
        if(products.isEmpty())return;
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(),(result,details)->main.post(()->{
            if(closed)return;
            List<ProductDetails> available=new ArrayList<>();List<String> labels=new ArrayList<>();
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)for(ProductDetails p:details.getProductDetailsList()){
                ProductDetails.OneTimePurchaseOfferDetails offer=p.getOneTimePurchaseOfferDetails();
                if(offer!=null){available.add(p);labels.add(p.getName()+" · "+offer.getFormattedPrice());}
            }
            if(available.isEmpty()){message("등록된 Google Play 포인트권이 없습니다.");return;}
            new AlertDialog.Builder(activity).setTitle("Google Play 포인트권")
                .setItems(labels.toArray(new String[0]),(dialog,index)->{
                    ProductDetails p=available.get(index);
                    BillingFlowParams.ProductDetailsParams item=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(p.getOneTimePurchaseOfferDetails().getOfferToken()).build();
                    BillingResult launched=client.launchBillingFlow(activity,BillingFlowParams.newBuilder().setObfuscatedAccountId(context.optString("accountId")).setProductDetailsParamsList(Collections.singletonList(item)).build());
                    if(launched.getResponseCode()!=BillingClient.BillingResponseCode.OK)message("결제창을 열지 못했습니다. 다시 확인해 주세요.");
                }).setNegativeButton("닫기",null).show();
        }));
    }
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases) {
        main.post(()->{if(closed)return;if(result.getResponseCode()==BillingClient.BillingResponseCode.OK&&purchases!=null)for(Purchase p:purchases)verify(p);
            else if(result.getResponseCode()!=BillingClient.BillingResponseCode.USER_CANCELED)message("결제 상태를 확인하지 못했습니다. 앱을 다시 열면 재확인합니다.");});
    }
    private void verify(Purchase p) {
        if(p.getPurchaseState()==Purchase.PurchaseState.PENDING){message("결제 승인 대기 중입니다. 승인 후 포인트가 반영됩니다.");return;}
        if(p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED||p.getProducts().size()!=1||!verifying.add(p.getPurchaseToken()))return;
        String cookies=CookieManager.getInstance().getCookie(ORIGIN);
        io.execute(()->{String text;try{
            JSONObject context=request(cookies,null,null);
            JSONObject body=new JSONObject().put("productId",p.getProducts().get(0)).put("purchaseToken",p.getPurchaseToken());
            JSONObject response=request(cookies,context.getString("csrf"),body).getJSONObject("purchase");
            text=response.getBoolean("test")?"테스트 결제 확인 완료 · 운영 포인트는 지급하지 않습니다.":"포인트 충전이 확인되었습니다. 웹에서도 같은 계정으로 이용할 수 있습니다.";
        }catch(Exception e){text="결제 확인 대기 중입니다. 다시 결제하지 말고 같은 NOA 계정으로 앱을 다시 열어 주세요.";}
        final String notice=text;main.post(()->{verifying.remove(p.getPurchaseToken());message(notice);});});
    }
    void restore() {
        if(closed)return;
        // Querying unfinished purchases never starts a new purchase or grants locally.
        connected(()->client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(result,purchases)->{
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)main.post(()->{if(!closed)for(Purchase p:purchases)verify(p);});
        }));
    }
    void close(){closed=true;client.endConnection();io.shutdownNow();}
}
