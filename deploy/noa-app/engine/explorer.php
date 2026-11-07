<?php
declare(strict_types=1);

/** Each desk keeps its own selection and submits the original catalog key. */
function n80_explorer_picker(string $prefix, string $selectId, string $label, string $placeholder = '곡 선택', string $name = '', bool $required = false, string $notice = ''): void {
    $e = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?>
    <details id="<?=$e($prefix)?>-picker" class="n80-explorer" data-noa-local-disclosure>
        <summary>N80 탐색기<span data-n80-current></span></summary>
        <?php if ($notice !== ''): ?><p class="noa-muted"><?=$e($notice)?></p><?php endif; ?>
        <fieldset id="<?=$e($prefix)?>-picker-fields" class="lab-fields" disabled>
            <label>제목·장르·EP·ACT 검색<input id="<?=$e($prefix)?>-search" type="search" autocomplete="off" placeholder="예: Afterglow, EP.40, ACT 4"></label>
            <label><?=$e($label)?><select id="<?=$e($selectId)?>" <?=$name !== '' ? 'name="'.$e($name).'"' : ''?> <?=$required ? 'required' : ''?>><option value=""><?=$e($placeholder)?></option></select></label>
        </fieldset>
        <p id="<?=$e($prefix)?>-picker-state" class="noa-muted" role="status"></p>
        <button type="button" id="<?=$e($prefix)?>-reload" class="noa-button" hidden>목록 다시 불러오기</button>
    </details>
    <?php
}

function n80_explorer_assets(): void {
    $root = dirname(__DIR__, 2);
    ?>
    <link rel="stylesheet" href="/noa-explorer.css?v=<?=hash_file('sha256', $root.'/noa-explorer.css')?>">
    <script defer src="/noa-channel-explorer.js?v=<?=hash_file('sha256', $root.'/noa-channel-explorer.js')?>"></script>
    <?php
}
