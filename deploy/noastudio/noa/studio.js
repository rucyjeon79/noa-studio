const state = { groups: [], genre: "", songs: [], acts: [] };
const $ = (id) => document.getElementById(id);
const labels = {
  confirmedTitle: "확정 제목", summary: "요약", lyricsBlock: "가사", sunoStyle: "SUNO STYLE",
  geminiPrompt: "썸네일 프롬프트", thumbUrl: "썸네일 주소", youtubeTitle: "YouTube title",
  youtubeDescription: "영상 설명란", fanLetter: "커뮤니티 글", communityPost: "커뮤니티 글",
  tracklist: "수록곡", youtubeUrl: "유튜브 URL", mvUrl: "MV URL", sunoUrl: "수노 URL",
  audioLevel: "음원 보정값", audioAnalysis: "음원 분석값", ytPremium: "고음질", mvPremium: "MV 고음질"
};
const longKey = /lyrics|Description|Prompt|summary|tracklist|Style|fanLetter|community/;

function ytId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]));
}

async function loadCatalog() {
  const res = await fetch("api.php?op=catalog");
  const data = await res.json();
  state.groups = data.groups || [];
  drawGenres();
  const first = state.groups[0]?.genres[0];
  if (first) openGenre(first.id);
}

function drawGenres() {
  const nav = $("genres");
  nav.innerHTML = "";
  for (const group of state.groups) {
    const g = document.createElement("span");
    g.className = "group";
    g.textContent = group.group;
    nav.appendChild(g);
    for (const genre of group.genres) {
      const b = document.createElement("button");
      b.className = "chip" + (genre.id === state.genre ? " on" : "");
      b.textContent = genre.label;
      b.onclick = () => openGenre(genre.id);
      nav.appendChild(b);
    }
  }
}

function findGenre(id) {
  for (const group of state.groups) {
    const hit = group.genres.find((genre) => genre.id === id);
    if (hit) return hit;
  }
  return null;
}

function openGenre(id) {
  state.genre = id;
  const genre = findGenre(id);
  state.songs = genre?.songs || [];
  state.acts = genre?.acts || [];
  drawGenres();
  drawList();
}

function drawList() {
  const main = $("list");
  main.innerHTML = "";
  for (const act of state.acts) {
    main.appendChild(row(act, true));
  }
  for (const song of state.songs) {
    main.appendChild(row(song, false));
  }
}

function row(item, isAct) {
  const box = document.createElement("article");
  box.className = isAct ? "act" : "song";
  const id = ytId(item.youtubeUrl);
  box.innerHTML = `<button type="button" class="head"><span>${esc(isAct ? "Act." + item.act + " · " + item.title : (item.ep ? item.ep + "  " : "") + item.title)}</span><span class="badge">${item.confirmed ? "확정" : ""}</span></button>` +
    (id ? `<div class="preview"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe></div>` : "");
  box.querySelector(".head").onclick = () => openItem(isAct ? "act-" + item.act + ".json" : item.key);
  const hear = document.createElement("button");
  hear.className = "stop";
  hear.type = "button";
  hear.textContent = "음원";
  hear.onclick = (event) => { event.stopPropagation(); play(item.title, item.sunoUrl); };
  box.querySelector(".head").appendChild(hear);
  return box;
}

function play(title, url) {
  $("now").textContent = title || "음원";
  const audio = $("audio");
  const id = String(url || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const direct = /\.(mp3|m4a|mp4)(\?|$)/i.test(url || "") ? url : (id ? `https://cdn1.suno.ai/${id[0]}.mp3` : "");
  if (!direct) {
    if (url) window.open(url, "_blank");
    $("now").textContent = (title || "") + " · 수노 주소가 음원 파일이 아니라 페이지로 엽니다.";
    return;
  }
  audio.src = direct;
  audio.play().catch(() => { if (url) window.open(url, "_blank"); });
}

async function openItem(key) {
  const res = await fetch(`api.php?op=song&g=${encodeURIComponent(state.genre)}&k=${encodeURIComponent(key)}`);
  const data = await res.json();
  if (!data.ok) return alert(data.error || "열지 못했습니다.");
  drawResult(data.song, data.edit);
}

function field(name, value, edit) {
  const text = esc(value);
  if (!edit) {
    if (!String(value || "").trim() || name === "ytPremium" || name === "mvPremium") return "";
    return `<p><b class="mark">${labels[name] || name}</b><br><span class="who">${text.replaceAll("\n", "<br>")}</span></p>`;
  }
  if (name === "ytPremium" || name === "mvPremium") {
    return `<label>${labels[name]} <input type="checkbox" name="${name}" ${value === "1" ? "checked" : ""}></label>`;
  }
  if (longKey.test(name)) return `<label>${labels[name]}<textarea name="${name}" rows="6">${text}</textarea></label>`;
  return `<label>${labels[name] || name}<input name="${name}" value="${text}"></label>`;
}

function drawResult(song, edit) {
  const pane = $("result");
  pane.hidden = false;
  const fields = song.fields || {};
  const orig = song.original || {};
  const bits = [];
  if (orig.title) bits.push(`<p><b class="mark">원곡 제목</b><br>${esc(orig.title)}</p>`);
  if (orig.vocal) bits.push(`<p><b class="mark">원곡 보컬</b><br>${esc(orig.vocal)}</p>`);
  if (orig.lyrics) bits.push(`<p class="who"><b class="mark">원곡 가사</b><br>${esc(orig.lyrics).replaceAll("\n", "<br>")}</p>`);
  const names = song.kind === "act"
    ? ["youtubeTitle", "tracklist", "sunoStyle", "geminiPrompt", "thumbUrl", "youtubeDescription", "communityPost", "youtubeUrl", "mvUrl", "sunoUrl", "audioLevel", "audioAnalysis"]
    : ["confirmedTitle", "summary", "lyricsBlock", "sunoStyle", "geminiPrompt", "thumbUrl", "youtubeTitle", "youtubeDescription", "fanLetter", "youtubeUrl", "mvUrl", "sunoUrl", "audioLevel", "audioAnalysis", "ytPremium", "mvPremium"];
  const body = names.map((name) => field(name, fields[name] ?? "", edit)).join("");
  const yt = song.ytId ? `<div class="preview"><iframe src="https://www.youtube.com/embed/${song.ytId}" allowfullscreen></iframe></div>` : "";
  const thumb = !song.ytId && fields.thumbUrl ? `<div class="preview"><img src="${esc(fields.thumbUrl)}" alt=""></div>` : "";
  const tools = edit ? `<div class="tools">
      <button class="go" type="submit">파일에 저장</button>
      <button class="stop" type="button" id="move">다른 장르로 이동</button>
      <button class="stop" type="button" id="del">삭제</button>
    </div>` : "";
  pane.innerHTML = `<header><h1>${esc(song.title)}</h1><button class="stop" type="button" id="close">닫기</button></header>
    ${yt}${thumb}
    <form>${bits.join("")}${edit && song.kind !== "act" ? `<label>확정 <input type="checkbox" name="confirmed" ${song.confirmed ? "checked" : ""}></label>` : ""}${body}${tools}<p class="note" id="msg"></p></form>`;
  $("close").onclick = () => { pane.hidden = true; pane.innerHTML = ""; };
  if (!edit) return;
  pane.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    form.set("op", "save");
    form.set("g", song.genre);
    form.set("k", song.key);
    form.set("token", window.NOA.token);
    form.set("confirmed", event.target.confirmed?.checked ? "1" : "0");
    form.set("ytPremium", event.target.ytPremium?.checked ? "1" : "0");
    form.set("mvPremium", event.target.mvPremium?.checked ? "1" : "0");
    const res = await fetch("api.php", { method: "POST", body: form });
    const data = await res.json();
    $("msg").textContent = data.ok ? "파일에 저장했습니다." : (data.error || "저장하지 못했습니다.");
    if (data.ok) loadCatalog();
  };
  const ask = async (op) => {
    const form = new FormData();
    form.set("op", op);
    form.set("g", song.genre);
    form.set("k", song.key);
    form.set("token", window.NOA.token);
    if (op === "move") {
      const to = prompt("옮길 장르 아이디", "kpop-original");
      if (!to) return;
      form.set("to", to);
    } else if (!confirm("이 곡 파일을 삭제할까요?")) return;
    const res = await fetch("api.php", { method: "POST", body: form });
    const data = await res.json();
    if (!data.ok) return alert(data.error || "실패");
    pane.hidden = true;
    loadCatalog();
  };
  $("del").onclick = () => ask("delete");
  $("move").onclick = () => ask("move");
}

$("play").onclick = () => {
  const audio = $("audio");
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
};
loadCatalog().catch(() => { $("list").innerHTML = "<p class='note'>목록을 읽지 못했습니다.</p>"; });
