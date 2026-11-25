<?php
if(!defined('_GNUBOARD_')||!defined('BPZ_NATIVE_CATALOG_MEMBER'))exit;
// Only the native catalogue body is buffered; the original site header/footer are untouched.
$bpz_native_html=ob_get_clean();
echo preg_replace_callback('~>([^<>]*)<~u',static function($m){
    // Currency labels in visible stock-skin text, not global site text or attributes.
    return '>'.preg_replace('/(?<=\d)원(?=\s|$|[()])/u',' P',$m[1]).'<';
},$bpz_native_html);
?>
</div>
<?php require G5_PATH.'/theme/Busan_PointZone/shop/shop.tail.php'; ?>
