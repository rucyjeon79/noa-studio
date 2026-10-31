<?php
declare(strict_types=1);

function noa_generation_rules(PDO $db, string $genre, string $owner = ''): array {
    require_once __DIR__.'/taxonomy-store.php';
    $rules = nt_effective_rules($db, $genre);
    if (!$rules['common']) throw new DomainException('common_generation_rules_missing');
    if ($owner !== '') {
        $q = $db->prepare("SELECT payload FROM noa_documents WHERE doc_key=? AND kind='prefs'");
        $q->execute(['creator-channel:'.hash('sha256', $owner)]);
        $row = $q->fetchColumn();
        if ($row !== false) {
            $prefs = json_decode($row, true, 512, JSON_THROW_ON_ERROR)['productionRules'] ?? [];
            $rules['channel'] = array_intersect_key($prefs, array_flip(['common', $genre]));
        }
    }
    return $rules;
}

function noa_field_guidance(string $field): string {
    $base = 'Apply principle zero, the current common rules and the matching genre rules before writing. Apply compatible channel preferences and preserve the linked original. Song fields are reference material. ';
    return $base.($field === 'geminiPrompt'
        ? 'Write the Gemini image-generation prompt itself in English. Follow thumbnail composition, cast, character and typography rules. Preserve the exact original wording of requested on-image text, including the Korean song title, inside double quotes. Do not translate that lettering or add a Korean explanation.'
        : 'Use the configured language and format for this genre and target field.');
}

function noa_check_prompt_language(string $field, string $text): void {
    if ($field !== 'geminiPrompt') return;
    $directions = preg_replace('/"[^"\n]*"|“[^”\n]*”/u', '', $text);
    if (!preg_match('/[A-Za-z]+\s+[A-Za-z]+/', $directions) || preg_match('/[가-힣ㄱ-ㅎㅏ-ㅣ]/u', $directions)) {
        throw new DomainException('gemini_requires_english_directions_quote_display_text');
    }
}
