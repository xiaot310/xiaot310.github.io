/* =====================================================================
 * site.js — 身份注入、滚动出现、复制交接 Prompt
 * ===================================================================== */
(function () {
  'use strict';

  var S = window.SITE || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  $$('[data-site]').forEach(function (el) {
    var key = el.getAttribute('data-site');
    if (key === 'year') { el.textContent = String(S.year || new Date().getFullYear()); return; }
    if (S[key]) el.textContent = S[key];
  });

  $$('[data-site-link]').forEach(function (el) {
    var key = el.getAttribute('data-site-link');
    var url = S[key];
    if (url) { el.href = url; el.hidden = false; el.target = '_blank'; el.rel = 'noopener'; }
    else { el.remove(); }
  });

  window.SITE_HANDOFF =
    '你是接手张义廷（GitHub: xiaot310）个人研究站点的 AI。请先读 AGENTS.md、agent/manifest.json、llms.txt，再动手。\n\n' +
    '【结构】公开主页 index.html；本地工作台 workbench/（由 workbench/server.py 提供 /api/*）；研究演示 lab/ice-failure/；AI 交接页 agent/；展示内容在 content/site-content.js；计划种子在 content/plan.js。\n' +
    '【运行】公开页面：在站点根目录 python -m http.server 8080。完整工作台：python workbench/server.py，打开 http://127.0.0.1:8765/workbench/。\n' +
    '【边界】GitHub Pages 是公开的，只放可公开的展示内容；workbench/private.json 和个人文件绝对不要提交。LaTeX 私密链接只经本地 /go/latex 跳转。\n' +
    '【更新内容】优先改 content/site-content.js 的 research / projects / focus，结构与示例见 content/README.md；改完刷新页面并检查 workbench 的“计划”和“文件”仍可用。\n' +
    '【验证】公开页面无控制台报错；workbench /api/status 返回 ok；/api/files 不包含个人文件、奖学金、身份证、学历、学位；agent 自检通过。\n' +
    '【交付】说明改了哪些文件、为什么、如何验证，以及哪些内容仍然是本地私有。';
  /* legacy alias removed; use window.SITE_HANDOFF */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  $$('[data-copy-handoff]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var old = btn.innerHTML;
      copyText(window.SITE_HANDOFF).then(function () {
        btn.innerHTML = '已复制 ✓';
        setTimeout(function () { btn.innerHTML = old; }, 1600);
      }).catch(function () {
        btn.innerHTML = '复制失败，请手动选择';
        setTimeout(function () { btn.innerHTML = old; }, 2200);
      });
    });
  });

  /* ---- 滚动出现 ---- */
  var reveals = $$('.reveal');
  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveals.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  reveals.forEach(function (el, i) {
    el.style.transitionDelay = Math.min(i % 4, 3) * 60 + 'ms';
    io.observe(el);
  });

  // 首屏附近的内容即使过渡被冻结，也直接显示
  setTimeout(function () {
    var vh = window.innerHeight || 900;
    reveals.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < vh * 1.2) {
        el.style.transition = 'none';
        el.classList.add('in');
      }
    });
  }, 1100);
})();
