(() => {
  const template = document.getElementById('bn-share-template');
  if (!template || document.querySelector('.bn-article-share')) return;
  const header = document.querySelector('.boardViewWrap .boardViewHeader, .boardViewHeader');
  if (!header) return;
  const actions = header.querySelector('.btnGroupWrap > .btnGroup:last-child')
    || header.querySelector('.btnGroup:last-child')
    || header.querySelector('.btnGroupWrap')
    || header;
  // Preserve any existing native share control instead of adding a duplicate.
  const nativeShare = [...header.querySelectorAll('button,a')].find(el =>
    /^(?:기사|게시글|게시물)?\s*공유(?:하기)?$/.test((el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').trim()));
  if (nativeShare) return;
  const fragment = template.content.cloneNode(true);
  const button = fragment.querySelector('.bn-article-share');
  const feedback = fragment.querySelector('.bn-share-feedback');
  const data = {title:button.dataset.title, text:button.dataset.title, url:button.dataset.url};
  const noun = button.dataset.kind === 'post' ? '게시글' : '기사';
  actions.prepend(fragment);
  let feedbackTimer;

  function announce(message) {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 3500);
  }

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(data.url);
      announce(noun+' 링크를 복사했습니다. 원하는 곳에 붙여넣어 주세요.');
    } catch (_) {
      // A selectable native field remains available when clipboard permission is denied.
      window.prompt(noun+' 링크를 길게 누르거나 선택해 복사해 주세요.', data.url);
    }
  }

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    feedback.hidden = true;
    try {
      if (typeof navigator.share === 'function' &&
          (typeof navigator.canShare !== 'function' || navigator.canShare(data))) {
        try {
          // Call directly from the tap: no fetch or await before the native share sheet.
          await navigator.share(data);
          return;
        } catch (error) {
          // Cancelling the share sheet must not copy or display another dialog.
          if (error?.name === 'AbortError') return;
        }
      }
      await copyLink();
    } finally {
      button.disabled = false;
    }
  });
  document.dispatchEvent(new Event('bn-share-ready'));
})();
