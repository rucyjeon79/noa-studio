<?php
if(!defined('_GNUBOARD_'))exit;
/** Read-only projections for the independent theme. No order mutations. */
final class BusanOrderViews {
    private static function member(): string {
        $m=$GLOBALS['member']??[];
        if(empty($GLOBALS['is_member'])||empty($m['mb_id'])||!empty($m['mb_leave_date'])||!empty($m['mb_intercept_date']))
            throw new DomainException('회원 권한이 필요합니다.');
        return (string)$m['mb_id'];
    }
    private static function q(string $sql):array{
        $rs=sql_query($sql,false);
        if($rs===false)throw new RuntimeException('조회 실패');
        $rows=[];while($r=sql_fetch_array($rs))$rows[]=$r;return $rows;
    }
    private static function quote(string $v):string{return "'".sql_real_escape_string($v)."'";}
    public static function catalog(?string $itemId=null):array{
        self::member();
        $columns='i.it_id,i.it_name,i.it_basic,i.it_price,i.it_stock_qty,i.it_img1';
        $scope='';
        if($itemId!==null){
            $columns.=',i.it_explan,i.it_mobile_explan,c.ca_name';
            $scope=" AND i.it_id=".self::quote($itemId);
        }
        return self::q("SELECT $columns FROM yc5_item i INNER JOIN yc5_category c ON c.ca_id=i.ca_id WHERE i.it_use=1 AND c.ca_use=1 AND i.it_soldout=0 AND i.it_tel_inq=0 AND i.it_price>0$scope ORDER BY i.it_order,i.it_id LIMIT 100");
    }
    public static function orders(bool $admin=false):array{
        $member=self::member();
        if($admin&&($GLOBALS['is_admin']??'')!=='super')throw new DomainException('최고 관리자만 이용할 수 있습니다.');
        $scope=$admin?'':" AND mb_id=".self::quote($member);
        return self::q("SELECT od_id,od_status,od_cart_count,od_receipt_point,od_time".($admin?",mb_id":"")." FROM yc5_order WHERE od_settle_case='포인트' AND od_receipt_price=0".$scope." ORDER BY od_id DESC LIMIT 100");
    }
    public static function status(string $raw):string{
        return ['주문'=>'접수','입금'=>'포인트 차감 완료','준비'=>'상품 준비','배송'=>'지급 진행','완료'=>'지급 완료','취소'=>'취소','부분취소'=>'부분 취소'][$raw]??'상태 확인 필요';
    }
}
