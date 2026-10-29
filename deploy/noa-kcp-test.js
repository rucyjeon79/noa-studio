(() => {
  'use strict';
  const form = document.getElementById('kcp-order');
  if (!form) return;
  const button = document.getElementById('kcp-open');
  const notice = document.getElementById('kcp-notice');
  // Required KCP callback name. Authentication is not approval; this module never credits points.
  window.m_Completepayment = function (FormOrJson, closeEvent) {
    try {
      window.GetField(form, FormOrJson);
      if (form.elements.res_cd.value === '0000') form.submit();
      else { notice.textContent = '결제창 인증이 완료되지 않았습니다. 다시 시도할 수 있습니다.'; if (typeof closeEvent === 'function') closeEvent(); }
    } catch (_) { notice.textContent = '결과를 확인하지 못했습니다. 승인이나 포인트 지급은 처리하지 않았습니다.'; }
  };
  if (form.dataset.mobile !== '1') {
    button.disabled = true;
    const script = document.createElement('script');
    script.src = 'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js';
    script.onload = () => { button.disabled = false; };
    script.onerror = () => { notice.textContent = 'KCP 테스트 스크립트를 불러오지 못했습니다. 다시 접속해 주세요.'; };
    document.head.append(script);
  }
  button.addEventListener('click', () => {
    if (form.dataset.mobile === '1') {
      const url = new URL(form.elements.PayUrl.value);
      if (url.origin !== 'https://testsmpay.kcp.co.kr') { notice.textContent = '결제창 주소 확인에 실패했습니다.'; return; }
      form.action = url.href.substring(0, url.href.lastIndexOf('/')) + '/jsp/encodingFilter/encodingFilter.jsp';
      form.submit();
    } else {
      if (typeof window.KCP_Pay_Execute_Web !== 'function') { notice.textContent = 'KCP 결제창이 아직 준비되지 않았습니다.'; return; }
      try { window.KCP_Pay_Execute_Web(form); } catch (_) { /* KCP throws on normal window close, per integration guide. */ }
    }
  });
})();
