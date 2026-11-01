/* 作品列表瀑布流（masonry）—— index.html 和 preview.html 都加载。
 *
 * 作用：让卡片按自身高度紧挨着排，矮的卡片下面不再被同行的高卡片顶出一截空白。
 *
 * 原理：
 *   原来是 grid-template-columns:1fr 1fr + 默认行高，行高取该行最高的那张卡，
 *   于是矮的那张被 stretch 拉满整行 —— 就是「田字格」。
 *   这里把行切成 4px 的细行（grid-auto-rows），再按每张卡的真实内容高度
 *   换算成 span 多少行。行间距 row-gap 置 0、改由 span 里额外补一段高度来模拟，
 *   否则 52px 的 gap 会把行的粒度撑粗到 60px，对不齐。
 *
 * 为什么不用 columns / grid-template-rows:masonry：
 *   columns 是按列灌的，阅读顺序会变成竖向（1 2 3 在左列），作品集不能这么排；
 *   masonry 语法目前只有 Firefox 实验支持。这套 grid + span 能保持横向阅读顺序。
 *
 * 不改 CSS：所有改动都在 JS 里做，脚本没跑起来时自然退回原来的田字格。
 */
(function () {
  'use strict';
  if (window.__COPY_MASONRY__) return;
  window.__COPY_MASONRY__ = true;

  var ROW = 4; // 细行高。越小越贴合，4px 的误差肉眼看不出来

  function gridEl() { return document.querySelector('.project-grid'); }
  function isSingleColumn(cols) { return String(cols).split(' ').filter(Boolean).length < 2; }

  var raf = 0;
  function schedule() {
    if (raf) return;
    raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () {
      raf = 0;
      layout();
    });
  }

  function layout() {
    var g = gridEl();
    if (!g) return;
    var items = [].slice.call(g.children).filter(function (n) { return n.nodeType === 1; });
    if (!items.length) return;

    // 先还原 row-gap 再读，才能拿到 CSS 里写的真实值（桌面 52 / 移动 40）
    g.style.rowGap = '';
    var gap = parseFloat(getComputedStyle(g).rowGap) || 0;
    var cols = getComputedStyle(g).gridTemplateColumns;

    // 单列时每项本来就占满一行，不需要瀑布流
    if (isSingleColumn(cols)) {
      g.style.gridAutoRows = '';
      g.style.alignItems = '';
      g.style.marginBottom = '';
      items.forEach(function (it) { it.style.gridRowEnd = ''; });
      return;
    }

    g.style.rowGap = '0px';
    g.style.gridAutoRows = ROW + 'px';
    g.style.alignItems = 'start';

    items.forEach(function (it) {
      // 量内容高度：卡片被拉伸时 button 不会被拉伸，所以量它是安全的
      var inner = it.firstElementChild || it;
      var h = inner.getBoundingClientRect().height;
      if (!h) return;
      it.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((h + gap) / ROW));
    });

    // 最后一张卡多补的那段 gap 会让列表底部空一截，抵掉
    g.style.marginBottom = (-gap) + 'px';
  }

  /* ---- 内容高度变了就重排：封面图加载完改了 aspect-ratio、文案长短变化、窗口缩放换行 ---- */
  var ro = null;
  function observeAll() {
    if (!window.ResizeObserver) return;
    if (!ro) {
      ro = new ResizeObserver(function () { schedule(); });
    }
    ro.disconnect();
    var g = gridEl();
    if (!g) return;
    [].slice.call(g.children).forEach(function (it) {
      var inner = it.firstElementChild || it;
      ro.observe(inner);
    });
  }

  function boot() {
    layout();
    observeAll();

    if (window.MutationObserver && document.body) {
      var mo = new MutationObserver(function () { schedule(); observeAll(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('load', function () { schedule(); });
    // 图片是 JS 注入的，load 时机不确定，兜几个时间点
    [300, 800, 1600].forEach(function (t) { setTimeout(schedule, t); });
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
