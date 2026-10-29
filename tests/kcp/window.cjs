// 결제 검증 보완: SDK contracts tested with a fake transport; no real approval asserted.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('deploy/noa-kcp-test.js', 'utf8');
function fixture(mobile) {
  let click, submitted = 0, sdkCalls = 0, closed = 0;
  const elements = Object.fromEntries(Object.entries({res_cd:'',res_msg:'',PayUrl:'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp',encoding_trans:'UTF-8',enc_data:'',enc_info:''}).map(([k,v])=>[k,{value:v}]));
  const form = {elements,dataset:{mobile:mobile?'1':'0'},submit(){submitted++;}};
  const notice = {textContent:''};
  const button = {addEventListener(_,fn){click=fn;}};
  const win = {GetField(frm,result){for(const [k,v] of Object.entries(result)) if(frm.elements[k]) frm.elements[k].value=v;},KCP_Pay_Execute_Web(){sdkCalls++;throw new Error('normal SDK throw');}};
  const doc = {getElementById(id){return {'kcp-order':form,'kcp-open':button,'kcp-notice':notice}[id];},createElement(){return {};},head:{append(s){assert.equal(typeof win.m_Completepayment,'function');assert.equal(s.src,'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js');s.onload();}}};
  vm.runInNewContext(source,{window:win,self:win,document:doc,URL});
  return {form,notice,win,click:()=>click(),submitted:()=>submitted,sdkCalls:()=>sdkCalls,close:()=>closed++,closed:()=>closed};
}
const pc=fixture(false);pc.click();assert.equal(pc.sdkCalls(),1);assert.equal(pc.submitted(),0);
pc.win.m_Completepayment({res_cd:'3001',res_msg:'cancel'},pc.close);assert.equal(pc.closed(),1);assert.equal(pc.submitted(),0);
pc.win.m_Completepayment({res_cd:'0000',enc_data:'exact+/%=',enc_info:'exact-info'},pc.close);assert.equal(pc.submitted(),1);assert.equal(pc.form.elements.enc_data.value,'exact+/%=');
const mobile=fixture(true);mobile.click();assert.equal(mobile.win.name,'tar_opener');assert.equal(mobile.form.action,'https://testsmpay.kcp.co.kr/pay/jsp/encodingFilter/encodingFilter.jsp');assert.equal(mobile.submitted(),1);
const bad=fixture(true);bad.form.elements.PayUrl.value='https://evil.invalid/pay';bad.click();assert.equal(bad.submitted(),0);
console.log('KCP_WINDOW_CALLBACK_ENCODING_AND_CANCEL_OK');
