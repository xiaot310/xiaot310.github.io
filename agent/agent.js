/* =====================================================================
 * agent.js — 目录高亮 / 自检 / 关键词检索 / Prompt
 * ===================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var K = window.AGENT_KNOWLEDGE || [];

  /* ---------------- prompt ---------------- */
  var prompt = window.SITE_HANDOFF || '请先读 AGENTS.md、content/README.md、workbench/README.md。';
  if ($('promptText')) $('promptText').textContent = prompt;

  /* ---------------- toc ---------------- */
  var sections = $$('.doc-section');
  var tocLinks = $$('.agent-toc a');
  if (sections.length && tocLinks.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        tocLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------------- self check ---------------- */
  function fetchText(url, timeout) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 3000) : null;
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .catch(function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function checkOne(label, fn, optional) {
    return fn().then(function (detail) {
      return { ok: true, label: label, detail: detail || '可读', optional: !!optional };
    }).catch(function (e) {
      return { ok: false, label: label, detail: optional ? '未连接（可选）' : (e.message || '读取失败'), optional: !!optional };
    });
  }

  function runChecks() {
    var buttons = [$('runCheck'), $('runCheckTop')].filter(Boolean);
    buttons.forEach(function (b) { b.disabled = true; b.textContent = '检查中…'; });
    if ($('checkSummary')) $('checkSummary').textContent = '检查中…';
    if ($('checkSummaryTop')) $('checkSummaryTop').textContent = '检查中…';

    var checks = [
      checkOne('manifest.json 可读', function () {
        return fetchText('manifest.json').then(function (t) {
          var data = JSON.parse(t);
          if (!data || (!data.name && !data.project)) throw new Error('缺少 name');
          return data.version ? 'v' + data.version : '已解析';
        });
      }),
      checkOne('首页内容数据存在', function () {
        return fetchText('../content/site-content.js').then(function (t) {
          if (t.indexOf('SITE_CONTENT') === -1 || t.indexOf('projects') === -1) throw new Error('缺少 SITE_CONTENT');
          return 'site-content.js';
        });
      }),
      checkOne('llms.txt 可读', function () {
        return fetchText('../llms.txt').then(function (t) {
          if (t.indexOf('xiaot310') === -1) throw new Error('未找到 xiaot310');
          return 'xiaot310';
        });
      }),
      checkOne('工作台页面可读', function () {
        return fetchText('../workbench/index.html').then(function (t) {
          if (t.indexOf('工作台') === -1 && t.indexOf('sketch') === -1) throw new Error('页面内容不匹配');
          return 'workbench/';
        });
      }),
      checkOne('本地工作台 API（可选）', function () {
        return fetchText('../api/status', 1800).then(function (t) {
          var data = JSON.parse(t);
          if (!data || data.ok !== true) throw new Error('返回异常');
          return data.name || '在线';
        });
      }, true)
    ];

    Promise.all(checks).then(function (results) {
      var staticResults = results.filter(function (r) { return !r.optional; });
      var passed = staticResults.filter(function (r) { return r.ok; }).length;
      var failed = staticResults.length - passed;
      var summary = passed + '/' + staticResults.length + (failed ? ' 有失败' : ' 静态通过');
      if ($('checkSummary')) $('checkSummary').textContent = summary;
      if ($('checkSummaryTop')) $('checkSummaryTop').textContent = summary;
      var dot = $('checkDot');
      if (dot) dot.className = 'check-dot ' + (failed ? 'bad' : 'ok');

      var list = $('checkList');
      if (list) {
        list.innerHTML = '';
        results.forEach(function (r) {
          var li = document.createElement('li');
          li.className = r.ok ? (r.optional ? 'muted' : 'ok') : (r.optional ? 'muted' : 'bad');
          var ck = document.createElement('span'); ck.className = 'ck'; ck.textContent = r.ok ? '✓' : (r.optional ? '○' : '×');
          var b = document.createElement('b'); b.textContent = r.label;
          var detail = document.createElement('span'); detail.className = 'detail'; detail.textContent = r.detail;
          li.appendChild(ck); li.appendChild(b); li.appendChild(detail);
          list.appendChild(li);
        });
      }
      buttons.forEach(function (b) { b.disabled = false; b.textContent = b.id === 'runCheckTop' ? '运行' : '重新检查'; });
    });
  }

  ['runCheck', 'runCheckTop'].forEach(function (id) {
    if ($(id)) $(id).addEventListener('click', runChecks);
  });

  /* ---------------- keyword console ---------------- */
  var log = $('agentLog');
  function addMsg(role, title, body) {
    if (!log) return;
    var wrap = document.createElement('div');
    wrap.className = 'msg' + (role === 'you' ? ' msg-user' : '');
    var avatar = document.createElement('span'); avatar.className = 'msg-avatar'; avatar.textContent = role === 'you' ? 'YOU' : 'AI';
    var content = document.createElement('div'); content.className = 'msg-body';
    if (title) {
      var h = document.createElement('p');
      var strong = document.createElement('strong'); strong.textContent = title;
      h.appendChild(strong); content.appendChild(h);
    }
    String(body || '').split('\n').forEach(function (line) {
      var p = document.createElement('p'); p.textContent = line; content.appendChild(p);
    });
    wrap.appendChild(avatar); wrap.appendChild(content);
    log.appendChild(wrap);
    while (log.children.length > 8) log.removeChild(log.firstElementChild);
    log.scrollTop = log.scrollHeight;
  }

  function score(q, entry) {
    var text = (entry.title + ' ' + (entry.tags || []).join(' ') + ' ' + entry.body).toLowerCase();
    q = String(q || '').toLowerCase().trim();
    if (!q) return 0;
    var s = 0;
    if (text.indexOf(q) !== -1) s += 20;
    var compact = q.replace(/\s+/g, '');
    for (var i = 0; i < compact.length - 1; i++) {
      if (text.indexOf(compact.slice(i, i + 2)) !== -1) s += 2;
    }
    q.split(/\s+/).forEach(function (t) {
      if (t.length > 1 && text.indexOf(t) !== -1) s += 4;
    });
    return s;
  }

  function ask(q) {
    q = String(q || '').trim();
    if (!q) return;
    addMsg('you', '', q);
    var ranked = K.map(function (e) { return { e: e, s: score(q, e) }; })
      .filter(function (x) { return x.s >= 4; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 2);
    if (!ranked.length) {
      setTimeout(function () {
        addMsg('ai', '没有找到直接匹配', '这份检索只覆盖交接文档的知识条目。可以改问：怎么加项目卡、private.json 会不会上传、工作台怎么启动、OC 怎么同步、怎么部署。');
      }, 120);
      return;
    }
    setTimeout(function () {
      ranked.forEach(function (x) {
        addMsg('ai', x.e.title, x.e.body);
      });
    }, 120);
  }

  if ($('agentForm')) {
    $('agentForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('agentInput').value;
      $('agentInput').value = '';
      ask(q);
    });
  }
  $$('#agentSuggest button').forEach(function (b) {
    b.addEventListener('click', function () {
      if ($('agentInput')) $('agentInput').value = b.getAttribute('data-q') || b.textContent;
      ask(b.getAttribute('data-q') || b.textContent);
    });
  });
})();
