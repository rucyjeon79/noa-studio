<?php
/** Compatibility entry only. The root index remains the single NOA app entry. */
declare(strict_types=1);
$query=http_build_query($_GET,'','&',PHP_QUERY_RFC3986);
header('Cache-Control: no-store');
header('Location: /'.($query!==''?'?'.$query:''),true,302);
exit;
