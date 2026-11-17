<?php
declare(strict_types=1);
/** N80 Lab owns AI operations; shared transport belongs to the Engine. */
require_once __DIR__.'/service-runtime.php';
// Keep existing callers on the same registry and dispatcher.
function n80_lab_service_operations():array{return n80_service_operations();}
function n80_lab_service_check(string $action,array $context):array{return n80_service_check($action,$context);}
function n80_lab_service_execute(string $action,array $body,array $context):array{return n80_service_execute($action,$body,$context);}
function n80_lab_host_service(string $action):array{return n80_host_service($action);}
function n80_lab_hub_execute(string $operation):array {
    $actions=['ai.text'=>'n80_text_tick'];
    if(!isset($actions[$operation]))throw new InvalidArgumentException('lab_operation_unsupported');
    return n80_host_service($actions[$operation]);
}
