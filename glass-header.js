/* 顶部导航抽屉：向上滚出现（液态玻璃），向下滚收起；首屏保持原始透明常态。
   状态挂在 <html> 上，React 语言切换重渲染不会冲掉。 */
(function () {
  var root = document.documentElement;
  var TOP_ZONE = 96;     // 首屏安全区：滚回这里恢复常态
  var DELTA = 4;         // 忽略微小滚动，避免触控板抖动
  var last = window.scrollY || 0;
  var ticking = false;
  var suppressUntil = 0;

  // 切换语言时 React 重渲染会改变页面高度并触发补偿滚动，
  // 那不是用户的滚动意图 —— 短窗口内只更新基准、不判定方向。
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.locale-button')) {
      suppressUntil = Date.now() + 800;
    }
  }, true);

  function apply() {
    ticking = false;
    var y = window.scrollY || 0;
    var dy = y - last;
    last = y;

    // 回到首屏是明确状态，优先处理，不受语言切换抑制窗口影响，
    // 否则「切完语言立刻回顶」会把玻璃态留在首屏。
    if (y <= TOP_ZONE) {
      root.classList.remove('header-hidden', 'header-glass');
      return;
    }
    if (Date.now() < suppressUntil) return;

    root.classList.add('header-glass');                            // 离开首屏即披上玻璃材质
    if (dy > DELTA) root.classList.add('header-hidden');           // 下滚：抽屉收起
    else if (dy < -DELTA) root.classList.remove('header-hidden');  // 上滚：抽屉滑入
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  apply();
  window.addEventListener('load', function () { last = window.scrollY || 0; apply(); });
})();
