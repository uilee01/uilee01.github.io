/* 案例详情页的「展示图集」—— index.html 和 preview.html 都加载。
 *
 * copy.json → gallery: {
 *   "cutroom": { "layout":"stage", "items":[ {src, caption}, … ] }
 * }
 *
 * layout = stage     ：上方大图 + 下方缩略图导航，点缩略图（或左右箭头）切换大图
 * layout = waterfall ：瀑布流，点任意一张开灯箱看大图
 *
 * 图集插在案例弹层里「交互切片」标题之前。项目没有配图就不插，页面保持原样。
 */
(function () {
  'use strict';
  if (window.__COPY_GALLERY__) return;
  window.__COPY_GALLERY__ = true;

  var cur = { id: null, index: 0 };   // 当前图集状态，切换项目时重置
  var override = null;               // 编辑器推过来的「还没保存」的图集配置

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (m && m.type === 'copy-gallery' && m.gallery) { override = m.gallery; sync(true); }
  });

  // 实时同步用：换掉整套图集配置并重建
  // 重建时保留当前浏览到第几张 —— 实时同步每次编辑都会重建图集，
  // 不保留的话用户正看着第 3 张，一改文案就被弹回第 1 张。
  window.__COPY_GALLERY_SET__ = function (g) {
    override = g || null;
    sync(true);
  };

  function copy() { return window.__COPY__ || {}; }
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'cn'; }

  function galleryOf(id) {
    var g = (override || copy().gallery || {});
    return g[id] || null;
  }

  // 弹层里的 <div class="project-demo demo-cutroom"> 直接带出项目 id
  function activeId() {
    var dlg = document.querySelector('.case-dialog');
    if (!dlg) return null;
    // 最准：标题上的 data-project
    var tagged = dlg.querySelector('[data-project]');
    if (tagged && tagged.getAttribute('data-project')) return tagged.getAttribute('data-project');
    // 兼容：交互切片的 class（demo-<id>）
    var demo = dlg.querySelector('.project-demo');
    if (demo) {
      var m = /(?:^|\s)demo-([A-Za-z0-9_-]+)/.exec(demo.className);
      if (m) return m[1];
    }
    // 兜底：拿 kicker（项目名 / 编号）去 projects 里比对
    var ps = (copy().projects || {})[lang()] || [];
    var k = dlg.querySelector('.dialog-content .section-kicker');
    if (k) {
      var kt = (k.textContent || '').trim();
      for (var i = 0; i < ps.length; i++) if (ps[i].name && kt.indexOf(ps[i].name) >= 0) return ps[i].id;
    }
    var t = dlg.querySelector('#case-title');
    if (t) {
      var txt = (t.textContent || '').trim();
      for (var j = 0; j < ps.length; j++) if (ps[j].name && txt.indexOf(ps[j].name) >= 0) return ps[j].id;
    }
    return null;
  }

  /* ---------- 灯箱（整页共用一个） ----------
   *
   * 为什么必须是原生 <dialog>：
   * 案例弹层是 dialog.showModal() 打开的，它待在浏览器的 top layer（顶层）里，
   * 而 top layer 里的元素永远盖在所有 z-index 之上 —— 普通 div 再大的 z-index 也压不过它。
   * 所以灯箱也得用 showModal()，后开的模态 dialog 会叠在先开的那个上面。
   */
  /* 缩放基准：lbView.zoom 是「相对图片原始像素」的倍率，1 = 100% = 原始像素。
   *
   * 为什么不用 transform: scale 了：
   * transform 不改变布局尺寸，图片放大后容器不会产生滚动条，
   * 超出视窗的部分只能被裁掉 —— 没法往下滚着看。
   * 改成直接设 img 的真实宽高，让 stage 用 overflow:auto 滚。
   */
  var lbView = { zoom: 1 };
  var LB_MIN = 0.1, LB_MAX = 8;

  function lightbox() {
    var lb = document.getElementById('galLightbox');
    if (lb) return lb;
    lb = document.createElement('dialog');
    lb.id = 'galLightbox';
    lb.className = 'gal-lightbox';
    lb.setAttribute('aria-label', '图片查看器');
    lb.innerHTML =
      '<figure class="gal-lb-figure">' +
        '<div class="gal-lb-stage"><img alt="" draggable="false"></div>' +
        '<figcaption></figcaption>' +
      '</figure>' +
      '<button class="gal-lb-close" type="button" aria-label="关闭">✕</button>' +
      '<button class="gal-lb-nav prev" type="button" aria-label="上一张">‹</button>' +
      '<button class="gal-lb-nav next" type="button" aria-label="下一张">›</button>' +
      '<div class="gal-lb-toolbar">' +
        '<button type="button" data-act="out" title="缩小" aria-label="缩小">−</button>' +
        '<span class="gal-lb-scale">100%</span>' +
        '<button type="button" data-act="in" title="放大" aria-label="放大">+</button>' +
        '<button type="button" data-act="fit" title="适应窗口">适应</button>' +
        '<button type="button" data-act="actual" title="原始像素">1:1</button>' +
        '<span class="gal-lb-count"></span>' +
      '</div>';
    document.body.appendChild(lb);
    bindLightbox(lb);
    return lb;
  }

  /* ---------- 缩放 / 平移 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function lbOf() { return document.getElementById('galLightbox'); }
  function lbImg() { var l = lbOf(); return l ? l.querySelector('.gal-lb-figure img') : null; }
  function lbStage() { var l = lbOf(); return l ? l.querySelector('.gal-lb-stage') : null; }

  // 把当前倍率刷到 DOM 上：直接改图片真实宽高，让容器自己出滚动条
  function paintView() {
    var lb = lbOf(), img = lbImg(), st = lbStage();
    if (!img) return;
    if (img.naturalWidth) {
      img.style.width = Math.max(1, Math.round(img.naturalWidth * lbView.zoom)) + 'px';
      img.style.height = 'auto';
    }
    var sc = lb && lb.querySelector('.gal-lb-scale');
    if (sc) sc.textContent = Math.round(lbView.zoom * 100) + '%';
    // 内容比容器大 → 可以拖着看
    if (st) {
      var over = img.offsetWidth > st.clientWidth + 1 || img.offsetHeight > st.clientHeight + 1;
      st.classList.toggle('is-pan-able', over);
    }
  }

  function resetView() {
    lbView.zoom = 1;
    paintView();
  }

  function centerPoint() {
    var st = lbStage();
    if (!st) return { x: 0, y: 0 };
    var R = st.getBoundingClientRect();
    return { x: (R.left + R.right) / 2, y: (R.top + R.bottom) / 2 };
  }

  // 装进容器所需的倍率（图片比容器小时返回 1，不做无谓放大）
  function fitScale() {
    var img = lbImg(), st = lbStage();
    if (!img || !st || !img.naturalWidth || !img.naturalHeight) return 1;
    var r = st.getBoundingClientRect();
    if (!r.width || !r.height) return 1;
    return Math.min(1, r.width / img.naturalWidth, r.height / img.naturalHeight);
  }

  // 设倍率，并把 (anchorX, anchorY) 这个屏幕点下的画面内容保持不动
  function setZoom(z, anchorX, anchorY) {
    var img = lbImg(), st = lbStage();
    if (!img || !st) return;
    var nz = clamp(z, LB_MIN, LB_MAX);
    if (Math.abs(nz - lbView.zoom) < 1e-4) return;
    var ir = img.getBoundingClientRect();
    var rx = ir.width ? (anchorX - ir.left) / ir.width : 0.5;
    var ry = ir.height ? (anchorY - ir.top) / ir.height : 0.5;
    lbView.zoom = nz;
    paintView();
    // 尺寸变了，重新量一次，用滚动量把同一个画面点挪回光标下
    var ir2 = img.getBoundingClientRect();
    st.scrollLeft += (anchorX - rx * ir2.width) - ir2.left;
    st.scrollTop += (anchorY - ry * ir2.height) - ir2.top;
  }

  function zoomBy(factor, x, y) { setZoom(lbView.zoom * factor, x, y); }
  function zoomCenter(factor) { var c = centerPoint(); zoomBy(factor, c.x, c.y); }

  // 原始像素（1:1 = 100%）
  function actualSize() {
    var c = centerPoint();
    setZoom(1, c.x, c.y);
  }

  // 适应窗口
  function fitToWindow() {
    var c = centerPoint();
    setZoom(fitScale(), c.x, c.y);
  }

  // 单击图片：适应窗口 ↔ 100% 原始像素
  function toggleZoom() {
    if (Math.abs(lbView.zoom - fitScale()) < 0.02) actualSize();
    else fitToWindow();
  }

  function pinchInfo(pts) {
    var ids = Object.keys(pts);
    if (ids.length < 2) return null;
    var a = pts[ids[0]], b = pts[ids[1]];
    return {
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      dist: Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))
    };
  }

  function bindLightbox(lb) {
    var img = lb.querySelector('.gal-lb-figure img');
    var stage = lb.querySelector('.gal-lb-stage');

    lb.querySelector('.gal-lb-close').addEventListener('click', function (e) { e.stopPropagation(); closeLb(); });
    lb.querySelector('.gal-lb-nav.prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    lb.querySelector('.gal-lb-nav.next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });

    lb.querySelector('.gal-lb-toolbar').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!b) return;
      e.stopPropagation();
      var act = b.getAttribute('data-act');
      if (act === 'in') zoomCenter(1.5);
      else if (act === 'out') zoomCenter(1 / 1.5);
      else if (act === 'fit') fitToWindow();
      else if (act === 'actual') actualSize();
    });

    /* 点击判定不走 click 事件。
     *
     * 为什么：stage 上做了 setPointerCapture（拖拽平移要它），
     * 一旦捕获指针，后续的 click 事件会被重定向到 stage —— img 上挂的 click
     * 收不到，而 stage 上的关闭判断看到 target===stage 就把灯箱关了。
     * （表现：单击图片灯箱直接消失，怎么点都没反应。）
     *
     * 所以改成：pointerdown 时记下原始 target，pointerup 时用它判断
     * 「点在图上」还是「点在空白上」。
     */
    var down = null;          // {x, y, target, moved}
    var tapTimer = null;      // 单击/双击的区分

    // 点空白处关闭；点图片 = 适应/放大 切换；双击图片 = 原始像素
    stage.addEventListener('pointerup', function (e) {
      var d = down;
      down = null;
      if (!d || d.moved) return;              // 拖过了，不算点击
      if (d.target !== img) { closeLb(); return; }
      if (tapTimer) {                          // 第二次点 → 双击
        clearTimeout(tapTimer);
        tapTimer = null;
        actualSize();
        return;
      }
      tapTimer = setTimeout(function () {
        tapTimer = null;
        toggleZoom();
      }, 240);
    });

    // 滚轮：默认滚动（看超出的部分），按住 Ctrl / ⌘ 才缩放
    // 图片按 100% 打开时通常会超出视窗，这时候滚轮最该做的是往下看。
    stage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    }, { passive: false });

    // 拖拽平移（滚容器）/ 双指捏合缩放
    var pts = {}, pinch = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      down = {
        x: e.clientX, y: e.clientY, target: e.target, moved: false,
        sl: stage.scrollLeft, st: stage.scrollTop
      };
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      if (Object.keys(pts).length === 2) pinch = pinchInfo(pts);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var old = pts[e.pointerId];
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2 && pinch) {
        var now = pinchInfo(pts);
        if (pinch.dist > 0 && now.dist > 0) {
          setZoom(lbView.zoom * (now.dist / pinch.dist), now.x, now.y);
          stage.scrollLeft -= now.x - pinch.x;
          stage.scrollTop -= now.y - pinch.y;
        }
        pinch = now;
        if (down) down.moved = true;
        return;
      }
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) down.moved = true;
      if (!down.moved) return;
      // 内容跟着手走：手往右移，滚动位置往回退
      stage.scrollLeft = down.sl - dx;
      stage.scrollTop = down.st - dy;
    });
    function endPtr(e) {
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
    }
    stage.addEventListener('pointercancel', endPtr);

    // 键盘：Esc 交给原生 dialog（会触发 cancel 事件）
    document.addEventListener('keydown', function (e) {
      var l2 = document.getElementById('galLightbox');
      if (!l2 || !l2.open) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomCenter(1.3); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomCenter(1 / 1.3); }
      else if (e.key === '0') { e.preventDefault(); actualSize(); }
      else if (e.key === '9') { e.preventDefault(); fitToWindow(); }
    });

    // Esc 关键处理：灯箱是套在案例弹层之上的第二个 modal dialog。
    // 浏览器的 close-watcher 机制在关闭顶层 dialog 时，会把 Esc 继续往下传给
    // 下层那个弹层 —— 结果两个一起关掉。
    // 在 cancel 事件上 preventDefault() 拦不住（那是浏览器内部的下传，不看事件取消）。
    // 真正的拦截点是 keydown 的默认行为：dialog 的「Esc 关闭」是按键的默认动作，
    // 在捕获阶段 preventDefault 掉按键，cancel 就不会产生，Esc 也就不会下传。
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var l2 = document.getElementById('galLightbox');
      if (!l2 || !l2.open) return;          // 灯箱没开 → 交给原生，去关案例弹层
      e.preventDefault();
      e.stopPropagation();
      closeLb();
    }, true);

    // 兜底：万一 cancel 还是来了，阻止它继续往下传
    lb.addEventListener('cancel', function (e) {
      e.preventDefault();
      if (lb.open) closeLb();
    });

    lb.addEventListener('close', function () { resetView(); });
  }

  var lbItems = [];
  function openLb(items, i) { lbItems = items; showLb(i); }
  function showLb(i) {
    if (!lbItems.length) return;
    var n = lbItems.length;
    var idx = ((i % n) + n) % n;
    var lb = lightbox();
    var img = lb.querySelector('.gal-lb-figure img');
    var cnt = lb.querySelector('.gal-lb-count');
    // 默认 100% 原始像素：不自动缩小去适应窗口，超出视窗的下半部分靠滚动看
    lbView.zoom = 1;
    img.style.width = '';
    img.style.height = '';
    // 图片是异步加载的，naturalWidth 要等 load 才知道
    img.onload = function () { paintView(); };
    img.src = lbItems[idx].src || '';
    img.alt = lbItems[idx].caption || '';
    lb.querySelector('figcaption').textContent = lbItems[idx].caption || '';
    if (cnt) cnt.textContent = (idx + 1) + ' / ' + n;
    lb.dataset.index = String(idx);
    paintView();           // 命中缓存时这里就能直接定型；否则等 onload();
    // showModal 才能进 top layer，盖住案例弹层
    if (!lb.open) { try { lb.showModal(); } catch (err) { lb.setAttribute('open', ''); } }
  }
  function step(d) { showLb(Number(lightbox().dataset.index || 0) + d); }
  function closeLb() {
    var lb = document.getElementById('galLightbox');
    if (!lb) return;
    if (lb.open) { try { lb.close(); } catch (err) { lb.removeAttribute('open'); } }
    else lb.removeAttribute('open');
    resetView();
  }

  /* ---------- 构建图集 DOM ---------- */
  function build(id, g) {
    var items = (g.items || []).filter(function (it) {
      return it && (it.src || inPreview());
    });
    var layout = g.layout === 'waterfall' ? 'waterfall' : 'stage';

    var sec = document.createElement('section');
    sec.className = 'case-gallery';
    sec.setAttribute('data-gallery-for', id);
    sec.setAttribute('data-layout', layout);
    sec.setAttribute('data-sig', sig(g));

    var ui = (copy().ui || {})[lang()] || {};
    var head = document.createElement('div');
    head.className = 'gal-head';
    head.innerHTML = '<span class="gal-kicker"></span><span class="gal-meta"></span>';
    head.querySelector('.gal-kicker').textContent = ui.galleryTitle || '作品图集';
    head.querySelector('.gal-meta').textContent = layout === 'stage'
      ? '01 / ' + pad(items.length)
      : pad(items.length) + ' 张';
    sec.appendChild(head);

    if (ui.galleryHint) {
      var hint = document.createElement('p');
      hint.className = 'gal-hint';
      hint.textContent = ui.galleryHint;
      sec.appendChild(hint);
    }

    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'gal-empty';
      empty.textContent = '这个案例还没有配图（在编辑器左侧「案例图集」里加）';
      sec.appendChild(empty);
      return sec;
    }

    if (layout === 'waterfall') {
      var wf = document.createElement('div');
      wf.className = 'gal-waterfall';
      items.forEach(function (it, i) {
        var fig = document.createElement('figure');
        fig.className = 'gal-cell';
        fig.setAttribute('data-gal-index', String(i));
        fig.innerHTML = '<img alt=""><figcaption></figcaption>';
        var im = fig.querySelector('img');
        im.src = it.src || '';
        im.alt = it.caption || '';
        im.addEventListener('click', function () { openLb(items, i); });
        fig.querySelector('figcaption').textContent = it.caption || '';
        if (!it.caption) fig.querySelector('figcaption').style.display = 'none';
        wf.appendChild(fig);
      });
      sec.appendChild(wf);
      bindPreview(sec, id);
      return sec;
    }

    // ---- stage：上大图 + 下缩略图导航 ----
    var stage = document.createElement('div');
    stage.className = 'gal-stage';
    stage.innerHTML =
      '<div class="gal-viewport"><img class="gal-big" alt=""></div>' +
      '<button class="gal-nav prev" type="button" aria-label="上一张">‹</button>' +
      '<button class="gal-nav next" type="button" aria-label="下一张">›</button>';

    var big = stage.querySelector('.gal-big');
    stage.querySelector('.gal-nav.prev').addEventListener('click', function () { pick(id, -1); });
    stage.querySelector('.gal-nav.next').addEventListener('click', function () { pick(id, 1); });
    big.addEventListener('click', function () { openLb(items, cur.index); });
    sec.appendChild(stage);

    var cap = document.createElement('p');
    cap.className = 'gal-caption';
    sec.appendChild(cap);

    var strip = document.createElement('div');
    strip.className = 'gal-strip';
    items.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gal-thumb';
      b.setAttribute('data-gal-index', String(i));
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 张');
      var im = document.createElement('img');
      im.src = it.src || '';
      im.alt = it.caption || '';
      b.appendChild(im);
      b.addEventListener('click', function () { pick(id, 0, i); });
      strip.appendChild(b);
    });
    sec.appendChild(strip);

    bindPreview(sec, id);
    return sec;
  }

  // 切换大图：d 为偏移量，abs 给了就直接跳到那张
  function pick(id, d, abs) {
    var g = galleryOf(id);
    if (!g) return;
    var items = g.items || [];
    if (!items.length) return;
    var i = typeof abs === 'number' ? abs : cur.index + d;
    var n = items.length;
    render(id, ((i % n) + n) % n);
  }

  function render(id, i, node) {
    var sec = node || document.querySelector('.case-gallery[data-gallery-for="' + id + '"]');
    var g = galleryOf(id);
    if (!sec || !g) return;
    var items = g.items || [];
    if (!items.length) return;
    var n = items.length;
    cur.id = id; cur.index = i;

    var big = sec.querySelector('.gal-big');
    if (big && big.getAttribute('src') !== (items[i].src || '')) big.setAttribute('src', items[i].src || '');
    var cap = sec.querySelector('.gal-caption');
    if (cap) {
      cap.textContent = items[i].caption || '';
      cap.style.display = items[i].caption ? '' : 'none';
    }
    var meta = sec.querySelector('.gal-meta');
    if (meta) meta.textContent = pad(i + 1) + ' / ' + pad(n);
    Array.prototype.forEach.call(sec.querySelectorAll('.gal-thumb'), function (b, k) {
      b.classList.toggle('is-on', k === i);
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function inPreview() {
    try { return window.parent !== window; } catch (e) { return false; }
  }

  // 预览里点图 → 通知编辑器打开对应的图集编辑面板
  function bindPreview(sec, id) {
    if (!inPreview()) return;
    sec.addEventListener('click', function (e) {
      var hit = e.target.closest ? e.target.closest('[data-gal-index]') : null;
      if (!hit) return;
      try {
        window.parent.postMessage({
          type: 'edit-gal', id: id, index: Number(hit.getAttribute('data-gal-index'))
        }, '*');
      } catch (err) { /* 忽略 */ }
    });
  }

  /* ---------- 挂载 / 同步 ---------- */
  function sync(force) {
    var dlg = document.querySelector('.case-dialog');
    if (!dlg) { cur.id = null; return; }
    var content = dlg.querySelector('.dialog-content');
    if (!content) return;

    var id = activeId();
    if (!id) return;

    var g = galleryOf(id);
    var old = content.querySelector('.case-gallery');

    if (!g || !(g.items || []).length) {
      if (old) old.remove();
      return;
    }
    if (!force && old && old.getAttribute('data-gallery-for') === id && !stale(old, g)) return;
    if (old) old.remove();
    // 同一项目重建时，记住原来浏览到第几张
    var sameProject = (cur.id === id);
    var keepAt = sameProject ? cur.index : 0;
    if (!sameProject) { cur.id = id; cur.index = 0; }

    // 插入位置：优先放在「交互切片」之前；那块被关掉时，退到「问题 / 我的取舍」之前；
    // 都没有就插到弹层最前面。
    var anchor = content.querySelector('.case-demo-heading') ||
                 content.querySelector('.project-demo') ||
                 content.querySelector('.case-columns');
    var sec = build(id, g);
    if (anchor) content.insertBefore(sec, anchor);
    else content.insertBefore(sec, content.firstChild);
    render(id, keepAt, sec);
  }

  // 图集内容变了（增删换图）就重建
  function stale(sec, g) {
    return sec.getAttribute('data-sig') !== sig(g);
  }
  function sig(g) {
    return (g.layout || 'stage') + '|' + (g.items || []).map(function (it) {
      return (it.src || '') + '~' + (it.caption || '');
    }).join('|');
  }

  var busy = false;
  function onMutate() {
    if (busy) return;
    busy = true;
    try { sync(false); } finally { busy = false; }
  }

  function boot() {
    var t = null;
    if (window.MutationObserver && document.body) {
      new MutationObserver(function () {
        clearTimeout(t); t = setTimeout(onMutate, 250);
      }).observe(document.body, { childList: true, subtree: true });
    }
    // 案例弹层是点开才渲染的，兜个轮询，别只靠 MutationObserver
    setInterval(onMutate, 600);
    onMutate();
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
