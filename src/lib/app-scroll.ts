function scroller() {
  return document.getElementById("pc-scroll");
}

export function appScrollBy(top: number, behavior: ScrollBehavior = "auto") {
  markCodeScroll();
  const el = scroller();
  if (el) el.scrollBy({ top, behavior });
  else window.scrollBy({ top, behavior });
}

export function appScrollTo(top: number, behavior: ScrollBehavior = "auto") {
  markCodeScroll();
  const el = scroller();
  if (el) el.scrollTo({ top, behavior });
  else window.scrollTo({ top, behavior });
}

export function appScrollY() {
  const el = scroller();
  return el ? el.scrollTop : window.scrollY;
}

function viewBox() {
  const el = scroller();
  if (!el) return { top: 0, bottom: window.innerHeight };
  const rect = el.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom };
}

export function workFloor() {
  const view = viewBox();
  let bar = view.bottom;
  for (const id of ["fill-notice", "result-status", "play-notice", "noa-health-sheet"]) {
    const node = document.getElementById(id);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    if (rect.height < 8 || rect.width < 8 || rect.top >= view.bottom - 4) continue;
    bar = Math.min(bar, rect.top);
  }
  return bar;
}

function bottomCover() {
  return Math.max(12, viewBox().bottom - workFloor());
}

export function followTop(el: HTMLElement | null, behavior: ScrollBehavior = "smooth") {
  if (!el) return;
  const view = viewBox();
  const delta = el.getBoundingClientRect().top - (view.top + 12);
  if (Math.abs(delta) > 2) appScrollBy(delta, behavior);
}

export function followTarget(el: HTMLElement | null, behavior: ScrollBehavior = "smooth") {
  if (!el) return;
  const view = viewBox();
  const rect = el.getBoundingClientRect();
  const topInset = 12;
  const visibleTop = view.top + topInset;
  const visibleBottom = view.bottom - bottomCover();
  const room = Math.max(80, visibleBottom - visibleTop);
  if (rect.height >= room - 4) {
    const seen = rect.bottom > visibleTop + 24 && rect.top < visibleBottom - 24;
    if (seen) return;
    const delta = rect.top - visibleTop;
    if (Math.abs(delta) > 2) appScrollBy(delta, behavior);
    return;
  }
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return;
  const delta = rect.top < visibleTop ? rect.top - visibleTop : rect.bottom - visibleBottom;
  if (Math.abs(delta) > 2) appScrollBy(delta, behavior);
}

export function keepView(el: HTMLElement | null) {
  if (!el) return;
  const before = el.getBoundingClientRect().top;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const delta = el.getBoundingClientRect().top - before;
      if (Math.abs(delta) > 1) appScrollBy(delta, "auto");
    });
  });
}

export function placeFillField(el: HTMLElement) {
  document.querySelectorAll("[data-fill-fit]").forEach((node) => {
    if (node !== el && node instanceof HTMLElement) {
      node.style.maxHeight = "";
      node.style.overflow = "";
      node.removeAttribute("data-fill-fit");
    }
  });
  const notice = document.getElementById("fill-notice") || document.getElementById("result-status");
  const bar = Math.min(workFloor(), notice ? notice.getBoundingClientRect().top : workFloor());
  const gap = 8;
  const topLimit = 8;
  const room = Math.max(140, Math.floor(bar - gap - topLimit));
  el.style.maxHeight = "";
  el.style.overflow = "";
  el.removeAttribute("data-fill-fit");
  if (el.getBoundingClientRect().height > room) {
    el.setAttribute("data-fill-fit", "1");
    el.style.maxHeight = `${room}px`;
    el.style.overflow = "auto";
  }
  const next = el.getBoundingClientRect();
  const delta = next.bottom - (bar - gap);
  if (Math.abs(delta) > 2) appScrollBy(delta, "auto");
  const placed = el.getBoundingClientRect();
  if (placed.top < topLimit) appScrollBy(placed.top - topLimit, "auto");
}

export function clearFillFit() {
  document.querySelectorAll("[data-fill-fit]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.maxHeight = "";
    node.style.overflow = "";
    node.removeAttribute("data-fill-fit");
  });
}

let workNodes = new Set<HTMLElement>();
let workTimer = 0;
let workListening = false;
let workMoving = false;
let codeScroll = 0;

function markCodeScroll() {
  codeScroll += 1;
  window.setTimeout(() => {
    codeScroll = Math.max(0, codeScroll - 1);
  }, 280);
}

function orderedWork() {
  return [...workNodes]
    .filter((el) => el.isConnected)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
}

function workOffScreen(nodes: HTMLElement[]) {
  if (!nodes.length) return false;
  const view = viewBox();
  const top = view.top + 8;
  const bottom = view.bottom - bottomCover();
  return nodes.every((el) => {
    const rect = el.getBoundingClientRect();
    return rect.bottom < top + 8 || rect.top > bottom - 8;
  });
}

export function showWorkGroup(nodes: HTMLElement[]) {
  const live = nodes
    .filter((node) => node.isConnected)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  if (!live.length) return;
  if (live.length > 1) {
    for (const el of live) {
      if (el.getAttribute("data-fill-fit") !== "1") continue;
      el.style.maxHeight = "";
      el.style.overflow = "";
      el.removeAttribute("data-fill-fit");
    }
  }
  const view = viewBox();
  const bar = workFloor();
  const gap = 8;
  const topLimit = view.top + 8;
  const first = live[0].getBoundingClientRect();
  const last = live[live.length - 1].getBoundingClientRect();
  const room = bar - gap - topLimit;
  const height = last.bottom - first.top;
  const fullyIn = first.top >= topLimit - 2 && last.bottom <= bar - gap + 2;
  if (fullyIn) return;
  const intersects = live.some((el) => {
    const rect = el.getBoundingClientRect();
    return rect.bottom > topLimit + 8 && rect.top < bar - gap - 8;
  });
  if (height > room) {
    if (intersects) return;
    const delta = first.top - topLimit;
    if (Math.abs(delta) > 2) appScrollBy(delta, "auto");
    return;
  }
  const delta = first.top < topLimit ? first.top - topLimit : last.bottom - (bar - gap);
  if (Math.abs(delta) > 2) appScrollBy(delta, "auto");
}

function returnToWork() {
  const nodes = orderedWork();
  if (!nodes.length || !workOffScreen(nodes)) return;
  workMoving = true;
  showWorkGroup(nodes);
  window.setTimeout(() => {
    workMoving = false;
  }, 500);
}

function scheduleWorkReturn() {
  if (!workNodes.size || workMoving || codeScroll > 0) return;
  window.clearTimeout(workTimer);
  workTimer = window.setTimeout(returnToWork, 3000);
}

function onWorkMove() {
  scheduleWorkReturn();
}

function listenWorkReturn() {
  if (workListening || typeof window === "undefined") return;
  workListening = true;
  window.addEventListener("wheel", onWorkMove, { passive: true });
  window.addEventListener("touchmove", onWorkMove, { passive: true });
  document.addEventListener("scroll", onWorkMove, { capture: true, passive: true });
  window.addEventListener("pointerdown", onWorkMove, { passive: true });
  window.addEventListener("keydown", onWorkMove);
}

export function pinWorkField(el: HTMLElement) {
  listenWorkReturn();
  workNodes.add(el);
  return () => {
    workNodes.delete(el);
    if (workNodes.size) return;
    window.clearTimeout(workTimer);
  };
}
