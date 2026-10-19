<?php
if (!defined('_GNUBOARD_')) {
    exit;
}
add_stylesheet('<link rel="stylesheet" href="' . G5_THEME_URL . '/css/studio.css">', 0);
$faces = G5_THEME_URL . '/img';
?>
<div class="noa-wrap">
  <header class="noa-top">
    <div class="noa-faces">
      <img src="<?php echo $faces; ?>/noa-face.jpg" alt="NOA">
      <img src="<?php echo $faces; ?>/noel-face.jpg" alt="NOEL">
    </div>
    <div>
      <div class="noa-kicker">NOA STUDIO</div>
      <h1>PC 음악 서재</h1>
      <p class="noa-note">이 화면은 닷홈 MySQL에 이관된 곡만 보여 줍니다. 이관 전에는 곡을 만들어 표시하지 않습니다.</p>
    </div>
  </header>
  <div id="noa-genres" class="noa-list"></div>
  <div id="noa-songs" class="noa-songs"></div>
</div>
<script>
(function () {
  var genres = document.getElementById("noa-genres");
  var songs = document.getElementById("noa-songs");
  function fail(text) {
    genres.innerHTML = '<p class="noa-empty">' + text + '</p>';
  }
  fetch("/noa-api/index.php?op=genres", { credentials: "same-origin" })
    .then(function (res) { return res.json(); })
    .then(function (body) {
      var rows = body && body.genres ? body.genres : [];
      if (!rows.length) {
        fail("아직 이관된 곡이 없습니다. 기존 1.0 데이터는 그대로 보존되어 있습니다.");
        return;
      }
      var seen = {};
      rows.forEach(function (row) {
        if (seen[row.genreId]) {
          seen[row.genreId] += row.count;
        } else {
          seen[row.genreId] = row.count;
        }
      });
      Object.keys(seen).forEach(function (id) {
        var button = document.createElement("button");
        button.type = "button";
        button.innerHTML = "<strong>" + id + "</strong>" + seen[id] + "개";
        button.addEventListener("click", function () { loadSongs(id); });
        genres.appendChild(button);
      });
    })
    .catch(function () { fail("공통 API에 연결하지 못했습니다."); });
  function loadSongs(id) {
    songs.innerHTML = "";
    fetch("/noa-api/index.php?op=songs&genre=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (body) {
        (body.songs || []).forEach(function (song) {
          var link = document.createElement("a");
          link.href = "/noa-api/index.php?op=song&key=" + encodeURIComponent(song.key);
          link.textContent = (song.ep ? song.ep + "  " : "") + song.title;
          songs.appendChild(link);
        });
      });
  }
})();
</script>
