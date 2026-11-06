<?php
declare(strict_types=1);
require_once __DIR__.'/n80-ai-output.php';

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

function noa_publish_targets(string $packageType): array {
    $genreFields = $packageType === 'ep' ? ['title'=>'title','lyrics'=>'lyrics'] : [];
    return $genreFields + ['geminiPrompt'=>'thumb','youtubeTitle'=>'ytTitle','description'=>'ytDesc','communityPost'=>'letter'];
}
