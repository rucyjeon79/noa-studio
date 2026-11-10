<?php
declare(strict_types=1);
/** Compatibility entrypoint; N80 Lab owns and executes the single tool registry. */
require_once __DIR__.'/lab.php';
function n80_service_operations():array{return n80_lab_service_operations();}
function n80_service_check(string $action,array $context):array{return n80_lab_service_check($action,$context);}
function n80_service_execute(string $action,array $body,array $context):array{return n80_lab_service_execute($action,$body,$context);}
