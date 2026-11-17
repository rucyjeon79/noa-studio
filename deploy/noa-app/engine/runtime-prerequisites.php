<?php
declare(strict_types=1);

/** Fixed metadata only, observed from this PHP request. Never launches a process,
 * reads credentials, changes activation, or certifies a browser/SSH environment. */
function n80_runtime_prerequisites():array {
    $started=hrtime(true);
    $checks=[
        'procDirectoryAccessible'=>@is_dir('/proc'),
        'procSelfExecutableAccessible'=>@is_readable('/proc/self/exe'),
        'procSelfStatusReadable'=>@is_readable('/proc/self/status'),
        'procOpenCallable'=>is_callable('proc_open'),
    ];
    $blocked=array_keys(array_filter($checks,static fn(bool $value):bool=>!$value));
    return [
        'mode'=>'read_only','scope'=>'current_php_request_metadata',
        'checkedAt'=>time(),'osFamily'=>PHP_OS_FAMILY,'sapi'=>PHP_SAPI,
        'checks'=>$checks,'unavailablePrerequisites'=>$blocked,
        'state'=>$blocked?'runtime_prerequisites_unavailable':'runtime_execution_not_verified',
        'phpExecutionLimitSeconds'=>(int)ini_get('max_execution_time'),
        'phpMemoryLimit'=>(string)ini_get('memory_limit'),
        'shellExecCallable'=>is_callable('shell_exec'),
        'hostingWorkloadApproved'=>false,'browserLaunchVerified'=>false,
        'codexExecutionVerified'=>false,'providerAuthorizationVerified'=>false,
        'productionReady'=>false,'sshEnvironmentInspected'=>false,
        'hostWrites'=>0,'processStarts'=>0,'providerCalls'=>0,
        'elapsedMs'=>round((hrtime(true)-$started)/1000000,3),
    ];
}
