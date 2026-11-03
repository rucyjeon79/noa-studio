<?php
/** Render the actual login template in an isolated directory without database or OAuth calls. */
$root = dirname(__DIR__, 2);
$out = $root.'/login-proof/fixture';
@mkdir($out.'/noa-bridge', 0755, true);
foreach (['noa-login.php', 'noa-login.css', 'noa-account.css'] as $name) copy($root.'/deploy/'.$name, $out.'/'.$name);
copy($root.'/bridge/social-policy.php', $out.'/noa-bridge/social-policy.php');
file_put_contents($out.'/common.php', '<?php $config=getenv("NOA_LOGIN_DISABLED")?[]:["cf_google_clientid"=>"fixture","cf_google_secret"=>"fixture","cf_kakao_rest_key"=>"fixture","cf_kakao_client_secret"=>"fixture"]; $_GET["url"]="/noa-my.php?tab=gifts&from=login";');
foreach (['ready', 'disabled'] as $state) {
    $command = 'NOA_LOGIN_DISABLED='.($state==='disabled'?'1':'0').' '.escapeshellarg(PHP_BINARY).' '.escapeshellarg($out.'/noa-login.php');
    exec($command, $lines, $code);
    if ($code !== 0) throw new RuntimeException('login_render_failed');
    file_put_contents($out.'/'.$state.'.html', implode("\n", $lines));
    $lines = [];
}
echo "LOGIN_PRESENTATION_RENDERED\n";
