<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }

function nld_views(): array {
    return ['new'=>'새 글','week'=>'주간 인기글','month'=>'월간 인기글','likes'=>'공감 많은 글','comments'=>'최근 댓글',
            'mine'=>'내 공개 글','replies'=>'내 공개 댓글'];
}
function nld_table(string $table): string {
    if (!preg_match('/^[A-Za-z0-9_]+$/D',$table)) throw new LogicException('invalid_table');
    return '`'.$table.'`';
}
function nld_fetch(PDO $db,string $sql,array $args=[]): array {
    $stmt=$db->prepare($sql);$stmt->execute($args);return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
function nld_plain(string $value): string {
    $value=preg_replace('~<(script|style)\b[^>]*>.*?</\1>~is',' ',$value)??'';
    return trim(preg_replace('/\s+/u',' ',html_entity_decode(strip_tags($value),ENT_QUOTES|ENT_HTML5,'UTF-8'))??'');
}
/** Public discovery is the same for administrators, members and guests. Personal filters only narrow it. */
function nld_read(PDO $db,array $g5,string $view,string $viewer,int $now): array {
    if (!isset(nld_views()[$view])) throw new InvalidArgumentException('unknown_view');
    $own=in_array($view,['mine','replies'],true);
    if ($own && $viewer==='') throw new DomainException('login_required');
    $comment=in_array($view,['comments','replies'],true);
    $days=['week'=>7,'month'=>30][$view]??0;
    $ranking=$days>0||$view==='likes';
    $order=$ranking?'score DESC, stamp DESC, item_key DESC':'stamp DESC, item_key DESC';
    $cutoff=$now-$days*86400;
    $engaged=$days?' HAVING score>0':'';
    $json=static fn(string $alias,string $field):string=>"JSON_UNQUOTE(JSON_EXTRACT($alias.payload,'$.$field'))";
    $field=static fn(string $name):string=>$json('p',$name);
    $public=static fn(string $alias):string=>$json($alias,'visibility')."='public' AND COALESCE(".$json($alias,'deleted').",'false')<>'true'";
    $likes="COALESCE(CAST(".$field('likes')." AS UNSIGNED),0)";
    $parent="p.kind='ecosystem_post' AND ".$field('space')."='lounge' AND ".$public('p').
        " AND (COALESCE(".$field('vipOnly').",'false')<>'true' OR CAST(".$field('releaseAt')." AS UNSIGNED) BETWEEN 1 AND ?)";
    $link="CONCAT('ecosystem:post:',".$json('c','post').")=p.doc_key";
    $commentAcl="c.kind='ecosystem_comment' AND ".$public('c');
    $stamp="CAST(".$json($comment?'c':'p','at')." AS UNSIGNED)";
    $score='0';
    if ($view==='likes') $score=$likes;
    if ($days) $score="$likes*2+(SELECT COUNT(*) FROM noa_documents c WHERE $commentAcl AND $link)";
    $args=[$now];$where=$parent;
    if ($days) {$where.=" AND $stamp BETWEEN ? AND ?";array_push($args,$cutoff,$now);}
    if ($view==='likes') $where.=" AND $likes>0";
    if ($own) {$where.=' AND '.$json($comment?'c':'p','owner').'=?';$args[]=$viewer;}
    $from='noa_documents p'.($comment?" JOIN noa_documents c ON $link AND $commentAcl":'');
    $excerpt=$comment?$json('c','body'):"''";
    $id=$comment?'c.doc_key':'p.doc_key';
    $rows=nld_fetch($db,"SELECT $id item_key,".$field('id')." post_id,".$field('title')." title,$excerpt excerpt,$stamp stamp,$score score,
        '라운지' board_name,'' board FROM $from WHERE $where $engaged ORDER BY $order LIMIT 10",$args);

    // Only public, free-to-read local boards. Song requests, channel boards and certified/member boards are outside this projection.
    $boards=nld_fetch($db,'SELECT b.bo_table FROM '.nld_table($g5['board_table']).' b JOIN '.nld_table($g5['group_table']).
        " g ON g.gr_id=b.gr_id WHERE b.bo_table IN ('free','notice') AND b.bo_list_level<=1 AND b.bo_read_level<=1
        AND b.bo_read_point>=0 AND b.bo_use_secret<>2 AND COALESCE(b.bo_use_cert,'')='' AND g.gr_use_access=0");
    $seoul=new DateTimeZone('Asia/Seoul');
    $kst=static fn(int $t):string=>(new DateTimeImmutable('@'.$t))->setTimezone($seoul)->format('Y-m-d H:i:s');
    foreach ($boards as $boardRow) {
        $board=$boardRow['bo_table'];$table=nld_table($g5['write_prefix'].$board);
        $where="p.wr_is_comment=0 AND p.wr_reply='' AND FIND_IN_SET('secret',p.wr_option)=0";
        $relation="c.wr_parent=p.wr_id AND c.wr_is_comment=1 AND FIND_IN_SET('secret',c.wr_option)=0";
        $from="$table p".($comment?" JOIN $table c ON $relation":'');
        $alias=$comment?'c':'p';$excerpt=$comment?'c.wr_content':"''";
        $like='COALESCE(p.wr_good,0)';$score='0';
        if ($view==='likes') {$score=$like;$where.=" AND $like>0";}
        if ($days) $score="$like*2+(SELECT COUNT(*) FROM $table c WHERE $relation)";
        $args=[$board.':',$board==='free'?'별무리 이야기':'공지사항',$board];
        if ($days) {$where.=" AND p.wr_datetime BETWEEN ? AND ?";array_push($args,$kst($cutoff),$kst($now));}
        if ($own) {$where.=" AND $alias.mb_id=?";$args[]=$viewer;}
        $native=nld_fetch($db,"SELECT CONCAT(?, $alias.wr_id) item_key,p.wr_id post_id,p.wr_subject title,$excerpt excerpt,
            TIMESTAMPDIFF(SECOND,'1970-01-01 09:00:00',$alias.wr_datetime) stamp,$score score,? board_name,? board FROM $from WHERE $where $engaged ORDER BY $order LIMIT 10",$args);
        array_push($rows,...$native);
    }
    usort($rows,static fn($a,$b)=>($ranking?((int)$b['score']<=>(int)$a['score']):0) ?: ((int)$b['stamp']<=>(int)$a['stamp']) ?: strcmp($b['item_key'],$a['item_key']));
    return array_slice($rows,0,10);
}
function nld_destination(array $row): string {
    $id=(string)$row['post_id'];
    if ($row['board']==='') return '/noa-lounge.php?post='.rawurlencode($id).'#ec-content';
    $board=$row['board'];
    return '/noa-lounge.php?board='.rawurlencode($board).'&nativePost='.(int)$id.'#noa-'.$board.'-'.(int)$id;
}
