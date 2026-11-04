<?php
declare(strict_types=1);

/** Distinct lyric/title words per recording; repeating a chorus does not add evidence. */
function n80_genre_terms(array $song):array{
    $lyrics = mb_substr((string)($song['lyrics'] ?? ''),0,6000);
    $lyrics = preg_replace('/\[[^\]\n]{1,140}\]/u',' ',$lyrics) ?? $lyrics;
    $text = mb_strtolower(($song['title'] ?? '').' '.$lyrics);
    preg_match_all('/[\p{L}\p{M}]{2,40}/u',$text,$matches);
    return array_slice(array_unique($matches[0]),0,160);
}

/** Learn a binary word classifier for each mood from the current visible catalog.
 * Smoothed class-vs-rest word likelihoods extend explicit mood matches to similar
 * recordings. A genre name is never a training label. No remote model or stored profile is used.
 */
function n80_genre_model(array &$songs):void{
    $moods=['calm','focus','energy','comfort'];
    $documents=0;$frequency=[];$classSize=array_fill_keys($moods,0);$within=[];$seen=[];
    foreach ($songs as $song) {
        if (($song['kind'] ?? '')==='playlist' || !empty($song['video'])) continue;
        $identity=($song['browseIdentity'] ?? '') ?: (($song['canonicalRecordKey'] ?? '') ?: (($song['orderKey'] ?? '') ?: $song['key']));
        $labels=array_intersect($song['moodTags'] ?? [],$moods);
        if (!$labels || isset($seen[$identity])) continue;
        $terms=n80_genre_terms($song);
        if (!$terms) continue;
        $seen[$identity]=true;
        $documents++;
        foreach ($terms as $word) $frequency[$word]=1+($frequency[$word] ?? 0);
        foreach ($labels as $mood) {
            $classSize[$mood]++;
            foreach ($terms as $word) $within[$mood][$word]=1+($within[$mood][$word] ?? 0);
        }
    }
    $weights=[];
    foreach ($moods as $mood) {
        $positive=$classSize[$mood];$negative=$documents-$positive;
        if ($positive<2 || $negative<2) continue;
        $distinctive=[];
        foreach ($within[$mood] as $word=>$hits) {
            if ($hits<2) continue;
            $ratio=(($hits+1)/($positive+2))/(($frequency[$word]-$hits+1)/($negative+2));
            if ($ratio>=1.6) $distinctive[$word]=log($ratio);
        }
        arsort($distinctive);
        $weights[$mood]=array_slice($distinctive,0,128,true);
    }
    foreach ($songs as &$song) {
        if (($song['kind'] ?? '')==='playlist' || !empty($song['video'])) continue;
        $words=array_fill_keys(n80_genre_terms($song),true);
        foreach ($weights as $mood=>$vocabulary) {
            $matches=array_intersect_key($vocabulary,$words);
            if (count($matches)<2) continue;
            $strength=array_sum($matches);
            $song['moodAffinity'][$mood]=round($strength/($strength+4),3);
        }
    }
    unset($song);
}
