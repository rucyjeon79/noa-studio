<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/performance.php';
$event=['id'=>'perf-1','type'=>'audio.ready','source'=>'jukebox','subjectId'=>'track-1','occurredAt'=>'2026-10-23T00:00:00Z','schemaVersion'=>1,'correlationId'=>'perf-1'];
$r=n80_benchmark_event($event,20);
if($r['productionLatencyMeasured']!==false||count($r['metrics'])!==4)exit(1);
foreach($r['metrics'] as $m)if($m['p95_ms']<$m['p50_ms']||$m['samples']!==20)exit(2);
echo "N80_PERFORMANCE_BENCHMARK_OK\n";
