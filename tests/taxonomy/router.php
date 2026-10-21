<?php
// CI fixture harness only. Never deployed; production always enforces GnuBoard auth.
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(str_starts_with($path,'/noa-app/taxonomy/')&&$path!=='/noa-app/taxonomy/')return false;
if($path!=='/noa-app/taxonomy/')return false;
$html=file_get_contents($root.'/deploy/noa-app/taxonomy/index.php');$html=substr($html,strpos($html,'?><!doctype html>')+2);$html=preg_replace('/<\?=.*?\?>/s','ci-csrf',$html);header('X-NOA-Test-Environment: isolated-fixture');echo $html;
