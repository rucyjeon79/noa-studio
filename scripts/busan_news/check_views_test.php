<?php
// Exercise the extension against the native session contract, without site data.
define('_GNUBOARD_', true);
define('G5_URL', 'https://example.test');
$bo_table = '';
$wr_id = 0;
$board = [];
$_SESSION = [];
$hooks = [];
function add_replace($name, $callback, $priority = 10, $arguments = 1) {
    global $hooks;
    $hooks[$name][$priority][] = $callback;
}
function add_stylesheet($html, $priority) {}
function add_event($name, $callback) {}
function set_session($name, $value) { $_SESSION[$name] = $value; }
function ensure($ok, $message) {
    if (!$ok) throw new RuntimeException($message);
}
require dirname(__DIR__, 2).'/deploy/busan/newsroom/news.extend.php';

$key = 'ss_view_busan_news_17';
$cases = [
    ['ordinary', '', 'busan_news', 0, [], false],
    ['diagnostic', '1', 'busan_news', 0, [], true],
    ['already_read', '1', 'busan_news', 0, [$key => true], true],
    ['false_marker', '1', 'busan_news', 0, [$key => false], true],
    ['null_marker', '1', 'busan_news', 0, [$key => null], true],
    ['other_board', '1', 'notice', 0, [], false],
    ['paid_reading', '1', 'busan_news', -10, [], false],
    ['awarded_reading', '1', 'busan_news', 10, [], false],
    ['unknown_points', '1', 'busan_news', null, [], false],
    ['wrong_marker', 'true', 'busan_news', 0, [], false],
];
foreach ($cases as [$name, $marker, $bo_table, $points, $initial, $exclude]) {
    foreach (['board_content_head', 'board_mobile_content_head'] as $head) {
        $wr_id = 17;
        $board = ['bo_read_point' => $points];
        $_SESSION = $initial + ['unrelated' => 'retained'];
        $expected = $_SESSION;
        $_SERVER['SCRIPT_NAME'] = '/bbs/board.php';
        $_SERVER['HTTP_X_BUSAN_NEWS_CHECK'] = $marker;
        $hooks = [];
        busan_news_exclude_check_view();
        if (!$exclude) {
            ensure($_SESSION === $expected, $name.' altered an ordinary request');
            continue;
        }
        ensure($_SESSION[$key] === true, $name.' did not suppress the native view guard');
        $callback = $hooks[$head][1][0];
        ensure($callback('original header') === 'original header', 'changed rendered content');
        ensure($_SESSION === $expected, $name.' changed later ordinary visit eligibility');
        $callback('original header');
        ensure($_SESSION === $expected, 'restore is not idempotent');
    }
}
// A redirect or failed render must also restore the session on shutdown.
$bo_table = 'busan_news';
$board = ['bo_read_point' => 0];
$_SERVER['HTTP_X_BUSAN_NEWS_CHECK'] = '1';
$_SESSION = ['unrelated' => 'retained'];
busan_news_exclude_check_view();
ensure($_SESSION[$key] === true, 'shutdown fixture did not enter exclusion');
register_shutdown_function(static function () {
    ensure($_SESSION === ['unrelated' => 'retained'], 'early exit polluted the reader session');
    echo "PASS diagnostic view exclusion, ordinary reading, points and session restoration\n";
});

$public=['wr_id'=>18,'wr_is_comment'=>0,'wr_option'=>'html1'];
ensure(busan_board_share_eligible('notice',18,$public,['bo_table'=>'notice']),'ordinary board share missing');
ensure(busan_board_share_eligible('busan_news_company',18,$public,['bo_table'=>'busan_news_company']),'news share missing');
ensure(!busan_board_share_eligible('notice',18,array_replace($public,['wr_option'=>'html1,secret']),['bo_table'=>'notice']),'secret share must not render');
ensure(!busan_board_share_eligible('notice',18,array_replace($public,['wr_is_comment'=>1]),['bo_table'=>'notice']),'comment share must not render');
ensure(!busan_board_share_eligible('notice',0,$public,['bo_table'=>'notice']),'list share must not render');
ensure(!busan_board_share_eligible('notice',18,$public,['bo_table'=>'other']),'wrong board share must not render');

$rights=json_decode(file_get_contents(dirname(__DIR__,2).'/deploy/busan/newsroom/rights-notes.json'),true,512,JSON_THROW_ON_ERROR);
foreach($rights as $a){
    $raw='';
    foreach($a['body'] as $s)$raw.='<p>'.htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</p>';
    $raw.='<p>작성: 챗지기자 · 부산지부 AI 기자. 일반적인 현장 기록 및 상담 준비 안내이며, 개별 법률 판단이나 회사 지침을 대신하지 않습니다.</p>';
    $formatted=busan_rights_format_body($raw);
    ensure(strpos($formatted,'bn-rights-guide')!==false,'structured rights article missing');
    ensure(substr_count($formatted,'bn-rights-section-card')>=4,'rights sections missing');
    ensure(substr_count($formatted,'bn-rights-steps')===1,'rights example missing');
    // All original words remain; only known labels and separators are replaced.
    $normalize=static function($s){return preg_replace('/[\s\/]+/u','',html_entity_decode(strip_tags($s),ENT_QUOTES,'UTF-8'));};
    $display=$normalize(str_replace(['</li>','</p>'],[' </li>',' </p>'],$formatted));
    foreach($a['body'] as $paragraph){
        $paragraph=preg_replace('/^(?:Q\. |A\. |예시: )/u','',$paragraph);
        foreach(preg_split('/\s+\/\s+|(?<=[.!?])\s+/u',$paragraph,-1,PREG_SPLIT_NO_EMPTY) as $part)
            ensure(strpos($display,$normalize($part))!==false,'rights text lost');
    }
    $write=['wr_name'=>'챗지기자','wr_6'=>'bn-rights-note-v1','wr_content'=>$raw,'wr_option'=>'html1'];
    busan_rights_prepare_body('', ['bo_table'=>'notice']);
    ensure($write['wr_content']===$raw,'other board changed');
    busan_rights_prepare_body('', ['bo_table'=>'note']);
    ensure($write['wr_content']===$formatted,'rights hook failed');
}
$legacy='<p>기존 조합원 글</p><p><strong>기존 내용</strong></p>';
ensure(busan_rights_format_body($legacy)===$legacy,'legacy content must remain intact');
echo "PASS rights-note structured rendering, complete text retention and legacy fallback\n";

$raw="첫 안내입니다.\r\n\r\n\r\n두번째 안내입니다.\n\nQ. 질문 하나?\n\n답변입니다.\n\n- 지급 기준 0%\n\n- 지급 기준 50%\n\nQ. 질문 둘?\n\nA. 두번째 답변입니다.\n";
$formatted=busan_rights_plain_body($raw);
ensure(substr_count($formatted,'bn-rights-topic-qa')===2,'plain Q&A groups failed');
ensure(substr_count($formatted,'bn-rights-topic-intro')===1,'plain intro split');
ensure(strpos($formatted,'<br')===false,'plain redundant linebreaks retained');
$normalize=static function($s){return preg_replace('/\s+/u','',html_entity_decode(strip_tags($s),ENT_QUOTES,'UTF-8'));};
ensure($normalize($raw)===$normalize($formatted),'legacy source text changed');
$write=['wr_content'=>$raw,'wr_option'=>'','wr_is_comment'=>0,'wr_6'=>'','wr_name'=>'기존 작성자'];
busan_rights_prepare_body('', ['bo_table'=>'note']);
ensure($write['wr_content']===$formatted&&$write['wr_option']==='html1','server legacy view hook failed');
$write=['wr_content'=>$raw,'wr_option'=>'secret','wr_is_comment'=>0];
busan_rights_prepare_body('', ['bo_table'=>'note']);
ensure($write['wr_content']===$raw,'secret legacy text changed');
echo "PASS server-rendered plain rights Q&A, no duplicated breaks, original wording retained\n";

$numbered="작업중지권은\n\n일을 멈추는 걸로 끝나지 않습니다.\n\n멈췄다면,\n\n그 다음은 회사의 책임입니다.\n\nQ1. 첫 질문?\n\nA. 첫 답변입니다.\n\n다른 사람에게 대신 시키는 행위 금지\n\nQ2. 다음 질문?\n\nA. 다음 답변입니다.\n\nQ 3) 마지막 질문?\n\n마지막 답변입니다.";
$numberedHtml=busan_rights_plain_body($numbered);
ensure(substr_count($numberedHtml,'bn-rights-topic-qa')===3,'numbered Q&A lost');
ensure(strpos($numberedHtml,'작업중지권은 일을 멈추는 걸로 끝나지 않습니다.')!==false,'short introduction still fragmented');
ensure($normalize($numbered)===$normalize($numberedHtml),'numbered rights wording changed');
echo "PASS numbered Q1/Q2/Q3 and joined introduction\n";

ensure(busan_rights_visual_key('Q1. 성과급 지급은?','징계 규정','topic-qa')==='pay','payment topic mismatch');
ensure(busan_rights_visual_key('Q2. 안전한 장소로 대피','작업중지','topic-qa')==='evacuate','evacuation topic mismatch');
ensure(busan_rights_visual_key('Q3. 연차 휴가','기록','topic-qa')==='leave','leave topic mismatch');
$visual=busan_rights_plain_body("도입입니다.\nQ1. 성과급 기준은?\nA. 설명입니다.\nQ2. 사다리 안전은?\nA. 설명입니다.");
ensure(substr_count($visual,'bn-rights-visual ')===2,'one illustration per question card');
ensure(strpos($visual,'bn-rights-visual-pay')!==false&&strpos($visual,'bn-rights-visual-safety')!==false,'specific visual topics missing');
echo "PASS contextual rights illustrations and one image per card\n";

$parental="1) 기본적으로 적용되는 자녀 나이 기준\n\n근로자는 **만 8세 이하** 자녀를 양육합니다.\n\n급여 기준은 별도입니다.\n\n2) 기타 조건 (나이 외)\n\n신청 조건을 확인합니다.\n\n3) 휴직 기간 관련\n\n**1년 6개월** 관련 안내입니다.";
$parentalHtml=busan_rights_plain_body($parental,'2026년 육아휴직 관련 팁');
ensure(substr_count($parentalHtml,'bn-rights-topic bn-rights-topic-heading')===3,'numbered guide sections missing');
ensure(substr_count($parentalHtml,'bn-rights-visual-leave')===3,'childcare topic illustrations incorrect');
ensure(strpos($parentalHtml,'<strong>만 8세 이하</strong>')!==false,'inline emphasis missing');
ensure($normalize(str_replace('**','',$parental))===$normalize($parentalHtml),'numbered source wording lost');
echo "PASS numbered childcare guide, topical illustrations and inline emphasis\n";

// Round trip representative native edit formats, including lost custom metadata.
foreach($rights as $a){
    $edited=$a['body'];$edited[1].=' 수정한 문장도 그대로 표시합니다.';
    array_splice($edited,2,0,['추가 확인 문단입니다.']);
    $edited[]='작성: 챗지기자 · 부산지부 AI 기자.';
    $plain=implode("\n\n",$edited);
    $variants=[$plain,implode('<br><br>',array_map('htmlspecialchars',$edited)),
       '<div><p>'.implode('</p><p>',array_map('htmlspecialchars',$edited)).'</p></div>'];
    foreach($variants as $variant){
        foreach(['bn-rights-note-v1',''] as $marker){
            $write=['wr_subject'=>$a['title'],'wr_name'=>'수정한 작성자','wr_6'=>$marker,'wr_content'=>$variant,'wr_option'=>'html1'];
            busan_rights_prepare_body('', ['bo_table'=>'note']);
            $html=$write['wr_content'];
            ensure(substr_count($html,'bn-rights-section-card')>=4,'edited guide collapsed');
            ensure(strpos($html,'bn-rights-question')!==false&&strpos($html,'bn-rights-answer')!==false&&strpos($html,'bn-rights-example')!==false,'edited guide section lost');
            ensure(substr_count($html,'bn-rights-visual ')===substr_count($html,'bn-rights-section-card'),'edited guide illustrations missing');
            foreach($edited as $line)ensure(strpos($normalize($html),$normalize($line))!==false,'edited source words lost');
        }
    }
}
$media='<p>Q. 질문</p><p>A. 답변</p><p><a href="https://example.test">참고</a><img src="/photo.jpg"></p>';
ensure(busan_rights_editor_text($media)===null,'rich media must not be stripped');
echo "PASS native edit round trip: plain text, BR, editor paragraphs, inserted content and lost metadata\n";
