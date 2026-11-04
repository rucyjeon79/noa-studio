<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/member-access.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
$access=nam_access((array)($member??[]),(string)($is_admin??''));
if(empty($is_member)){http_response_code(401);echo '{"error":"login_required"}';exit;}
if(!$access['weatherVip']){http_response_code(403);echo '{"error":"vip_required"}';exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
// Editorial sequences prepared by AInoa. These are published music choices, never a live chat reply.
$editions=[
 'sun'=>['☀️','맑음',[
    ['이 기분을 더 즐기고 싶어','지금의 경쾌함을 조금 더 누리고 싶을 때예요. 리듬이 살아 있는 쪽으로 이어 볼게요.',['energy','walk','energy']],
    ['설레는 마음에 머물래','설렘을 서둘러 지나칠 필요는 없죠. 가벼운 발걸음처럼 이어지는 곡을 골라 볼게요.',['walk','comfort','walk']]]],
 'cloud'=>['☁️','흐림',[
    ['그냥 이 기분에 머물래','흐린 마음에도 그날의 속도가 있어요. 조용히 들을 수 있는 곡을 곁에 둘게요.',['calm','comfort','calm']],
    ['조금 기운을 내고 싶어','첫 곡부터 힘을 낼 필요는 없어요. 편안하게 출발해서 마지막엔 조금 더 가볍게 걸어 봐요.',['comfort','walk','energy']]]],
 'rain'=>['🌧️','비',[
    ['오늘은 실컷 울고 싶어','마음을 얼른 바꾸려고 애쓰지 않아도 돼요. 오늘은 이 감정에 머물 수 있게 곡을 이을게요.',['comfort','calm','comfort']],
    ['조용히 위로받고 싶어','말이 많으면 더 지치는 날도 있죠. 곁에서 작은 위로가 될 만한 곡부터 놓아둘게요.',['calm','comfort','calm']],
    ['기분을 바꿔 보고 싶어','빗속에서 바로 뛰기보다 한 발씩 걸어 보는 흐름이에요. 위로에서 시작해 활기를 조금 더할게요.',['comfort','walk','energy']]]],
 'storm'=>['⛈️','천둥번개',[
    ['화가 나서 시원하게 풀고 싶어','지금은 잔잔한 노래보다 마음껏 박자를 탈 수 있는 곡이 당기는군요. 그 세기를 이어갈게요.',['energy','drive','energy']],
    ['천천히 가라앉고 싶어','갑자기 고요해지려고 애쓰지 않아도 돼요. 첫 곡엔 움직임을 남기고 다음 곡부터 속도를 낮출게요.',['drive','cruise','calm']]]],
 'fog'=>['🌫️','안개',[
    ['내 기분을 잘 모르겠어','지금 마음에 이름을 붙이지 않아도 괜찮아요. 일단 한 곡 듣고, 다음 곡의 방향을 골라 보세요.',['calm','walk','comfort']],
    ['생각을 잠시 쉬고 싶어','생각을 정리하는 일도 잠깐 미뤄 둬요. 호흡을 고를 수 있게 차분한 흐름으로 이을게요.',['calm','focus','calm']]]],
];
echo json_encode(['source'=>'studio-edition','weather'=>$editions],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
