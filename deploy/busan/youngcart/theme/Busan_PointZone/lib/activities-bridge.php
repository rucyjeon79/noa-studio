<?php
if(!defined('_GNUBOARD_'))exit;
/* Only feature records; no direct writes to native points or member tables. */
final class BusanActivitiesBridge {
    private static function database():PDO{
        $engine=__DIR__.'/engine/pointzone-activities.php';
        if(!is_file($engine))throw new RuntimeException('activity package unavailable');
        require_once $engine;
        // The fixture supplies the isolated DB explicitly; production uses
        // the already configured native database, never a client parameter.
        if(defined('BPZ_ISOLATED_FIXTURE')&&BPZ_ISOLATED_FIXTURE===true&&getenv('BUSAN_FIXTURE_DB')==='pointzone_fixture'){
            $db=$GLOBALS['db']??null;
            if(!$db instanceof PDO||$db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture unavailable');
        }else{
            foreach(['G5_MYSQL_HOST','G5_MYSQL_DB','G5_MYSQL_USER','G5_MYSQL_PASSWORD'] as $key)if(!defined($key))throw new RuntimeException('native db unavailable');
            $db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4',G5_MYSQL_USER,G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
        }
        return $db;
    }
    public static function open():BusanPointZoneActivities{
        $db=self::database(); // Load the activity class before PHP resolves new.
        return new BusanPointZoneActivities($db);
    }
    public static function financialEnabled():bool{
        if(!defined('BPZ_ISOLATED_FIXTURE')||BPZ_ISOLATED_FIXTURE!==true||getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')return false;
        return self::database()->query('SELECT DATABASE()')->fetchColumn()==='pointzone_fixture' && function_exists('insert_point');
    }
    public static function settlement():BusanActivitySettlement{
        if(!self::financialEnabled())throw new DomainException('정산 기능은 운영 검증 전입니다.');
        require_once __DIR__.'/engine/pointzone-activity-settlement.php';
        return new BusanActivitySettlement(self::database());
    }
    public static function stringField(array $p,string $key):string{
        if(!is_string($p[$key]??null))throw new DomainException('잘못된 입력');
        return $p[$key];
    }
    public static function amount(array $p,string $key):int{
        $v=self::stringField($p,$key);
        if(!preg_match('/^[1-9][0-9]{0,9}$/D',$v)||(int)$v>2147483647)throw new DomainException('포인트 금액 오류');
        return (int)$v;
    }
    public static function csrf():string{
        $token=get_session('ss_bpz_activity_csrf');
        $owner=(string)($GLOBALS['member']['mb_id']??'');
        if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)||get_session('ss_bpz_activity_csrf_owner')!==$owner){
            $token=bin2hex(random_bytes(32));set_session('ss_bpz_activity_csrf',$token);set_session('ss_bpz_activity_csrf_owner',$owner);
        }
        return $token;
    }
    public static function verify(array $post,string $csrf):void{
        if(!is_string($post['csrf']??null)||!hash_equals($csrf,$post['csrf']))throw new DomainException('요청을 다시 확인해 주세요.');
    }
    public static function draft(array $post,string $kind):array{
        foreach(['title','description','opens_at','closes_at','point_amount','step_points','capacity','duration_days','item_id'] as $key)if(isset($post[$key])&&!is_string($post[$key]))throw new DomainException('잘못된 입력 형식');
        $data=['kind'=>$kind,'title'=>$post['title']??'','description'=>$post['description']??'','opens_at'=>self::date($post['opens_at']??''),'closes_at'=>empty($post['closes_at'])?null:self::date($post['closes_at'])];
        foreach(['point_amount','step_points','capacity','duration_days'] as $key){
            $raw=$post[$key]??'0';
            if(!preg_match('/^(0|[1-9][0-9]{0,9})$/D',$raw)||(int)$raw>2147483647)throw new DomainException('숫자 입력 오류');
            $data[$key]=(int)$raw;
        }
        $data['item_id']=$kind==='profile'?($post['item_id']??''):null;
        return $data;
    }
    private static function date(string $raw):string{
        if(!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/D',$raw))throw new DomainException('일정 입력 오류');
        return str_replace('T',' ',$raw).':00';
    }
}
