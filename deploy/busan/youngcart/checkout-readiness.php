<?php
declare(strict_types=1);
/* The live ledger is not yet transaction-safe. This guard cannot enable a
 * checkout by itself, even if all storage engines later become InnoDB. */
final class BusanCheckoutReadiness {
    public static function requireAtomicStorage(array $engines):void{
        foreach(['member','point','cart','item','order'] as $key)
            if(strtoupper((string)($engines[$key]??''))!=='INNODB')
                throw new DomainException('checkout blocked: '.$key.' is not transactional');
    }
    public static function liveCheckout():void{
        throw new DomainException('checkout disabled until shared ledger, cancellation and native route integration are verified');
    }
}
