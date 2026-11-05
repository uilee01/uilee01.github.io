/* 图片注入 —— index.html 和 preview.html 都加载这个文件。
 *
 * 作用：把 copy.json 里 images 段配置的图片插到对应位置，并按真实比例撑开容器。
 *
 * 为什么不放在 edit-bridge.js 里：那个文件只在编辑器的预览页加载，
 * 直接打开 index.html 时不会执行，图片就全没了。
 *
 * 用法：copy.json → images: { "project.cutroom": "assets/img/xxx.png" }
 *      留空字符串 = 不插图片，保持页面原来的样子。
 */
(function () {
  'use strict';
  if (window.__COPY_IMAGES__) return;
  window.__COPY_IMAGES__ = true;

  // 图片位 → 宿主元素选择器。
  // 作品封面不再写死三个 id：凡是 images 里叫 project.xxx 的键，
  // 一律对应 .project-card.project-xxx .project-visual，新增项目自动生效。
  var BASE_SLOTS = { 'avatar': '.sculpture-wrap' };

  // 项目 id 直接进入 class（React 渲染成 class="project-card project-<id>"），
  // 而 id 里可能有空格或中文 —— 比如 "KEKE · IP 设计" 会被浏览器拆成
  // project-KEKE / · / IP / 设计 四个类，拼成 '.project-card.project-KEKE · IP 设计'
  // 这种选择器永远匹配不到，封面图就静默失效了。
  // 正确做法：按空白拆成 token，逐个当类名做复合匹配，并对每段转义。
  function cardSelector(id) {
    var tokens = String('project-' + id).split(/\s+/).filter(Boolean);
    var esc = (window.CSS && CSS.escape)
      ? function (s) { return CSS.escape(s); }
      : function (s) { return s.replace(/["\\]/g, '\\$&'); };
    return '.project-card.' + tokens.map(esc).join('.') + ' .project-visual';
  }

  function slots() {
    var out = {};
    Object.keys(BASE_SLOTS).forEach(function (k) { out[k] = BASE_SLOTS[k]; });
    var imgs = (window.__COPY__ || {}).images || {};
    Object.keys(imgs).forEach(function (k) {
      if (k.indexOf('project.') !== 0) return;
      var id = k.slice('project.'.length);
      if (!id) return;
      out[k] = cardSelector(id);
    });
    // 编辑器推送的临时配置里可能带着刚新增的作品位
    if (override) {
      Object.keys(override).forEach(function (k) {
        if (k.indexOf('project.') !== 0 || out[k]) return;
        var id = k.slice('project.'.length);
        if (id) out[k] = cardSelector(id);
      });
    }
    return out;
  }

  // 编辑器推送的临时配置（未保存也能立刻在预览里看到）
  var override = null;
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (m && m.type === 'copy-images' && m.images) {
      override = m.images;
      applyImages();
    }
  });

  // 实时同步用：编辑器改完直接换掉整套图片位配置并重贴
  window.__COPY_IMAGES_SET__ = function (imgs) {
    override = imgs || null;
    applyImages();
  };

  // 选了真图后，底下这些「假 UI」元素淡出，避免和真图叠在一起
  var FAKE_UI = '.mock-cover-app,.sculpture-button,.specimen-meta,.sculpture-hint,' +
                '.motion-controls,.mock-cover-label,.mock-cover-index';

  function getImages() {
    var c = window.__COPY__ || {};
    var base = c.images || {};
    // 编辑器会把「还没保存」的图片配置通过 postMessage 推过来，优先用它
    if (!override) return base;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(override).forEach(function (k) {
      if (k.charAt(0) !== '_') out[k] = override[k];
    });
    return out;
  }

  /* 首屏个人照片的尺寸：由 copy.json 的 avatarSize 控制（编辑器里无级拖动）。
   * lock=true  —— 只认宽度，高度按图片原始比例自动（用 aspect-ratio，窄屏也不会变形）
   * lock=false —— 宽高各自独立，比例不符时图片按 object-fit 居中显示
   *
   * 这里必须让 <img> 回到正常文档流：原来它是 absolute 铺满容器，
   * 而容器高度是被 .sculpture-button（那个雕塑 canvas）的 aspect-ratio 撑出来的，
   * 不回到文档流的话，调 img 尺寸根本改变不了容器高度。
   */
  function applyAvatarSize(host, img) {
    var size = (window.__COPY__ || {}).avatarSize;
    if (!size) return;

    // 容器别再限制高度，交给 img 自己撑
    host.style.maxHeight = '';
    host.style.height = '';
    host.style.aspectRatio = '';
    host.style.overflow = '';

    // 雕塑整套让位：canvas 带着 aspect-ratio 会把容器撑高，
    // 「形态研究 001」「点击雕塑切换形态」这些说明文字没了雕塑也就没意义，一起收掉，
    // 否则容器高度 = 照片 + 84px 残留文字，调高度看不出效果。
    hideSculpture(host, true);

    img.style.position = 'relative';
    img.style.inset = 'auto';
    img.style.zIndex = '5';
    img.style.display = 'block';
    img.style.margin = '0 auto';
    img.style.maxWidth = '100%';
    img.style.width = (size.w || img.naturalWidth || 320) + 'px';

    var nat = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0;
    if (size.lock && nat) {
      img.style.height = 'auto';
      img.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
    } else {
      img.style.aspectRatio = 'auto';
      img.style.height = size.h ? size.h + 'px' : 'auto';
    }
  }

  // 雕塑相关的一整套（canvas + 形态编号 + 提示 + 动效按钮）
  var SCULPTURE_UI = '.sculpture-button,.sculpture-index,.specimen-meta,.sculpture-hint,.motion-controls';

  function hideSculpture(host, on) {
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll(SCULPTURE_UI), function (n) {
      n.style.display = on ? 'none' : '';
    });
  }

  // 按图片真实宽高比调整容器，实现「完整显示、不裁切」
  function fitImage(host, img) {
    var nat = img.naturalWidth / img.naturalHeight;
    if (!nat || !isFinite(nat)) return;
    var w = host.clientWidth;
    if (!w) return;
    if (host.classList.contains('project-visual')) {
      host.style.aspectRatio = String(nat);
      host.style.height = 'auto';
    } else {
      host.style.maxHeight = Math.round(w / nat) + 'px';
      host.style.overflow = 'hidden';
    }
  }

  /* alt 控制在 125 字符内：太长反而影响可读性，部分引擎也会截断 */
  function clip(s) {
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > 120 ? s.slice(0, 117) + '…' : s;
  }

  /* alt 要写「这张图是什么」，不能写文件名或配置键名。
     键名（project.LKSY）对搜索引擎等于没写 —— 图片搜索和无障碍都读不到信息。
     这里按项目名 + 职责 + 标签拼一句描述。 */
  function altFor(slot) {
    var c = window.__COPY__ || {};
    var lang = document.documentElement.lang === 'en' ? 'en' : 'cn';
    if (slot === 'avatar') {
      var n = (c.ui && c.ui[lang] && c.ui[lang].name) || '';
      if (n) return lang === 'en' ? (n + ' — profile photo') : (n + ' 的个人照片');
      return lang === 'en' ? 'Profile photo' : '个人照片';
    }
    if (slot.indexOf('project.') !== 0) return slot;
    var id = slot.slice('project.'.length);
    if (!id) return slot;
    var ps = (c.projects || {})[lang] || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (!p || p.id !== id) continue;
      var bits = [];
      if (p.name) bits.push(p.name);
      // role 字段有时是一整段散文，太长就不进 alt
      if (p.role && p.role.length <= 30) bits.push(p.role);
      if (p.tags && p.tags.length) bits.push(p.tags.slice(0, 5).join(' / '));
      var tail = lang === 'en' ? ' — UI case' : ' — 项目界面';
      return clip((bits.length ? bits.join(' · ') : id) + tail);
    }
    return id;
  }

  function applyImages() {
    var imgs = getImages();
    var SLOTS = slots();
    Object.keys(SLOTS).forEach(function (slot) {
      var rel = imgs[slot];
      var host = document.querySelector(SLOTS[slot]);
      if (!host) return;

      // 配置被清空了 → 把之前插入的图撤掉，恢复原样
      if (!rel) {
        var old = host.querySelector('img[data-injected]');
        if (old) old.remove();
        host.style.aspectRatio = '';
        host.style.height = '';
        host.style.maxHeight = '';
        host.style.overflow = '';
        hideSculpture(host, false);
        Array.prototype.forEach.call(host.querySelectorAll(FAKE_UI), function (n) {
          n.style.opacity = '';
        });
        return;
      }

      var img = host.querySelector('img[data-injected]');
      if (!img) {
        img = document.createElement('img');
        img.alt = altFor(slot);
        img.setAttribute('data-injected', '1');
        img.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;' +
          'z-index:5;display:block;background:#0b0b0d';
        host.style.position = 'relative';
        host.appendChild(img);
        Array.prototype.forEach.call(host.querySelectorAll(FAKE_UI), function (n) {
          n.style.opacity = '.12';
          n.style.transition = 'opacity .3s';
        });
        img.addEventListener('load', function () {
          if (slot === 'avatar' && (window.__COPY__ || {}).avatarSize) applyAvatarSize(host, img);
          else fitImage(host, img);
        });
        img.addEventListener('error', function () {
          img.style.background = '#3a1f22';
          img.alt = '图片加载失败：' + rel;
        });
      }
      if (img.getAttribute('src') !== rel) img.setAttribute('src', rel);
      // 命中缓存时 load 不会再触发，主动量一次
      if (slot === 'avatar' && (window.__COPY__ || {}).avatarSize) {
        applyAvatarSize(host, img);
      } else if (img.complete && img.naturalWidth) {
        fitImage(host, img);
      }
    });
  }

  /* ---- 等 React 渲染完再插；SPA 后续重渲染要补 ---- */
  function ready() {
    return !!document.querySelector('.hero, .project-visual, #root > *');
  }

  function kick() {
    var t0 = Date.now();
    (function tick() {
      if ((ready() && window.__COPY__) || Date.now() - t0 > 8000) {
        applyImages();
        return;
      }
      setTimeout(tick, 120);
    })();
  }

  function boot() {
    kick();
    window.addEventListener('load', function () { setTimeout(applyImages, 400); });
    if (window.MutationObserver && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(applyImages, 400);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();