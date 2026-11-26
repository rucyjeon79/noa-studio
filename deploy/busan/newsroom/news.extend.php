<?php
if (!defined('_GNUBOARD_') || (defined('G5_IS_ADMIN') && G5_IS_ADMIN)) return;

function busan_news_sections(){
    return ['busan_news_company'=>'회사·그룹 소식','busan_news_union'=>'노동조합 소식','busan_news_law'=>'노동법·판례','busan_news_world'=>'세계 노동 동향'];
}
function busan_news_is_board($id){
    return $id==='busan_news'||$id==='note'||isset(busan_news_sections()[$id]);
}
function busan_news_split_active(){
    global $g5;
    $b=sql_fetch("SELECT bo_10 FROM {$g5['board_table']} WHERE bo_table='busan_news'",false);
    return ($b['bo_10']??'')==='busan-reporter-archive-v2';
}
// Old shared article links remain valid, while the main menu opens the hub.
function busan_news_legacy_redirect(){
    global $bo_table,$wr_id,$g5;
    if($bo_table!=='busan_news'||basename($_SERVER['SCRIPT_NAME']??'')!=='board.php'
        ||!in_array($_SERVER['REQUEST_METHOD']??'',['GET','HEAD'],true)||!busan_news_split_active())return;
    $id=(int)$wr_id;
    if($id>0)foreach(busan_news_sections() as $target=>$title){
        $t=$g5['write_prefix'].$target;
        $row=sql_fetch("SELECT wr_id FROM `$t` WHERE wr_id=$id AND wr_is_comment=0",false);
        if(!empty($row['wr_id'])){header('Location: '.G5_BBS_URL.'/board.php?bo_table='.$target.'&wr_id='.$id,true,302);exit;}
    }
    header('Location: '.G5_URL.'/busan-assistant/newsroom/index.php',true,302);exit;
}
busan_news_legacy_redirect();

// Replace only the reporter's native member popup, never the chair's ordinary profile.
function busan_news_reporter_sideview($items,$context){
    if(!busan_news_is_board($context['bo_table']??'')||trim(strip_tags($context['name']??''))!=='챗지기자')return $items;
    return ['name_tag_open'=>'<span class="bn-reporter" title="부산지부 AI 기자 · ChatGPT 활용">',
        'name_tag_close'=>'</span>',
        'name_tag'=>['<span class="bn-reporter-avatar"><img src="'.htmlspecialchars(G5_URL.'/busan-assistant/newsroom/reporter-logo.svg',ENT_QUOTES,'UTF-8').'" alt="ChatGPT" width="28" height="28"></span><span>챗지기자</span>'],
        'menus'=>[]];
}
add_replace('member_sideview_items','busan_news_reporter_sideview',99,2);

// Mark only this request as viewed before the native counter runs. Restore the
// original session value before rendering so a later ordinary visit still counts.
function busan_news_exclude_check_view() {
    global $bo_table, $wr_id, $board;
    if (($_SERVER['HTTP_X_BUSAN_NEWS_CHECK'] ?? '') !== '1'
        || basename($_SERVER['SCRIPT_NAME'] ?? '') !== 'board.php'
        || !busan_news_is_board($bo_table) || (int)$wr_id <= 0
        || !isset($board['bo_read_point']) || (int)$board['bo_read_point'] !== 0) return;

    // The native viewed-session guard also wraps reading points. Fail closed if
    // this free newsroom ever starts charging or awarding points for reading.
    $key = 'ss_view_'.$bo_table.'_'.$wr_id;
    $existed = array_key_exists($key, $_SESSION);
    $previous = $_SESSION[$key] ?? null;
    $restored = false;
    $restore = static function () use ($key, $existed, $previous, &$restored) {
        if ($restored) return;
        $restored = true;
        if ($existed) $_SESSION[$key] = $previous;
        else unset($_SESSION[$key]);
    };
    $restore_header = static function ($header) use ($restore) {
        $restore();
        return $header;
    };
    set_session($key, true);
    add_replace('board_content_head', $restore_header, 1, 1);
    add_replace('board_mobile_content_head', $restore_header, 1, 1);
    register_shutdown_function($restore); // Also restore on redirects or errors.
    header('X-Busan-News-View: excluded');
    header('Cache-Control: private, no-store');
}
busan_news_exclude_check_view();

function busan_news_home_strip() {
    if (!defined('_INDEX_') || !_INDEX_) return;
    $root = G5_URL . '/busan-assistant/newsroom';
    $board_url = G5_BBS_URL . '/board.php?bo_table=busan_news';
    ?>
    <template id="bn-news-template">
      <section id="bn-news-strip" aria-label="최근 한 달 뉴스" data-feed="<?=htmlspecialchars($root.'/recent.php', ENT_QUOTES)?>">
        <div class="bn-news-window"><div class="bn-news-track"><a class="bn-news-link" href="<?=htmlspecialchars($board_url, ENT_QUOTES)?>">최근 한 달 뉴스 보기</a></div></div>
        <button type="button" class="bn-news-pause" aria-label="뉴스 흐름 일시정지" title="뉴스 흐름 일시정지" hidden>Ⅱ</button>
        <a class="bn-news-all" href="<?=htmlspecialchars($board_url, ENT_QUOTES)?>" aria-label="뉴스 전체보기">전체보기</a>
      </section>
    </template>
    <script src="<?=htmlspecialchars($root.'/ticker.js?v=4', ENT_QUOTES)?>" defer></script>
    <?php
}

// Both native board headers run before get_view() prepares the public article.
function busan_news_prepare_source_card($header, $board) {
    global $write;
    if (!busan_news_is_board($board['bo_table'] ?? '') || empty($write['wr_3'])) return $header;
    $url = $write['wr_link1'] ?? '';
    if (!filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https'
        || !hash_equals($write['wr_3'], hash('sha256', $url))) return $header;

    // Match only the citation generated by our publisher and preserve the article text.
    $body = $write['wr_content'];
    $pattern = '~<p><strong>출처</strong> · ([^<]+?) · ([0-9]{4}-[0-9]{2}-[0-9]{2}) &nbsp; <a href="([^"]+)" target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a></p>\s*$~u';
    if (!preg_match($pattern, $body, $source, PREG_OFFSET_CAPTURE)
        || html_entity_decode($source[3][0], ENT_QUOTES, 'UTF-8') !== $url) return $header;

    $escape = static function ($text) { return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); };
    $publisher = html_entity_decode($source[1][0], ENT_QUOTES, 'UTF-8');
    $card = '<a class="bn-source-card" href="'.$escape($url).'" target="_blank" rel="noopener noreferrer">'
        .'<span class="bn-source-meta">'.$escape($publisher).' · '.$escape($source[2][0]).'</span>'
        .'<strong class="bn-source-title">'.$escape($write['wr_subject']).'</strong>'
        .'<span class="bn-source-host">기사 원문 · '.$escape(parse_url($url, PHP_URL_HOST)).'</span></a>';
    $write['wr_content'] = substr($body, 0, $source[0][1]).$card;
    $write['wr_link1'] = ''; // The card already links to this source in the current view.
    return $header;
}

add_replace('board_content_head', 'busan_news_prepare_source_card', 10, 2);
add_replace('board_mobile_content_head', 'busan_news_prepare_source_card', 10, 2);

// Presentation only: preserve the stored article, ID, author and reward ledger.
// Only our signed-format, plain-paragraph rights notes are transformed.
// Select a local explanatory illustration from the actual card's topic.
function busan_rights_visual_key($title,$body,$kind){
    $rules=[
      'evacuate'=>'대피|안전한 장소|이동시켜|안전 확보|긴급.*신고',
      'pay'=>'성과급|상여금|급여|임금|수당|통상임금|최저임금|지급.?비율|퇴직금|정산',
      'time'=>'근로시간|연장근무|초과근무|퇴근|출근|당직|휴게|휴식|야간|근무시간',
      'leave'=>'연차|휴가|휴직|병가',
      'injury'=>'산재|재해|부상|치료|요양|보상|사고',
      'safety'=>'작업중지|위험|안전|사다리|감전|보호구|전기설비|추락',
      'record'=>'기록|증거|메신저|보고|문서|자료|사진|개인정보',
      'union'=>'노동조합|노조|조합원|단체교섭|단결|조직부장|조합 활동|부당노동행위',
      'contract'=>'해고|징계|인사|계약|전보|평가|권고사직',
      'law'=>'법률|법령|판례|법적|근로기준법|산업안전보건법|처벌',
      'check'=>'체크리스트|점검|확인할 것|확인 사항|유의사항|대응 방법|조치'
    ];
    $clean=static function($s){return html_entity_decode(strip_tags($s),ENT_QUOTES,'UTF-8');};
    foreach([$clean($title),$clean($body)] as $text){
        foreach($rules as $key=>$pattern)if(preg_match('/'.$pattern.'/u',$text))return $key;
    }
    if(strpos($kind,'example')!==false)return 'example';
    if(strpos($kind,'check')!==false)return 'check';
    if(strpos($kind,'answer')!==false)return 'answer';
    if(strpos($kind,'question')!==false||strpos($kind,'topic-qa')!==false)return 'question';
    return 'guide';
}
function busan_rights_add_visuals($html){
    // These two renderers emit non-nested card containers. Only the generated
    // opening classes are augmented; neither the source text nor DB is changed.
    $pattern='~<div class="(bn-rights-(?:section-card|topic) bn-rights-[a-z-]+)">(.*?)</div>~su';
    $hasCards=preg_match('~<div class="bn-rights-topic bn-rights-topic-(?:qa|heading)"~',$html);
    $out=preg_replace_callback($pattern,static function($m)use($hasCards){
        if($hasCards&&strpos($m[1],'topic-intro')!==false)return $m[0];
        $title=preg_match('~<h3\b[^>]*>(.*?)</h3>~su',$m[2],$h)?$h[1]:'';
        $key=busan_rights_visual_key($title,$m[2],$m[1]);
        return '<div class="'.$m[1].' bn-rights-visual bn-rights-visual-'.$key.'">'.$m[2].'</div>';
    },$html);
    return is_string($out)?$out:$html;
}

function busan_rights_format_body($html){
    if(!is_string($html)||!preg_match('~^(?:<p>[^<]*</p>\s*){6}$~uD',$html))return $html;
    preg_match_all('~<p>([^<]*)</p>~u',$html,$m);
    $p=$m[1];
    if(count($p)!==6||strpos($p[0],'Q. ')!==0||strpos($p[1],'A. ')!==0
        ||strpos($p[5],'작성: 챗지기자')!==0)return $html;
    $example=0;
    foreach([2,3,4] as $i)if(strpos($p[$i],'예시: ')===0){if($example)return $html;$example=$i;}
    if(!$example)return $html;
    $items=static function($text){
        $parts=preg_split('/(?<=[.!?])\s+/u',trim($text),-1,PREG_SPLIT_NO_EMPTY);
        $out='<ul class="bn-rights-list">';
        foreach($parts as $part)$out.='<li>'.$part.'</li>';
        return $out.'</ul>';
    };
    $section=static function($kind,$label,$content){
        return '<div class="bn-rights-section-card bn-rights-'.$kind.'"><h3>'.$label.'</h3>'.$content.'</div>';
    };
    $out='<div class="bn-rights-guide"><div class="bn-rights-kicker">현장 권리노트 · 실무 가이드</div>';
    $out.=$section('question','Q. 이런 상황이라면?','<p>'.substr($p[0],3).'</p>');
    $out.=$section('answer','A. 핵심 답변','<p>'.substr($p[1],3).'</p>');
    $check=[];$follow=[];
    foreach([2,3,4] as $i){
        if($i===$example)continue;
        if($i<$example)$check[]=$p[$i];else $follow[]=$p[$i];
    }
    if($check)$out.=$section('check','현장에서 확인할 것',$items(implode(' ',$check)));
    $steps=explode(' / ',substr($p[$example],strlen('예시: ')));
    $exampleHtml='<ol class="bn-rights-steps">';
    foreach($steps as $step)$exampleHtml.='<li>'.$step.'</li>';
    $out.=$section('example','실제 상황 예시',$exampleHtml.'</ol>');
    if($follow)$out.=$section('check','기록·상담 시 유의사항',$items(implode(' ',$follow)));
    $out.='<div class="bn-rights-disclaimer"><p>'.$p[5].'</p></div></div>';
    return busan_rights_add_visuals($out);
}
// Format the original plain text before Gnuboard adds BR tags and theme wrappers.
// No database write; actual native article permission checks remain in effect.
function busan_rights_question_line($line){
    return preg_match('/^\s*(?:Q\s*(?:[0-9０-９]+\s*)?[.．:：)）]|질문\s*(?:[0-9]+\s*)?[.．:：)）]|문\s*[:：])/iu',$line)===1;
}
function busan_rights_plain_body($raw){
    if(!is_string($raw)||!trim($raw)||$raw!==strip_tags($raw))return $raw;
    $lines=preg_split('/\R/u',$raw);
    if(!is_array($lines))return $raw;
    $out='<div class="bn-rights-guide bn-rights-legacy bn-rights-compact-text">';
    $kind='';$list=false;$pending=[];
    $esc=static function($s){
        $text=htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
        return function_exists('url_auto_link')?url_auto_link($text):$text;
    };
    $endlist=static function()use(&$out,&$list){if($list){$out.='</ul>';$list=false;}};
    $flush=static function()use(&$out,&$pending,$esc){
        if(!$pending)return;
        $out.='<p>'.$esc(implode(' ',$pending)).'</p>';$pending=[];
    };
    $start=static function($type,$title='')use(&$out,&$kind,$endlist,$esc,$flush){
        $flush();$endlist();if($kind!=='')$out.='</div>';
        $kind=$type;$out.='<div class="bn-rights-topic bn-rights-topic-'.$type.'">';
        if($title!=='')$out.='<h3 class="bn-rights-topic-title">'.$esc($title).'</h3>';
    };
    foreach($lines as $line){
        $line=trim($line);
        if($line===''||preg_match('/^[\s\x{00A0}]+$/u',$line))continue;
        $question=busan_rights_question_line($line);
        // Do not turn numbered payment rates or answers into standalone boxes.
        $heading=preg_match('/^(?:■|◆|▶|【)/u',$line)&&mb_strlen($line)<=85;
        if($question){$start('qa',$line);continue;}
        if($heading){$start('heading',$line);continue;}
        if($kind==='')$start('intro');
        if(preg_match('/^(?:[-–—•ㆍ·▪✓✔]\s*|☞\s*)/u',$line)){
            $flush();if(!$list){$out.='<ul class="bn-rights-compact-list">';$list=true;}
            $out.='<li>'.$esc($line).'</li>';continue;
        }
        $endlist();
        $class=preg_match('/^(?:A\s*[.:：]|답변\s*[:：]|답\s*[:：])/iu',$line)?'bn-rights-compact-answer':
          (preg_match('/^(?:예시|사례|현장 사례)\s*[:：]/u',$line)?'bn-rights-compact-example':'');
        if($class!==''){$flush();$out.='<p class="'.$class.'">'.$esc($line).'</p>';continue;}
        // Rejoin short fragments into readable sentences, but retain distinct
        // rate entries and explicit short directives as separate compact lines.
        if($pending && (preg_match('/(?:금지|필수|%|원|시간|일)$/u',end($pending))||mb_strlen(implode(' ',$pending))>170))$flush();
        $pending[]=$line;
        if(preg_match('/[.!?。！？]$/u',$line)||preg_match('/(?:금지|필수|%)$/u',$line))$flush();
    }
    $flush();$endlist();
    if($kind==='')return $raw;
    $out.='</div></div>';
    return busan_rights_add_visuals($out);
}
function busan_rights_prepare_body($header,$board){
    global $write;
    if(($board['bo_table']??'')!=='note'||empty($write['wr_content'])||!empty($write['wr_is_comment'])
        ||strpos($write['wr_option']??'','secret')!==false)return $header;
    $raw=$write['wr_content'];
    if(($write['wr_6']??'')==='bn-rights-note-v1'&&($write['wr_name']??'')==='챗지기자'){
        $formatted=busan_rights_format_body($raw);
    }elseif(!preg_match('/(?:^|,)html[12](?:,|$)/', $write['wr_option']??'') || $raw===strip_tags($raw)){
        $formatted=busan_rights_plain_body($raw);
    }else return $header;
    if($formatted!==$raw){
        $write['wr_content']=$formatted;
        $options=array_filter(explode(',',(string)($write['wr_option']??'')),static function($v){return $v!==''&&!in_array($v,['html1','html2'],true);});
        $options[]='html1';
        $write['wr_option']=implode(',',$options);
    }
    return $header;
}
add_replace('board_content_head','busan_rights_prepare_body',11,2);
add_replace('board_mobile_content_head','busan_rights_prepare_body',11,2);

add_stylesheet('<link rel="stylesheet" href="'.G5_URL.'/busan-assistant/newsroom/news.css?v=16">', 115);
add_event('tail_sub', 'busan_news_home_strip');

// Sharing is a common board feature, not limited to the newsroom.
function busan_board_share_eligible($table,$id,$row,$board){
    return is_string($table) && preg_match('/^[A-Za-z0-9_]{1,20}$/D',$table)
        && ($board['bo_table']??'')===$table && (int)$id>0
        && (int)($row['wr_id']??0)===(int)$id && empty($row['wr_is_comment'])
        && strpos($row['wr_option']??'','secret')===false;
}
function busan_news_article_share() {
    global $bo_table, $wr_id, $write, $board;
    if (basename($_SERVER['SCRIPT_NAME'] ?? '') !== 'board.php'
        || !busan_board_share_eligible($bo_table??'', $wr_id??0, $write??[], $board??[])) return;
    $label=busan_news_is_board($bo_table)?'기사 공유':'게시글 공유';
    $escape = static function ($text) { return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); };
    $title = html_entity_decode(strip_tags($write['wr_subject'] ?? ''), ENT_QUOTES, 'UTF-8');
    $url = G5_BBS_URL.'/board.php?bo_table='.$bo_table.'&wr_id='.(int)$wr_id;
    ?>
    <template id="bn-share-template">
      <button type="button" class="button bg-wh shadowline-de round-s bxicon color-gray-800 sBtn bn-article-share"
        aria-label="<?=$escape($label)?>" title="<?=$escape($label)?>" data-kind="<?=busan_news_is_board($bo_table)?'article':'post'?>" data-title="<?=$escape($title)?>" data-url="<?=$escape($url)?>">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
      </button>
      <span id="bn-share-feedback" class="bn-share-feedback" role="status" aria-live="polite" aria-atomic="true" hidden></span>
    </template>
    <script src="<?=$escape(G5_URL.'/busan-assistant/newsroom/share.js?v=3')?>" defer></script>
    <?php
}
add_event('tail_sub', 'busan_news_article_share');


function busan_news_reporter_assets(){
    global $bo_table,$wr_id,$write,$board,$g5;
    if(!busan_news_is_board($bo_table??''))return;
    $esc=static function($s){return htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');};
    if(basename($_SERVER['SCRIPT_NAME']??'')==='board.php'
        && busan_board_share_eligible($bo_table,$wr_id??0,$write??[],$board??[])
        && ($write['wr_name']??'')==='챗지기자'
        && preg_match('/^[a-f0-9]{64}$/D',$write['wr_3']??'')
        && preg_match('/^[a-f0-9]{64}$/D',$write['wr_4']??'')){
        $table=$g5['write_prefix'].$bo_table;
        $record=sql_fetch("SELECT wr_datetime,wr_hit,wr_comment,ca_name FROM `$table` WHERE wr_id=".(int)$wr_id." AND wr_is_comment=0",false);
        if(!empty($record['wr_datetime'])){
            $timestamp=strtotime($record['wr_datetime']);
            $category=!empty($board['bo_use_category'])?trim($record['ca_name']??''):'';
            $categoryUrl=G5_BBS_URL.'/board.php?bo_table='.$bo_table.'&sca='.rawurlencode($category);
            ?>
            <template id="bn-reporter-compact-template">
              <img class="bn-theme-avatar" src="<?=$esc(G5_URL.'/busan-assistant/newsroom/reporter-logo.svg')?>" alt="ChatGPT" width="48" height="48">
              <div class="bn-reporter-info">
                <span class="bn-reporter" data-bn-fixed="1" title="부산지부 AI 기자 · ChatGPT 활용">챗지기자</span>
                <div class="bn-reporter-meta">
                  <time datetime="<?=$esc(date('c',$timestamp))?>"><?=$esc(date('y-m-d H:i',$timestamp))?></time>
                  <span aria-label="댓글 <?=(int)$record['wr_comment']?>개"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 3-2z"/><path d="M8 11h.01M16 11h.01"/></svg><?=number_format((int)$record['wr_comment'])?>개</span>
                  <span aria-label="조회 <?=(int)$record['wr_hit']?>회"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><?=number_format((int)$record['wr_hit'])?>회</span>
                </div>
                <?php if($category!==''):?>
                <a class="bn-reporter-category" href="<?=$esc($categoryUrl)?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13l-7 7L3 10V3h7z"/><circle cx="7.5" cy="7.5" r="1"/></svg><?=$esc($category)?></a>
                <?php endif;?>
              </div>
              <div class="bn-reporter-actions"></div>
            </template>
            <?php
        }
    }
    if($bo_table==='note'&&basename($_SERVER['SCRIPT_NAME']??'')==='board.php'&&(int)$wr_id>0){
        echo '<template id="bn-rights-reading-marker"></template>';
        echo '<script src="'.$esc(G5_URL.'/busan-assistant/newsroom/rights-reader.js?v=3').'" defer></script>';
    }
    echo '<script src="'.$esc(G5_URL.'/busan-assistant/newsroom/reporter.js?v=6').'" defer></script>';
}
add_event('tail_sub','busan_news_reporter_assets');
