/* 离开第一屏后，右下角出现「返回顶部」。
   独立于 React bundle：滚动时重新查询 #top，语言切换重渲染也不会失效。 */
(function () {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'back-to-top';
  btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>';
  document.body.appendChild(btn);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function label() {
    var active = document.querySelector('.locale-button .locale-active');
    var en = active && active.textContent.trim() === 'EN';
    var text = en ? 'Back to top' : '返回顶部';
    btn.setAttribute('aria-label', text);
    btn.title = text;
  }

  function visible() {
    var hero = document.getElementById('top');
    if (!hero) return window.scrollY > window.innerHeight * 0.6;
    // 第一屏完全离开视口后才出现
    return hero.getBoundingClientRect().bottom <= 0;
  }

  var ticking = false;
  function update() {
    ticking = false;
    label();
    btn.classList.toggle('is-visible', visible());
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
  // React 首屏渲染完成前 #top 可能还不存在，挂载后补一次
  window.addEventListener('load', update);
})();
