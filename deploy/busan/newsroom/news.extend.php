<?php
if (!defined('_GNUBOARD_') || (defined('G5_IS_ADMIN') && G5_IS_ADMIN)) return;

function busan_news_home_strip() {
    if (!defined('_INDEX_') || !_INDEX_) return;
    $root = G5_URL . '/busan-assistant/newsroom';
    $board_url = G5_BBS_URL . '/board.php?bo_table=busan_news';
    ?>
    <template id="bn-news-template">
      <section id="bn-news-strip" aria-label="최근 한 달 챗지기자 뉴스" data-feed="<?=htmlspecialchars($root.'/recent.php', ENT_QUOTES)?>">
        <a class="bn-news-brand" href="<?=htmlspecialchars($board_url, ENT_QUOTES)?>">챗지기자</a>
        <div class="bn-news-window"><a class="bn-news-link" href="<?=htmlspecialchars($board_url, ENT_QUOTES)?>"><span>최근 한 달 뉴스 보기</span></a></div>
        <button type="button" class="bn-news-pause" aria-label="뉴스 흐름 일시정지" title="뉴스 흐름 일시정지">Ⅱ</button>
        <a class="bn-news-all" href="<?=htmlspecialchars($board_url, ENT_QUOTES)?>" aria-label="뉴스 전체보기">전체보기</a>
      </section>
    </template>
    <script src="<?=htmlspecialchars($root.'/ticker.js?v=1', ENT_QUOTES)?>" defer></script>
    <?php
}
add_stylesheet('<link rel="stylesheet" href="'.G5_URL.'/busan-assistant/newsroom/news.css?v=1">', 115);
add_event('tail_sub', 'busan_news_home_strip');
