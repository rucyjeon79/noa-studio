<?php
declare(strict_types=1);
// Read model only. ACT membership comes from saved relations, never title guesses.
function nw_public(array $row): bool {
    return !empty($row['public_verified']) && empty($row['owner_id']);
}
function nw_video(array $v): bool {
    return ($v['classification']??'')==='official_mv'
        && ($v['status']['privacyStatus']??'')==='public'
        && !empty($v['status']['embeddable'])
        && ($v['snippet']['channelId']??'')==='UCwYy9xsAqDFat6AV5UKrfgA';
}
function nw_text(array $fields,string $key): string {
    return is_string($fields[$key]??null)?trim($fields[$key]):'';
}
