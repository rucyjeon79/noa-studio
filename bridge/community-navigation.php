<?php
/** Public community navigation; channel boards remain within their channels. */
function noa_community_board_visible(string $id,string $title=''):bool{
 return !in_array($id,['qa','qna','gallery','song_request'],true) && !preg_match('/gallery|qna|qa$|channel|ch_|채널|갤러리|질문.?답변/ui',$id.' '.$title) && $id!=='song_request';
}
function noa_community_board_title(string $id,string $title):string{
 return $id==='free'?'별무리 이야기':$title;
}
