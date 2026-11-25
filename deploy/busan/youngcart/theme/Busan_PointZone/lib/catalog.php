<?php
if(!defined('_GNUBOARD_'))exit;
final class BusanCatalog{
    public static function text($v,int $max,bool $required=true):string{
        if(!is_string($v)||!preg_match('//u',$v))throw new DomainException('문자 입력 오류');
        $v=trim($v);
        if(($required&&$v==='')||mb_strlen($v,'UTF-8')>$max||preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/',$v))throw new DomainException('문자 길이 또는 형식 오류');
        return $v;
    }
    public static function number($v,int $min):int{
        if(!is_string($v)||!preg_match('/^(0|[1-9][0-9]{0,9})$/D',$v)||(int)$v<$min||(int)$v>2147483647)throw new DomainException('포인트·수량 입력 오류');
        return (int)$v;
    }
    public static function category($v):string{
        if(!is_string($v)||!preg_match('/^[a-z0-9]{2}$/D',$v)||$v==='00')throw new DomainException('분류 코드는 00을 제외한 영문 소문자·숫자 2자리입니다.');
        return $v;
    }
    public static function item($v):string{
        if(!is_string($v)||!preg_match('/^[a-f0-9]{20}$/D',$v))throw new DomainException('상품 코드 오류');
        return $v;
    }
    public static function draft(array $p):array{
        return ['category'=>self::category($p['category']??null),'name'=>self::text($p['name']??null,100),'description'=>self::text($p['description']??'',1000,false),'price'=>self::number($p['price']??null,1),'stock'=>self::number($p['stock']??null,0)];
    }
    private static function v($v):string{return "'".sql_real_escape_string((string)$v)."'";}
    public static function q($s){$r=sql_query($s,false);if($r===false)throw new RuntimeException('query failed');return $r;}
    public static function rows($s):array{$out=[];$rs=self::q($s);while($r=sql_fetch_array($rs))$out[]=$r;return $out;}
    public static function ready():void{
        if(defined('G5_USE_SHOP')&&G5_USE_SHOP)throw new RuntimeException('draft mode closed');
        foreach(['category','item','item_option','cart','order','default'] as $k){
            $t='yc5_'.$k;$r=sql_fetch("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$t' LIMIT 1",false);
            if(strtoupper((string)($r['engine']??''))!=='INNODB')throw new RuntimeException('schema unavailable');
        }
        $r=sql_fetch("SELECT COUNT(*) AS n FROM yc5_default",false);
        if((int)($r['n']??0)!==1)throw new RuntimeException('defaults unavailable');
    }
    public static function mutate(string $action,array $p):void{
        if(($GLOBALS['is_admin']??'')!=='super'||empty($GLOBALS['is_member']))throw new DomainException('관리 권한이 없습니다.');
        self::ready();
        $l=sql_fetch("SELECT GET_LOCK('busan_yc_catalog_v1',10) AS ok",false);
        if((int)($l['ok']??0)!==1)throw new RuntimeException('catalog busy');
        try{
            self::q('START TRANSACTION');
            if($action==='category_create'){
                $id=self::category($p['category']??null);$name=self::text($p['name']??null,100);
                $r=sql_fetch("SELECT ca_id FROM yc5_category WHERE ca_id=".self::v($id)." FOR UPDATE",false);
                if(!empty($r['ca_id']))throw new DomainException('이미 존재하는 분류입니다.');
                self::q("INSERT INTO yc5_category SET ca_id=".self::v($id).",ca_name=".self::v($name).",ca_use=0,ca_nocoupon=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
            }elseif(in_array($action,['item_create','item_update'],true)){
                $d=self::draft($p);
                $r=sql_fetch("SELECT ca_id FROM yc5_category WHERE ca_id=".self::v($d['category'])." FOR UPDATE",false);
                if(empty($r['ca_id']))throw new DomainException('분류를 먼저 등록해 주세요.');
                $id=$action==='item_create'?bin2hex(random_bytes(10)):self::item($p['item']??null);
                $set="ca_id=".self::v($d['category']).",it_name=".self::v($d['name']).",it_basic=".self::v($d['description']).",it_price=".$d['price'].",it_stock_qty=".$d['stock'].",it_update_time=NOW(),it_use=0,it_point=0,it_supply_point=0,it_cust_price=0,it_nocoupon=1";
                if($action==='item_create')self::q("INSERT INTO yc5_item SET it_id=".self::v($id).",$set,it_time=NOW(),it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''");
                else{
                    $r=sql_fetch("SELECT it_id,it_use FROM yc5_item WHERE it_id=".self::v($id)." FOR UPDATE",false);
                    if(empty($r['it_id'])||(int)$r['it_use']!==0)throw new DomainException('미공개 상품만 수정 가능합니다.');
                    $n=sql_fetch("SELECT COUNT(*) AS n FROM yc5_cart WHERE it_id=".self::v($id),false);
                    if(!isset($n['n'])||(int)$n['n']!==0)throw new DomainException('거래 기록이 있는 상품은 수정할 수 없습니다.');
                    self::q("UPDATE yc5_item SET $set WHERE it_id=".self::v($id)." AND it_use=0");
                }
            }else throw new DomainException('지원하지 않는 작업입니다.');
            self::q('COMMIT');
        }catch(Throwable $e){sql_query('ROLLBACK',false);throw $e;}
        finally{sql_query("SELECT RELEASE_LOCK('busan_yc_catalog_v1')",false);}
    }
}
