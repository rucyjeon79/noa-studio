<?php
declare(strict_types=1);require_once __DIR__.'/../../bridge/sound-core.php';require_once __DIR__.'/../../bridge/ainoa-core.php';
foreach(['private','draft','unlisted','hidden']as $v)if(na_public(['visibility'=>$v]))throw new RuntimeException('private_projection');if(na_public(['ownerId'=>'creator']))throw new RuntimeException('creator_projection');
$r=na_summary(['doc_key'=>'one','payload'=>json_encode(['title'=>'노래','body'=>['lyricsBlock'=>"[Verse]\n노래 가사",'sunoPrompt'=>'SECRET PROMPT','geminiPrompt'=>'PRIVATE INSTRUCTIONS','audioFileLocation'=>'secret.mp3']])]);if(str_contains(json_encode($r),'SECRET')||str_contains($r['lyrics'],'[Verse]'))throw new RuntimeException('production_fields_leaked');echo "AINOA_PUBLIC_PROJECTION_PRIVATE_RECORDS_AND_PRODUCTION_FIELDS_PROTECTED\n";

if(!na_public(['ownerId'=>'creator','visibility'=>'public']))throw new RuntimeException('published_creator_not_searchable');if(na_summary(['doc_key'=>'private','payload'=>json_encode(['ownerId'=>'other','visibility'=>'private','title'=>'secret'])])!==null)throw new RuntimeException('private_creator_leaked');

$hit=na_search_hit(['title'=>'다른 곡','lyrics'=>"(soft piano fading)\n사랑이 머무는 밤\n(soft male vocal reverb)"],'사랑');if($hit['snippet']!=='사랑이 머무는 밤'||$hit['score']!==2)throw new RuntimeException('lyric_snippet_includes_production_cue');if(na_search_hit(['title'=>'노래','lyrics'=>'(soft piano fading)'],'piano')!==null)throw new RuntimeException('production_cue_is_not_lyric_search');if(na_search_hit(['title'=>'사랑','lyrics'=>'가사'],'사랑')['score']!==0)throw new RuntimeException('exact_title_priority');

$guide=na_guide(['title'=>'곡','description'=>'<b>등록된 소개</b> https://example.com/private #태그']);if(str_contains($guide,'https:')||str_contains($guide,'<')||str_contains($guide,'#'))throw new RuntimeException('guide_contains_markup_or_links');if(mb_strlen(na_guide(['title'=>'곡','description'=>str_repeat('설명',200)]))>141)throw new RuntimeException('guide_too_long');

$persona=na_persona();foreach(['한글 발음','시크','엉뚱','출처','정확한 사실','꾸며내지']as $rule)if(!str_contains($persona,$rule))throw new RuntimeException('missing_persona_rule');
foreach(['deploy/noa-ainoa.php','bridge/ainoa-automation.php']as $file)if(!str_contains(file_get_contents(__DIR__.'/../../'.$file),"na_text(na_persona()."))throw new RuntimeException('conversation_persona_not_wired');
