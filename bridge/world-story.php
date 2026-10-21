<?php
declare(strict_types=1);
/** User-supplied page introduction drafts. Never written into canonical catalog fields. */
function nws_drafts():array{return [
 1=>['title'=>'사랑의 시작과 상처','summary'=>'처음 사랑을 알게 된 순간부터, 익숙했던 세계가 무너지는 순간까지.','prologue'=>'누군가를 사랑한다는 건 평범한 하루에 새로운 빛이 들어오는 일이었다. 그러나 그 빛이 영원할 거라 믿었던 마음은 조금씩 흔들리기 시작한다.'],
 2=>['title'=>'엇갈린 마음','summary'=>'같은 시간을 지나왔지만 서로 다르게 기억하는 두 사람의 이야기.','prologue'=>'우리는 같은 장면에 있었지만 서로 다른 이야기를 쓰고 있었다. 한 사람은 기다렸고, 다른 한 사람은 떠날 이유를 찾았다.'],
 3=>['title'=>'이별 너머의 빛','summary'=>'상처를 마주하고 스스로의 빛을 되찾는 과정.','prologue'=>'이별은 모든 것의 끝이라고 생각했다. 하지만 무너진 자리에서도 삶은 계속되었고, 흩어진 기억은 마침내 하나의 별이 되었다.'],
 4=>['title'=>'다시 사랑이 스며들 때','summary'=>'새로운 만남, 조심스러운 구애, 닫힌 마음과 느린 회복.','prologue'=>'다시는 사랑하지 않겠다고 다짐한 마음에도 계절은 찾아온다. 서두르지 않고 곁에 머무는 누군가를 통해 Noa는 조금씩 새로운 온기를 느낀다.','epilogue'=>'사랑은 모든 상처가 사라진 뒤에 시작되는 것이 아니었다. 아직 두려워도, 누군가와 함께 걸어볼 용기를 내는 것. 그렇게 두 사람의 새로운 이야기가 시작된다.']
];}
function nws_prose(array $fields,int $act,string $kind):array{
 $key=['prologue'=>'worldPrologue','epilogue'=>'worldEpilogue'][$kind]??'worldChapter';$official=nw_text($fields,$key);
 if($official!=='')return ['text'=>$official,'source'=>'등록된 세계관 원문'];
 $text=nws_drafts()[$act][$kind]??'';return ['text'=>$text?:'확정된 원문이 아직 등록되지 않았습니다.','source'=>$text!==''?'세계관 소개 초안 · 확정 설정 아님':'원문 등록 대기'];
}
