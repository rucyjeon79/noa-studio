<?php
if(!defined('_GNUBOARD_'))exit;
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&!empty($is_member)&&($is_admin??'')==='super'&&($member['mb_id']??'')===($config['cf_admin']??'')&&preg_match('~^/(?:adm/|noa-(?:library|theme-admin|catalog-admin|ai-lab|youtube-admin)[.]php)~',parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??''))
 ob_start(static function($html){return str_replace('</body>','<script src="/noa-app/taxonomy/admin-link.js?v=1" defer></script></body>',$html);});
