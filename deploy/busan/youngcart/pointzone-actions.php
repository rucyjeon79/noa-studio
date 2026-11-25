<?php
declare(strict_types=1);
/** HTTP-independent route validation. Identity comes only from native session.
 * No member, cart ID, point amount or payment method accepted from the client.
 */
final class BusanPointZoneActions {
    public function __construct(private Closure $dispatch){}
    public function handle(array $actor,string $csrf,string $cart,string $method,array $post):array{
        $member=$actor['member']??null;
        if($method!=='POST'||!is_string($member)||!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$member)||
           ($actor['active']??false)!==true||$csrf===''||!is_string($post['csrf']??null)||!hash_equals($csrf,$post['csrf']))
            throw new DomainException('인증 또는 요청 확인 실패');
        $action=$post['action']??null;
        $spec=[
            'cart_set'=>['action','csrf','item','qty'],
            'cart_remove'=>['action','csrf','item'],
            'purchase'=>['action','csrf','request_id'],
            'cancel'=>['action','csrf','order'],
            'review_pending'=>['action','csrf','order','target'],
            'finish_pending'=>['action','csrf','order','target','point_id']
        ];
        if(!is_string($action)||!isset($spec[$action]))throw new DomainException('지원하지 않는 요청');
        $keys=array_keys($post);sort($keys);$allowed=$spec[$action];sort($allowed);
        if($keys!==$allowed)throw new DomainException('허용되지 않은 입력값');
        foreach($post as $v)if(!is_string($v))throw new DomainException('입력값 오류');
        if(in_array($action,['cart_set','cart_remove','purchase'],true)&&!preg_match('/^[1-9][0-9]{14}$/D',$cart))
            throw new DomainException('장바구니 세션 오류');
        if(isset($post['item'])&&!preg_match('/^[a-f0-9]{20}$/D',$post['item']))throw new DomainException('상품 코드 오류');
        if(isset($post['qty'])&&(!preg_match('/^[1-9][0-9]{0,9}$/D',$post['qty'])||(int)$post['qty']>2147483647))throw new DomainException('수량 오류');
        if(isset($post['request_id'])&&!preg_match('/^[a-f0-9]{32}$/D',$post['request_id']))throw new DomainException('요청 번호 오류');
        if(isset($post['order'])&&!preg_match('/^[1-9][0-9]{14}$/D',$post['order']))throw new DomainException('주문 번호 오류');
        if(in_array($action,['review_pending','finish_pending'],true)){
            if(($actor['super']??false)!==true||!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$post['target']))throw new DomainException('관리 권한 오류');
            if(isset($post['point_id'])&&(!preg_match('/^[1-9][0-9]{0,9}$/D',$post['point_id'])||(int)$post['point_id']>2147483647))throw new DomainException('거래 기록 번호 오류');
        }
        return ($this->dispatch)($action,$member,$cart,$post);
    }
}
