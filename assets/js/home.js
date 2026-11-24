/* =====================================================================
 * home.js — 把 content/site-content.js 渲染到首页
 * ===================================================================== */
(function () {
  'use strict';

  var C = window.SITE_CONTENT;
  if (!C) return;
  var $ = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function tags(list) {
    return (list || []).map(function (t) { return '<span class="tag-chip">' + escapeHtml(t) + '</span>'; }).join('');
  }
  function statusClass(s) {
    return s === 'active' || s === 'review' ? 'is-active' : 'is-research';
  }
  function statusText(s) {
    return s === 'active' ? '进行中' : s === 'review' ? '审稿准备' : '调研中';
  }

  /* ---- 焦点 ---- */
  var focus = $('focusGrid');
  if (focus) {
    focus.innerHTML = (C.focus || []).map(function (f) {
      return '<a class="focus-card" href="workbench/index.html#plan">' +
        '<div class="focus-top"><span class="focus-code">' + escapeHtml(f.code) + '</span>' +
        '<span class="status-pill ' + statusClass(f.status) + '"><i></i>' + escapeHtml(f.stage) + '</span></div>' +
        '<h3>' + escapeHtml(f.title) + '</h3>' +
        '<p>' + escapeHtml(f.note) + '</p>' +
        '<div class="tag-row">' + tags(f.tags) + '</div>' +
        '<span class="focus-link">加入计划 / 查看文件 <span>→</span></span></a>';
    }).join('');
  }

  /* ---- 研究 ---- */
  var research = $('researchGrid');
  if (research) {
    research.innerHTML = (C.research || []).map(function (r) {
      return '<article class="research-card">' +
        '<div class="rc-top"><span class="rc-index">' + escapeHtml(r.index) + '</span>' +
        '<span class="status-pill ' + statusClass(r.status) + '"><i></i>' + escapeHtml(r.stage) + '</span></div>' +
        '<h3>' + escapeHtml(r.title) + '</h3>' +
        '<p class="rc-en">' + escapeHtml(r.en) + '</p>' +
        '<p class="rc-summary">' + escapeHtml(r.summary) + '</p>' +
        '<div class="tag-row">' + tags(r.tags) + '</div>' +
        '<div class="rc-foot"><span>' + escapeHtml(r.detail) + '</span>' +
        '<a href="workbench/index.html#files">工作区 <span>↗</span></a></div>' +
        '</article>';
    }).join('');
  }

  /* ---- 项目 ---- */
  var projects = $('projectGrid');
  if (projects) {
    projects.innerHTML = (C.projects || []).map(function (p) {
      var live = p.badge === 'LIVE';
      return '<a class="project-card" href="' + escapeHtml(p.href) + '">' +
        '<div class="pc-top"><span class="pc-index">' + escapeHtml(p.index) + '</span>' +
        '<span class="pc-badge ' + (live ? 'live' : 'local') + '">' + escapeHtml(p.badge) + '</span></div>' +
        '<h3>' + escapeHtml(p.title) + '</h3>' +
        '<p class="pc-en">' + escapeHtml(p.en) + '</p>' +
        '<p class="pc-summary">' + escapeHtml(p.summary) + '</p>' +
        '<div class="pc-foot"><span class="tag-row">' + tags(p.tags) + '</span><span class="pc-action">' + escapeHtml(p.action) + ' <span>→</span></span></div>' +
        '</a>';
    }).join('');
  }

  /* ---- 小时间线 ---- */
  var tl = $('timeline');
  if (tl) {
    tl.innerHTML = (C.timeline || []).map(function (t) {
      return '<li><span class="tl-when">' + escapeHtml(t.when) + '</span>' +
        '<span class="tl-title">' + escapeHtml(t.title) + '</span>' +
        '<span class="tl-note">' + escapeHtml(t.note) + '</span></li>';
    }).join('');
  }

  /* ---- 今日日期 ---- */
  var today = $('todayLabel');
  if (today) {
    var d = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    today.textContent = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0') + ' · 周' + week;
  }

  /* ---- 本地工作台在线状态 ---- */
  var dot = $('wbDot');
  var text = $('wbStatusText');
  var note = $('wbStatusNote');
  function offline() {
    if (dot) dot.className = 'status-dot';
    if (text) text.textContent = '本地工作台 · 仅本机';
    if (note) note.textContent = '公开页面不连接本地文件';
  }
  function online(data) {
    if (dot) dot.className = 'status-dot online';
    if (text) text.textContent = '本地工作台在线';
    if (note) note.textContent = (data && data.root) ? data.root : '127.0.0.1:8765';
  }
  if (text) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 1400) : null;
    fetch('api/status', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('offline'); return r.json(); })
      .then(function (data) { if (timer) clearTimeout(timer); online(data); })
      .catch(function () { if (timer) clearTimeout(timer); offline(); });
  }

  /* ---- 可选的个人资料字段 ---- */
  var profile = C.profile || {};
  document.querySelectorAll('[data-profile]').forEach(function (el) {
    var key = el.getAttribute('data-profile');
    if (profile[key]) el.textContent = profile[key];
  });
})();
