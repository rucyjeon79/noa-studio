<?php
declare(strict_types=1);
/** Shared matching only. Callers retain their own visibility and media eligibility checks. */
function n80_search_text(string $value):string {
    $value=mb_strtolower(mb_convert_kana($value,'as','UTF-8'),'UTF-8');
    return trim((string)preg_replace('/\b(ep|act)[.\s-]*0*(\d+)/iu','$1$2',$value));
}
function n80_search_record(string $key,array $document):array {
    $body=$document['body']??[];
    $ep=(int)($document['ep']??0);
    return [
        'key'=>$key,
        'title'=>(string)(($body['confirmedTitle']??'')?:($document['title']??$key)),
        'genre'=>(string)($document['genreId']??$document['genre']??''),
        'ep'=>$ep,
        'act'=>(int)($document['act']??0)?:($ep>0?(int)ceil($ep/10):0),
        'language'=>(string)($document['language']??$body['language']??''),
        'version'=>(string)($document['version']??$body['version']??'')
    ];
}
function n80_search_matches(array $record,string $query):bool {
    $ep=(int)($record['ep']??0);
    $act=(int)($record['act']??0)?:($ep>0?(int)ceil($ep/10):0);
    $text=n80_search_text(implode(' ',[
        $record['title']??'', $record['genre']??'', $record['language']??'', $record['version']??'',
        $ep?'EP '.$ep:'', $act?'ACT '.$act:'', $record['key']??''
    ]));
    foreach(preg_split('/\s+/u',n80_search_text($query),-1,PREG_SPLIT_NO_EMPTY) as $term) {
        if(!str_contains($text,$term))return false;
    }
    return true;
}
