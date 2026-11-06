<?php
declare(strict_types=1);

/** Public presentation files only. Never include PHP, member data or media. */
function nha_allowed(): array {
    return explode(' ', 'noa-ui.css noa-brand.js noa-ui.js noa-browse.js noa-home.js noa-hero.js noa-community.css noa-community.js noa-listening.css noa-listening-model.js noa-listening.js noa-page-progress.js noa-voice.js noa-ainoa.css noa-ainoa.js noa-install.css noa-install.js noa-policy-20261024.css noa-starlight.css noa-member-surfaces.css noa-member-surfaces.js noa-referral.css noa-referral.js noa-notifications.css noa-notifications.js noa-engagement.css noa-engagement.js noa-support.css noa-support.js noa-ecosystem-links.js noa-amt-fan.css noa-amt-fan.js noa-member-badges.css noa-member-badges.js noa-account.css noa-account.js');
}

function nha_files(string $list): array {
    $files = explode(',', $list);
    if (!$list || count($files) > 36 || count(array_unique($files)) !== count($files)) return [];
    $kind = pathinfo($files[0], PATHINFO_EXTENSION);
    foreach ($files as $file) {
        if (!in_array($file, nha_allowed(), true) || pathinfo($file, PATHINFO_EXTENSION) !== $kind) return [];
    }
    return $files;
}

function nha_version(array $files, string $root): ?string {
    $parts = [];
    foreach ($files as $file) {
        if (!is_file($root.'/'.$file) || !is_readable($root.'/'.$file)) return null;
        $hash = hash_file('sha256', $root.'/'.$file);
        if (!$hash) return null;
        $parts[] = $file.':'.$hash;
    }
    return hash('sha256', implode("\n", $parts));
}

/** Keep source order, CSS cascade boundaries and non-deferred scripts intact. */
function nha_rewrite(string $html, string $root): string {
    if (!preg_match('~^\s*(?:<!doctype\s+html\b|<html\b)~i', $html) || stripos($html, '</head>') === false) return $html;
    $end = stripos($html, '</head>');
    $head = substr($html, 0, $end);
    preg_match_all('~<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>|<link\b[^>]*>~is', $head, $matches, PREG_OFFSET_CAPTURE);
    $groups = ['js'=>[], 'css'=>[]]; $replacements = [];
    $flush = static function(string $kind) use (&$groups, &$replacements, $root): void {
        $items = $groups[$kind]; $groups[$kind] = [];
        if (!$items) return;
        $files = array_column($items, 'file');
        if (count(array_unique($files)) !== count($files)) return;
        $version = nha_version($files, $root);
        if ($version === null) return;
        $url = '/noa-home-assets.php?files='.implode(',', $files).'&amp;v='.$version;
        $tag = $kind === 'js' ? '<script defer src="'.$url.'"></script>' : '<link rel="stylesheet" href="'.$url.'">';
        foreach ($items as $i=>$item) $replacements[] = [$item['offset'], $item['length'], $i === 0 ? $tag : ''];
    };
    foreach ($matches[0] as [$tag, $offset]) {
        $kind = strncasecmp($tag, '<script', 7) === 0 ? 'js' : 'css';
        if (strncasecmp($tag, '<style', 6) === 0) { $flush('css'); continue; }
        if ($kind === 'js' && preg_match('~^<script\b[^>]*\stype=["\']application/json["\']~i', $tag)) continue;
        $valid = $kind === 'js'
            ? preg_match('~^<script\s+(?:defer\s+src|src)=["\'](/noa-[a-z0-9-]+\.js)(?:\?[^"\']*)?["\']\s*(?:defer\s*)?></script\s*>$~i', $tag, $source) && preg_match('~\sdefer(?:\s|>)~i', $tag)
            : preg_match('~^<link\s+rel=["\']stylesheet["\']\s+href=["\'](/noa-[a-z0-9-]+\.css)(?:\?[^"\']*)?["\']\s*/?>$~i', $tag, $source);
        $file = $valid ? substr($source[1], 1) : '';
        if (!$valid || !in_array($file, nha_allowed(), true)) { $flush($kind); continue; }
        $groups[$kind][] = ['file'=>$file, 'offset'=>$offset, 'length'=>strlen($tag)];
    }
    $flush('js'); $flush('css');
    usort($replacements, static fn($a, $b)=>$b[0]<=>$a[0]);
    foreach ($replacements as [$offset, $length, $replacement]) $html = substr_replace($html, $replacement, $offset, $length);
    return $html;
}
