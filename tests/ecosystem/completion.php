<?php
require __DIR__.'/features.php';
$postNow=eco_detail($b['id'],$a)['post'];eco_save($a,array_replace($b,['revision'=>$postNow['revision'],'visibility'=>'public']));
// A deleted comment is a tombstone, not an editable comment or a live counter.
ok(eco_detail($b['id'],$a)['post']['comments']===0,'delete_updates_count');
eco_mutate($fan,'comment-delete',['id'=>$b['id'],'commentId'=>$cid]);
ok(eco_detail($b['id'],$a)['post']['comments']===0,'repeat_delete_no_negative_count');
$deleted=ns_doc('ecosystem:comment:'.$cid);
fail(fn()=>eco_mutate($fan,'comment',['id'=>$b['id'],'commentId'=>$cid,'revision'=>$deleted['revision'],'body'=>'restore']),'comment_deleted');
// Bind each applicant's consent to the exact current terms and audited revision.
$detail=eco_detail($collab['id'],$other);$own=$detail['ownApplication'];
ok($own['status']==='requested'&&!$own['termsChanged'],'applicant_can_see_own_status');
ok(eco_detail($collab['id'],$fan)['ownApplication']===null,'application_isolation');
$next=array_replace($collab,['revision'=>1,'compensation'=>'서면 계약 후 50% 배분']);eco_save($a,$next);
fail(fn()=>eco_mutate($a,'application-review',['id'=>$collab['id'],'application'=>$own['id'],'status'=>'accepted']),'terms_changed');
ok(eco_detail($collab['id'],$other)['ownApplication']['termsChanged'],'changed_terms_disclosed');
fail(fn()=>eco_mutate($a,'application-withdraw',['id'=>$collab['id'],'revision'=>$own['revision']]),'not_found');
fail(fn()=>eco_mutate($other,'application-withdraw',['id'=>$collab['id'],'revision'=>999]),'revision_conflict');
$withdrawn=eco_mutate($other,'application-withdraw',['id'=>$collab['id'],'revision'=>$own['revision']]);
ok($withdrawn['status']==='withdrawn','withdrawal_persisted');
fail(fn()=>eco_mutate($other,'apply',['id'=>$collab['id'],'consent'=>true,'termsHash'=>$detail['post']['termsHash'],'applicationRevision'=>$withdrawn['revision'],'message'=>'stale']),'terms_changed');
$current=eco_detail($collab['id'],$other)['post'];
eco_mutate($other,'apply',['id'=>$collab['id'],'consent'=>true,'termsHash'=>$current['termsHash'],'applicationRevision'=>$withdrawn['revision'],'message'=>'변경 조건 동의']);
$review=eco_mutate($a,'application-review',['id'=>$collab['id'],'application'=>$own['id'],'status'=>'accepted']);ok($review['status']==='accepted','fresh_consent_acceptance');
fail(fn()=>eco_mutate($a,'application-review',['id'=>$collab['id'],'application'=>$own['id'],'status'=>'declined']),'application_final');
ok(eco_activity($other)['applications'][0]['space']==='lab','cross_space_activity_destination');
// Only actual visible products are linked; later hiding a product removes its public link.
$linked=array_replace($b,['id'=>str_repeat('6',32),'revision'=>0,'category'=>'event','productIds'=>[$product['id']]]);eco_save($a,$linked);
ok(eco_detail($linked['id'],$guest)['products'][0]['id']===$product['id'],'event_product_link');
fail(fn()=>eco_save($a,array_replace($linked,['revision'=>1,'productIds'=>['nonexistent']])),'product_unavailable');
eco_product_save($admin,array_replace($updated['product'],['hidden'=>true]));
ok(eco_detail($linked['id'],$guest)['products']===[],'hidden_product_not_promoted');
eco_product_save($admin,array_replace($updated['product'],['hidden'=>false]));
// Report outcome survives loss of read access, without disclosing the hidden post.
eco_mutate($fan,'report',['id'=>$linked['id'],'reason'=>'검토 요청']);
$reportKey='ecosystem:report:'.hash('sha256',$linked['id'].'|'.$fan['id']);
fail(fn()=>eco_report_review($fan,['key'=>$reportKey,'decision'=>'hidden','note'=>'검토']),'administrator_required');
eco_report_review($admin,['key'=>$reportKey,'decision'=>'hidden','note'=>'내용 검토 완료']);
fail(fn()=>eco_detail($linked['id'],$fan),'not_found');
$notices=eco_activity($fan)['notices'];$result=array_values(array_filter($notices,fn($n)=>str_starts_with($n['text'],'신고 처리 결과')));
ok(count($result)===1&&$result[0]['post']===''&&!isset($result[0]['postTitle']),'hidden_report_result_without_content_leak');
ok(count(array_filter(eco_activity($a)['notices'],fn($n)=>str_contains($n['text'],'비공개 처리')))===1,'author_moderation_notification');
fail(fn()=>eco_report_review($admin,['key'=>$reportKey,'decision'=>'dismissed','note'=>'중복']),'report_closed');
echo "ECOSYSTEM_COMPLETION_CONSENT_WITHDRAWAL_PRODUCT_LINK_REPORT_NOTICE_COMMENT_COUNT_OK\n";
