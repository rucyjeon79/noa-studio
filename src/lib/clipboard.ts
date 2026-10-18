function writeClipboardNow(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "0";
  area.style.top = "0";
  area.style.width = "100%";
  area.style.height = "48px";
  area.style.fontSize = "16px";
  area.style.opacity = "1";
  area.style.color = "transparent";
  area.style.background = "transparent";
  area.style.border = "0";
  area.style.zIndex = "2147483646";
  document.body.appendChild(area);
  const scroller = document.scrollingElement;
  const top = scroller?.scrollTop ?? 0;
  const left = scroller?.scrollLeft ?? 0;
  area.focus({ preventScroll: true });
  area.select();
  area.setSelectionRange(0, area.value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.blur();
  area.remove();
  if (scroller) {
    scroller.scrollTop = top;
    scroller.scrollLeft = left;
  }
  return ok;
}

export function copyText(text: string): Promise<boolean> {
  return Promise.resolve(writeClipboardNow(text));
}
