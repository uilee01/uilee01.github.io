/* 屏蔽字段 —— 让任意文案字段可以在页面上「完全不显示」，且不占任何空间。
 *
 * 数据来源：copy.json 顶层 hidden 数组（语言无关的中性键）：
 *   ui.<key>              界面文案（cn / en 一起生效）
 *   ui.<key>[i]           界面文案里的第 i 项（数组类字段可用）
 *   project.<id>.<field>  某个项目的某个字段
 *   project.<id>          整个项目
 *
 * 为什么不用改打包文件：
 *   项目字段的位置是固定的（卡片 class 名 + 案例弹层结构），可以直接写 CSS 规则，
 *   React 重渲染后规则依然生效，不用每次重挂 DOM。
 *   界面文案位置不固定，用「按文案值给元素打 data-hk 标记」的办法定位，
 *   配合 MutationObserver 在重渲染后自动补标。
 */
(function () {
  'use strict';
  if (window.__COPY_HIDE__) return;
  window.__COPY_HIDE__ = true;

  /* ---------------- 小工具 ---------------- */
  function esc(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

  function escIdent(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/(["\\])/g, '\\$1');
  }

  // 项目 id 里可能有空格（"KEKE · IP 设计"），要拆成多个 class token。
  // 页面上的类名是 project-card project-<id>，所以 token 要带上 project- 前缀。
  function idTokens(id) {
    return String('project-' + id).split(/\s+/).filter(Boolean).map(escIdent);
  }
  function cardSel(id) { return '.project-card.' + idTokens(id).join('.'); }

  // 案例弹层：靠 #case-title 上的 data-project 认项目（:has() 在 Chrome 105+ 可用）
  function dlgScope(id) {
    return '.dialog-content:has(#case-title[data-project="' + esc(id) + '"])';
  }

  function normalize(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  /* ---------------- 项目字段 → 页面元素 ---------------- */
  var PROJ_RULES = {
    number:        { card: ['.project-number'] },
    name:          { card: ['.project-caption h3'] },
    year:          { card: ['.project-year'] },
    headline:      { card: ['.project-headline'], dlg: ['#case-title'] },
    summary:       { card: ['.project-summary'] },
    tags:          { card: ['.project-tags'] },
    context:       { dlg: ['.case-context'] },
    role:          { dlg: ['.case-role'] },
    responsibility: { dlg: ['.case-role'] },
    problem:       { dlg: ['.case-columns>section:nth-child(1)'] },
    decision:      { dlg: ['.case-columns>section:nth-child(2)'] },
    architecture:  { dlg: ['section.architecture'] },
    result:        { dlg: ['.case-result>h3:nth-of-type(1)', '.case-result>p:nth-of-type(1)'] },
    next:          { dlg: ['.case-result>h3:nth-of-type(2)', '.case-result>p:nth-of-type(2)'] },
    demoHint:      { dlg: ['.case-demo-heading'] },
    reference:     { dlg: ['.case-reference'] },
    'reference.label': { dlg: ['.case-reference>a'] },
    'reference.url':   { dlg: ['.case-reference>a'] },
    'reference.note':  { dlg: ['.case-reference>p'] },
    // 弹层小标题：每个项目一份，屏蔽只影响这一个项目
    'labels.challenge':    { dlg: ['.case-columns>section:nth-child(1)>h3'] },
    'labels.approach':     { dlg: ['.case-columns>section:nth-child(2)>h3'] },
    'labels.architecture': { dlg: ['section.architecture>h3'] },
    'labels.outcome':      { dlg: ['.case-result>h3:nth-of-type(1)'] },
    'labels.next':         { dlg: ['.case-result>h3:nth-of-type(2)'] },
    'labels.responsibility': { dlg: ['.case-role-label'] },
    'labels.referenceLabel': { dlg: ['.case-reference>span'] }
  };

  /* 这七个键曾经是「全局小标题」，v24 之后每个项目都有自己的 labels，
   * 页面渲染的永远是项目自己的值，全局值只作模板。
   * 所以它们【不能】参与屏蔽：一旦给它们生成全局 CSS 规则，
   * 屏蔽一次就会连带把 5 个项目的小标题全藏掉（用户明确报过这个 bug）。 */
  var UI_TEMPLATE_KEYS = ['challenge', 'approach', 'architecture', 'outcome', 'next',
    'responsibility', 'referenceLabel'];

  /* ---------------- 界面里数组型文案的固定位置 ---------------- */
  var UI_ARRAY_RULES = {
    nav:          { wrap: 'nav[aria-label]', item: 'nav[aria-label]>a:nth-child(%d)' },
    statement:    { wrap: '.hero-statement' },
    aboutTitle:   { wrap: '#about-title' },
    contactTitle: { wrap: '#contact-title' },
    principles:   { wrap: '.principles', item: '.principles>div:nth-child(%d)' },
    history:      { wrap: '.experience-list', item: '.experience-list>article:nth-child(%d)' },
    skillGroups:  { wrap: '.skill-list', item: '.skill-list>div:nth-child(%d)' }
  };

  /* ---------------- 生成 CSS ---------------- */
  var styleEl = null;
  function styleNode() {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = '__copy-hide-css';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    return styleEl;
  }

  function buildCss(hidden) {
    var out = [];
    var projFields = Object.create(null);   // id -> { 字段: true }
    var projAll = Object.create(null);      // id -> true
    var uiKeys = Object.create(null);       // 'ui.xxx' -> true
    var uiItems = [];      // ['ui.xxx', 索引]

    (hidden || []).forEach(function (k) {
      if (!k || typeof k !== 'string') return;
      if (k.indexOf('ui.') === 0) {
        var mi = k.match(/^(ui\.[A-Za-z0-9_]+)\[(\d+)\]$/);
        if (mi) { uiItems.push([mi[1], Number(mi[2])]); }
        else { uiKeys[k] = true; }
        return;
      }
      var mp = k.match(/^project\.(.+?)\.(.+)$/);
      if (mp) {
        (projFields[mp[1]] = projFields[mp[1]] || {})[mp[2]] = true;
        return;
      }
      var ma = k.match(/^project\.(.+)$/);
      if (ma) projAll[ma[1]] = true;
    });

    // 界面文案：数组型走固定位置，小标题模板键直接跳过，其余靠 data-hk 标记
    Object.keys(uiKeys).forEach(function (k) {
      var name = k.slice(3);
      // 模板键没有全局渲染位置，屏蔽它对任何项目都不该有影响 —— 跳过
      if (UI_TEMPLATE_KEYS.indexOf(name) >= 0) return;
      var arr = UI_ARRAY_RULES[name];
      if (arr) out.push(arr.wrap + '{display:none!important}');
      else out.push('[data-hk="' + esc(k) + '"]{display:none!important}');
    });
    uiItems.forEach(function (pair) {
      var arr = UI_ARRAY_RULES[pair[0].slice(3)];
      if (arr && arr.item) out.push(arr.item.replace('%d', String(pair[1])) + '{display:none!important}');
    });

    // 整个项目
    Object.keys(projAll).forEach(function (id) {
      out.push(cardSel(id) + '{display:none!important}');
      out.push(dlgScope(id) + '{display:none!important}');
    });

    // 项目字段
    Object.keys(projFields).forEach(function (id) {
      var fields = projFields[id];
      var card = cardSel(id), dlg = dlgScope(id);
      Object.keys(fields).forEach(function (f) {
        var rule = PROJ_RULES[f];
        if (!rule) return;
        (rule.card || []).forEach(function (sel) {
          out.push(card + ' ' + sel + '{display:none!important}');
        });
        (rule.dlg || []).forEach(function (sel) {
          out.push(dlg + ' ' + sel + '{display:none!important}');
        });
      });
      // 案例正文两栏：藏一栏另一栏占满，藏两栏整块收掉
      var hp = !!fields.problem, hd = !!fields.decision;
      if (hp && hd) out.push(dlg + ' .case-columns{display:none!important}');
      else if (hp || hd) out.push(dlg + ' .case-columns{grid-template-columns:1fr!important}');
      // 「成果」藏了，后面那栏的小标题不用再顶一格空隙
      if (fields.result) out.push(dlg + ' .case-result>h3:nth-of-type(2){margin-top:0!important}');
      // 卡片上没内容了，标题行也别留空档
      if (fields.name && fields.number && fields.year) {
        out.push(card + ' .project-caption>div{display:none!important}');
      }
    });

    return out.join('\n');
  }

  /* ---------------- 界面文案：按值给元素打标记 ---------------- */
  function buildUiIndex() {
    var C = window.__COPY__ || {};
    var idx = Object.create(null);
    ['cn', 'en'].forEach(function (lang) {
      var ui = (C.ui || {})[lang] || {};
      Object.keys(ui).forEach(function (k) {
        // 小标题的全局值只是模板，页面上渲染的是各项目自己的 labels，不参与按值打标
        if (UI_TEMPLATE_KEYS.indexOf(k) >= 0) return;
        addVal(ui[k], 'ui.' + k, idx);
      });
    });
    return idx;
  }

  function addVal(v, key, idx) {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach(function (x) { addVal(x, key, idx); }); return; }
    if (typeof v === 'object') {
      Object.keys(v).forEach(function (k) { addVal(v[k], key, idx); });
      return;
    }
    var s = normalize(v);
    if (s.length < 2) return;                 // 太短的值不参与，避免误命中
    if (!idx[s] || idx[s].length > key.length) idx[s] = key;
  }

  function tagUi() {
    var hidden = (window.__COPY__ || {}).hidden || [];
    var need = hidden.filter(function (k) {
      if (k.indexOf('ui.') !== 0) return false;
      var name = k.slice(3);
      if (UI_TEMPLATE_KEYS.indexOf(name) >= 0) return false;
      return !UI_ARRAY_RULES[name];
    });
    if (!need.length) return;

    var idx = buildUiIndex();
    var wanted = Object.create(null);
    need.forEach(function (k) { wanted[k] = true; });

    // 只保留用得上的值
    var use = Object.create(null);
    Object.keys(idx).forEach(function (val) {
      if (wanted[idx[val]]) use[val] = idx[val];
    });
    if (!Object.keys(use).length) return;

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    var tagOf = function (el, key) {
      if (!el || el.nodeType !== 1) return;
      if (el.getAttribute('data-hk')) return;
      el.setAttribute('data-hk', key);
      // 只有一个子元素的包裹层也一起收掉，别留空盒子
      var p = el.parentElement;
      if (p && p.children.length === 1 && p.children[0] === el) {
        p.setAttribute('data-hk', key);
      }
    };

    for (var ni = 0; ni < nodes.length; ni++) {
      var node = nodes[ni];
      if (!node.nodeValue) continue;
      var p = node.parentElement;
      if (!p) continue;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      if (p.getAttribute('data-hk')) continue;

      var own = normalize(node.nodeValue);
      if (!own) continue;

      // 第一步：整个元素的文字正好等于某个文案值（含 <br> 拆行的情况）
      var full = normalize(p.textContent);
      if (full && use[full]) { tagOf(p, use[full]); continue; }

      // 第二步：文本节点本身就是完整的文案值
      if (own.length >= 4 && use[own]) tagOf(p, use[own]);
    }
  }

  /* ---------------- 应用 ---------------- */
  var lastHidden = null;

  function apply() {
    var hidden = (window.__COPY__ || {}).hidden || [];
    styleNode().textContent = buildCss(hidden);
    tagUi();
    lastHidden = hidden;
  }

  window.__COPY_HIDE_SET__ = function (hidden) {
    if (hidden) (window.__COPY__ || {}).hidden = hidden;
    apply();
  };

  function boot() {
    apply();
    // React 重渲染会重建 DOM，标记要重新补一遍
    if (window.MutationObserver && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(function () {
          var hidden = (window.__COPY__ || {}).hidden || [];
          if (JSON.stringify(hidden) === JSON.stringify(lastHidden)) apply();
        }, 120);
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
