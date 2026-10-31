<?php
require __DIR__.'/../../bridge/community-navigation.php';
foreach(['gallery','qa','qna','channel','channel_12','song_request'] as $id)if(noa_community_board_visible($id))throw new Exception($id);
if(noa_community_board_visible('other','채널 게시판'))throw new Exception('channel title');
foreach(['free','notice','event'] as $id)if(!noa_community_board_visible($id))throw new Exception($id);
if(noa_community_board_title('free','자유게시판')!=='별무리 이야기')throw new Exception('title');
echo "COMMUNITY_NAVIGATION_POLICY_OK\n";
