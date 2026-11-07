<?php
require __DIR__.'/../../bridge/explorer-search.php';
function check(bool $condition):void{if(!$condition)throw new RuntimeException('search regression');}
$row=n80_search_record('single:a',['title'=>'원곡 제목','body'=>['confirmedTitle'=>'같은 제목'],'genreId'=>'groovy-airy-pop','ep'=>'40']);
check($row['title']==='같은 제목'&&$row['act']===4);
foreach(['EP040 ACT.04 groovy','같은 제목','ＥＰ．４０','single:a'] as $query)check(n80_search_matches($row,$query));
check(!n80_search_matches($row,'EP39'));check(!n80_search_matches($row,'같은 없는'));
echo "N80_SERVER_SEARCH_OK\n";
