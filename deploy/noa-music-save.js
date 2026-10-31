/* The picker id lets this browser remember the last directory on this device.
   No local paths, handles or file data are sent to NOA's server. */
(() => {
  'use strict';
  const button = document.getElementById('music-download-file');
  if (!button) return;
  const help = document.getElementById('music-save-help');
  const status = document.getElementById('music-save-status');
  const cancel = document.getElementById('music-save-cancel');
  const fallback = document.getElementById('music-save-fallback');
  if (typeof window.showSaveFilePicker !== 'function' || !window.isSecureContext) {
    help.textContent = '이 환경에서는 앱에서 저장 위치를 지정할 수 없어요. 기기·브라우저의 다운로드 설정을 이용해 주세요.';
    return;
  }
  button.textContent = '저장 위치 선택하고 MP3 받기';
  help.textContent = '저장할 폴더를 선택하세요. 다음에는 이 기기의 같은 브라우저에서 마지막 폴더를 먼저 열어요. 위치는 서버에 저장하지 않아요.';
  let busy = false;
  let controller;
  cancel.addEventListener('click', () => controller?.abort());
  button.addEventListener('click', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    button.setAttribute('aria-disabled', 'true');
    fallback.hidden = true;
    let writer;
    let reader;
    let committed = false;
    try {
      // Must open during the click, before any asynchronous network request.
      const handle = await window.showSaveFilePicker({
        id: 'noa-music-download', startIn: 'music',
        suggestedName: (button.dataset.filename || 'NOA.mp3').replace(/[\\/\u0000-\u001f]/g, '_'),
        types: [{description: 'MP3 음원', accept: {'audio/mpeg': ['.mp3']}}]
      });
      controller = new AbortController();
      cancel.hidden = false;
      status.textContent = '음원을 저장하고 있어요. 이 화면을 열어 두세요.';
      const response = await fetch(button.href, {credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
      if (response.status !== 200 || !/^audio\/mpeg(?:;|$)/i.test(response.headers.get('Content-Type') || '') || !response.body) throw new Error('invalid_audio_response');
      const size = Number(response.headers.get('Content-Length'));
      if (!Number.isSafeInteger(size) || size <= 0) throw new Error('invalid_audio_size');
      writer = await handle.createWritable();
      reader = response.body.getReader();
      let received = 0;
      while (true) {
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const {done, value} = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > size) throw new Error('audio_size_mismatch');
        await writer.write(value);
        status.textContent = `음원 저장 중 · ${Math.floor(received / size * 100)}%`;
      }
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (received !== size) throw new Error('audio_size_mismatch');
      await writer.close();
      committed = true;
      status.textContent = '선택한 위치에 저장했어요.';
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '저장을 취소했어요.' : '저장하지 못했어요. 위치나 저장 공간을 확인한 뒤 다시 시도하거나 기본 다운로드를 이용해 주세요.';
      fallback.hidden = error.name === 'AbortError';
    } finally {
      if (!committed) {
        controller?.abort();
        try { await reader?.cancel(); } catch (_) {}
        try { await writer?.abort(); } catch (_) {}
      }
      controller = undefined;
      cancel.hidden = true;
      button.removeAttribute('aria-disabled');
      busy = false;
    }
  });
})();
