/* =====================================================================
 * workbench.js — 本地研究工作台
 * 计划 / 文件 / 工具 / 文献 / 笔记；API 由 workbench/server.py 提供。
 * ===================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var S = window.SITE || {};
  var C = window.SITE_CONTENT || { focus: [], research: [], projects: [] };
  var SEED = window.PLAN_SEED || { tasks: [] };

  var LS = {
    plan: 'xiaot.plan.v1',
    notes: 'xiaot.notes.v1',
    sketch: 'xiaot.sketch.v1',
    reading: 'xiaot.reading.v1'
  };

  var api = { online: false, status: null, files: [], roots: [], tools: null, root: '', total: 0, allTotal: 0 };
  var plan = loadPlan();
  var fileKind = 'all';
  var fileQuery = '';
  var activeSource = 0;
  var fileReq = 0;
  var searchTimer = 0;

  /* ------------------------------------------------------------ 工具 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function storeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('浏览器存储已满，请先导出备份'); return false; }
  }
  function toast(msg) {
    var el = $('wbToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function fmtSize(n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts * 1000);
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p.length === 3 ? p[1] + '-' + p[2] : iso;
  }

  /* ------------------------------------------------------------ 日期 */
  var now = new Date();
  var week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  if ($('wbDate')) $('wbDate').textContent = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
  if ($('todayDate')) $('todayDate').textContent = now.getFullYear() + ' / ' + String(now.getMonth() + 1).padStart(2, '0') + ' / ' + String(now.getDate()).padStart(2, '0') + ' · 周' + week;
  var hour = now.getHours();
  var greeting = hour < 6 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  if ($('todayGreeting')) $('todayGreeting').textContent = greeting + '，义廷';
  if ($('wbBrand')) $('wbBrand').textContent = S.brand || 'YITING ZHANG';

  /* ------------------------------------------------------------ tabs */
  var TABS = ['today', 'plan', 'files', 'tools', 'literature', 'notes'];
  function activateTab(name, updateHash) {
    if (TABS.indexOf(name) === -1) name = 'today';
    TABS.forEach(function (t) {
      var panel = $('panel-' + t);
      var link = document.querySelector('[data-tab="' + t + '"]');
      if (panel) panel.hidden = t !== name;
      if (link) link.classList.toggle('is-active', t === name);
    });
    if (updateHash) {
      try { history.replaceState(null, '', '#' + name); } catch (e) { location.hash = name; }
    }
    if (name === 'files') loadFiles(fileQuery);
    if (name === 'today') renderTodayRecent();
  }
  $$('#wbTabs a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      activateTab(a.getAttribute('data-tab'), true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  window.addEventListener('hashchange', function () {
    activateTab((location.hash || '#today').slice(1), false);
  });

  /* ------------------------------------------------------------ 计划 */
  function loadPlan() {
    var saved = storeGet(LS.plan, null);
    if (saved && Array.isArray(saved.tasks)) return saved;
    return { tasks: JSON.parse(JSON.stringify(SEED.tasks || [])) };
  }
  function savePlan() { storeSet(LS.plan, plan); updateStats(); }
  function planColumns() {
    return [
      { id: 'now', label: '现在', hint: '正在推进' },
      { id: 'next', label: '下一步', hint: '排进日程' },
      { id: 'later', label: '以后', hint: '先记着' },
      { id: 'done', label: '已完成', hint: '本周' }
    ];
  }
  function renderPlan() {
    var box = $('kanban');
    if (!box) return;
    box.innerHTML = planColumns().map(function (col) {
      var tasks = plan.tasks.filter(function (t) { return t.status === col.id; });
      var cards = tasks.map(function (t) {
        var due = t.due ? '<span>截止 ' + esc(fmtDate(t.due)) + '</span>' : '';
        var pri = '<span class="pri ' + esc(t.priority || 'mid') + '">' + ({ high: '高', mid: '中', low: '低' }[t.priority] || '中') + '</span>';
        return '<article class="task" data-id="' + esc(t.id) + '">' +
          '<div class="tt">' + esc(t.title) + '</div>' +
          (t.note ? '<div class="note">' + esc(t.note) + '</div>' : '') +
          '<div class="tm">' + pri + '<span>' + esc(t.project || '其他') + '</span>' + due + '</div>' +
          '<div class="actions">' +
          '<button type="button" data-move="-1" title="移到前一列">←</button>' +
          '<button type="button" data-move="1" title="移到后一列">→</button>' +
          '<button type="button" data-del="1" title="删除">×</button>' +
          '</div></article>';
      }).join('');
      return '<section class="kb-col" data-status="' + col.id + '">' +
        '<div class="kb-head"><b>' + col.label + '</b><span>' + tasks.length + ' · ' + col.hint + '</span></div>' +
        '<div class="kb-list">' + (cards || '<div class="kb-empty">暂无任务</div>') + '</div></section>';
    }).join('');

    $$('.task', box).forEach(function (card) {
      var id = card.getAttribute('data-id');
      $$('button', card).forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.hasAttribute('data-del')) {
            if (!confirm('删除这条任务？')) return;
            plan.tasks = plan.tasks.filter(function (t) { return t.id !== id; });
          } else {
            moveTask(id, parseInt(b.getAttribute('data-move'), 10));
          }
          savePlan(); renderPlan(); renderTodayFocus(); renderTodayStats();
        });
      });
    });
    updateStats();
  }
  function moveTask(id, dir) {
    var order = ['now', 'next', 'later', 'done'];
    plan.tasks.forEach(function (t) {
      if (t.id !== id) return;
      var i = order.indexOf(t.status);
      var next = order[Math.max(0, Math.min(order.length - 1, i + dir))];
      t.status = next;
    });
  }
  function updateStats() {
    var open = plan.tasks.filter(function (t) { return t.status === 'now' || t.status === 'next'; }).length;
    if ($('tabTaskCount')) $('tabTaskCount').textContent = open;
    if ($('statTasks')) $('statTasks').textContent = String(open).padStart(2, '0');
    var nowTime = Date.now();
    var weekLater = nowTime + 7 * 86400000;
    var due = plan.tasks.filter(function (t) {
      if (!t.due || t.status === 'done') return false;
      var d = new Date(t.due + 'T23:59:59').getTime();
      return d <= weekLater;
    }).length;
    if ($('statDue')) $('statDue').textContent = String(due).padStart(2, '0');
    if ($('statFocus')) $('statFocus').textContent = String((C.focus || []).length).padStart(2, '0');
  }

  var taskForm = $('taskForm');
  if (taskForm) {
    taskForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = $('taskTitle').value.trim();
      if (!title) return;
      plan.tasks.unshift({
        id: 't-' + Date.now(),
        title: title,
        project: $('taskProject').value,
        due: $('taskDue').value,
        priority: $('taskPriority').value,
        status: 'now',
        note: ''
      });
      $('taskTitle').value = '';
      savePlan(); renderPlan(); renderTodayFocus(); renderTodayStats();
      toast('已加入“现在”');
    });
  }
  if ($('btnExportPlan')) {
    $('btnExportPlan').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), tasks: plan.tasks }, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'xiaot-plan-' + dateStamp() + '.json');
    });
  }
  if ($('importPlan')) {
    $('importPlan').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.tasks)) throw new Error('bad');
          plan = { tasks: data.tasks };
          savePlan(); renderPlan(); renderTodayFocus(); renderTodayStats();
          toast('计划已导入');
        } catch (err) { toast('JSON 格式不正确'); }
        e.target.value = '';
      };
      reader.readAsText(f);
    });
  }
  if ($('btnResetPlan')) {
    $('btnResetPlan').addEventListener('click', function () {
      if (!confirm('恢复为 content/plan.js 的初始任务？当前计划会被覆盖。')) return;
      plan = { tasks: JSON.parse(JSON.stringify(SEED.tasks || [])) };
      savePlan(); renderPlan(); renderTodayFocus(); renderTodayStats();
      toast('已恢复种子计划');
    });
  }

  function renderTodayFocus() {
    var box = $('todayFocus');
    if (!box) return;
    var focus = C.focus || [];
    box.innerHTML = focus.map(function (f) {
      return '<div class="tf-row"><span class="tf-code">' + esc(f.code) + '</span>' +
        '<span class="tf-title">' + esc(f.title) + '</span>' +
        '<span class="tf-stage">' + esc(f.stage) + '</span></div>';
    }).join('');
    var nextBox = $('todayNext');
    if (nextBox) {
      var next = plan.tasks.filter(function (t) { return t.status === 'now' || t.status === 'next'; }).slice(0, 3);
      nextBox.innerHTML = '<div class="tn-head">接下来</div>' + next.map(function (t) {
        return '<div class="tn-row"><span class="tn-dot ' + esc(t.priority || 'mid') + '"></span><span class="tn-title">' + esc(t.title) + '</span><span class="tn-project">' + esc(t.project || '') + '</span></div>';
      }).join('');
    }
  }
  function renderTodayStats() {
    if (!C) return;
    updateStats();
  }

  /* ------------------------------------------------------------ API */
  function apiFetch(path, options) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 1800) : null;
    return fetch(path, Object.assign({ cache: 'no-store', signal: ctrl ? ctrl.signal : undefined }, options || {}))
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!r.ok) throw new Error((data && data.error) || ('HTTP ' + r.status));
          return data;
        });
      })
      .catch(function (err) { if (timer) clearTimeout(timer); throw err; });
  }
  function setApiUI(online, status) {
    api.online = online;
    api.status = status || null;
    api.root = status && status.root ? status.root : '';
    var badge = $('apiBadge');
    if (badge) {
      badge.classList.toggle('online', online);
      $('apiBadgeText').textContent = online ? '本地服务在线' : '本地服务未连接';
    }
    var fb = $('filesApi');
    if (fb) {
      fb.classList.toggle('online', online);
      fb.querySelector('span:last-child').textContent = online ? '本地服务在线' : '本地服务未连接';
    }
    if ($('localBanner')) $('localBanner').hidden = online;
    if ($('todayApi')) $('todayApi').textContent = online ? '在线' : '未连接';
    if ($('todayRoot')) $('todayRoot').textContent = online ? (api.root || '已连接') : '—';
    if ($('statFilesNote')) $('statFilesNote').textContent = online ? '本地索引' : '需要本地服务';
    if ($('latexToolStatus')) {
      $('latexToolStatus').textContent = online && api.tools && api.tools.latex ? '已连接 · 私有项目' : (online ? '未配置 LaTeX 链接' : '未连接本地服务');
    }
    if ($('todayLatex')) $('todayLatex').textContent = online && api.tools && api.tools.latex ? '已配置' : '未配置';
    $$('[data-open="latex"]').forEach(function (b) { b.disabled = !(online && api.tools && api.tools.latex); });
    if ($('openLatex')) $('openLatex').disabled = !(online && api.tools && api.tools.latex);
  }
  function checkApi() {
    if ($('apiBadgeText')) $('apiBadgeText').textContent = '检查中…';
    return apiFetch('../api/status')
      .then(function (status) {
        setApiUI(true, status);
        return apiFetch('../api/tools').then(function (tools) {
          api.tools = tools || null;
          setApiUI(true, status);
        }).catch(function () { api.tools = null; setApiUI(true, status); });
      })
      .then(function () { return loadFiles(fileQuery); })
      .catch(function () {
        setApiUI(false, null);
        renderFiles();
        renderTodayRecent();
      });
  }

  /* ------------------------------------------------------------ 文件 */
  function normalizeRoots(roots) {
    return (roots || []).map(function (r) {
      if (typeof r === 'string') return { name: r, path: (api.root ? api.root.replace(/[\\/]$/, '') + '/' + r : r) };
      return { name: r.name || r.root || r.rel || '', path: r.path || '' };
    }).filter(function (r) { return r.name; });
  }
  function loadFiles(q) {
    if (!api.online) return Promise.resolve();
    q = q == null ? fileQuery : q;
    q = q || '';
    var seq = ++fileReq;
    var url = '../api/files?limit=300' + (q ? '&q=' + encodeURIComponent(q) : '');
    return apiFetch(url)
      .then(function (data) {
        if (seq !== fileReq) return;
        api.files = data.files || [];
        api.roots = normalizeRoots(data.roots);
        api.total = data.total || api.files.length;
        if (!q) api.allTotal = api.total;
        if ($('tabFileCount')) $('tabFileCount').textContent = api.allTotal || api.total;
        if ($('statFiles')) $('statFiles').textContent = String(api.allTotal || api.total).padStart(2, '0');
        renderFiles();
        renderRecent();
        renderFolderShortcuts();
      })
      .catch(function () { toast('文件列表加载失败'); });
  }
  function fileKindOf(ext) {
    ext = String(ext || '').toLowerCase();
    if (['pdf'].indexOf(ext) !== -1) return 'pdf';
    if (['doc', 'docx', 'md', 'tex', 'txt', 'rtf', 'ppt', 'pptx'].indexOf(ext) !== -1) return 'doc';
    if (['xls', 'xlsx', 'csv', 'mat'].indexOf(ext) !== -1) return 'other';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(ext) !== -1) return 'img';
    if (['py', 'm', 'js', 'ts', 'c', 'cpp', 'h', 'json', 'html', 'css', 'sh'].indexOf(ext) !== -1) return 'code';
    return 'other';
  }
  function fileExt(f) {
    if (f.ext) return String(f.ext).replace('.', '').toLowerCase();
    var n = f.name || '';
    return n.indexOf('.') !== -1 ? n.split('.').pop().toLowerCase() : '';
  }
  function icoFor(ext) {
    ext = String(ext || '').toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (['doc', 'docx'].indexOf(ext) !== -1) return 'DOC';
    if (['md', 'txt'].indexOf(ext) !== -1) return 'TXT';
    if (ext === 'tex') return 'TEX';
    if (['xls', 'xlsx', 'csv'].indexOf(ext) !== -1) return 'XLS';
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].indexOf(ext) !== -1) return 'IMG';
    if (['zip', '7z', 'rar'].indexOf(ext) !== -1) return 'ZIP';
    if (['py', 'm', 'js', 'cpp', 'c', 'h'].indexOf(ext) !== -1) return 'CODE';
    return ext ? ext.slice(0, 4).toUpperCase() : 'FILE';
  }
  function filteredFiles() {
    var q = fileQuery.trim().toLowerCase();
    return api.files.filter(function (f) {
      var ext = fileExt(f);
      var k = fileKindOf(ext);
      if (fileKind !== 'all' && k !== fileKind) return false;
      if (!q) return true;
      return (String(f.name || '') + ' ' + String(f.rel || '') + ' ' + String(f.dir || '')).toLowerCase().indexOf(q) !== -1;
    });
  }
  function renderFolderShortcuts() {
    var box = $('folderShortcuts');
    if (!box) return;
    box.innerHTML = '';
    api.roots.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '打开 ' + r.name + ' 文件夹';
      b.addEventListener('click', function () { openPath(r.path); });
      box.appendChild(b);
    });
  }
  function renderFiles() {
    var box = $('fileList');
    var sum = $('fileSummary');
    if (!box) return;
    if (!api.online) {
      if (sum) sum.textContent = '本地服务未连接 · 以下操作不可用';
      box.innerHTML = '<div class="file-empty"><b>本地服务未启动</b><br>运行 python workbench/server.py，再打开 http://127.0.0.1:8765/workbench/。<br>公开部署的页面上不会出现任何本地文件。</div>';
      return;
    }
    var list = filteredFiles();
    if (sum) {
      if (fileQuery) {
        sum.textContent = '本地 · 搜索 “' + fileQuery + '” · 匹配 ' + list.length + ' / ' + (api.total || list.length) + ' 个';
      } else {
        var allTotal = api.allTotal || api.total || list.length;
        sum.textContent = '本地 · 显示 ' + list.length + ' / 共 ' + allTotal + ' 个文件 · 按修改时间' + (allTotal > list.length ? ' · 可搜索全部' : '');
      }
    }
    if (!list.length) {
      box.innerHTML = '<div class="file-empty">没有匹配的文件。</div>';
      return;
    }
    box.innerHTML = list.map(function (f) {
      var ext = fileExt(f);
      return '<div class="file-row">' +
        '<span class="file-ico">' + esc(icoFor(ext)) + '</span>' +
        '<span class="file-main"><b>' + esc(f.name) + '</b><small>' + esc(f.rel || f.path || '') + '</small></span>' +
        '<span class="file-dir">' + esc(f.dir || '') + '</span>' +
        '<span class="file-when">' + esc(fmtTime(f.mtime)) + '<br>' + esc(fmtSize(f.size)) + '</span>' +
        '<span class="file-open"><button type="button" data-open-file="' + esc(f.path) + '">打开</button>' +
        '<button type="button" data-reveal-file="' + esc(f.path) + '">定位</button></span></div>';
    }).join('');
    $$('[data-open-file]', box).forEach(function (b) {
      b.addEventListener('click', function () { openPath(b.getAttribute('data-open-file')); });
    });
    $$('[data-reveal-file]', box).forEach(function (b) {
      b.addEventListener('click', function () { revealPath(b.getAttribute('data-reveal-file')); });
    });
  }
  function renderRecent() {
    var box = $('todayRecent');
    if (!box) return;
    if (!api.online) {
      box.innerHTML = '<p class="wb-muted">启动本地服务后显示最近文件。</p>';
      return;
    }
    var files = api.files.slice(0, 5);
    if (!files.length) { box.innerHTML = '<p class="wb-muted">工作区里还没有可显示的文件。</p>'; return; }
    box.innerHTML = files.map(function (f) {
      return '<div class="recent-row"><span class="file-ico">' + esc(icoFor(fileExt(f))) + '</span>' +
        '<span class="recent-name"><b>' + esc(f.name) + '</b><small>' + esc(f.rel || '') + '</small></span>' +
        '<time>' + esc(fmtTime(f.mtime)) + '</time></div>';
    }).join('');
  }
  function renderTodayRecent() { renderRecent(); }
  function openPath(path) {
    if (!path) return;
    if (!api.online) { toast('先启动本地工作台'); return; }
    apiFetch('../api/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path }) })
      .then(function () { toast('已打开'); })
      .catch(function (err) { toast('打开失败：' + (err.message || '未知错误')); });
  }
  function revealPath(path) {
    if (!api.online) { toast('先启动本地工作台'); return; }
    apiFetch('../api/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path }) })
      .then(function () { toast('已在文件夹中定位'); })
      .catch(function (err) { toast('定位失败：' + (err.message || '未知错误')); });
  }
  function renderFolderShortcutsPlaceholder() {
    var box = $('folderShortcuts');
    if (!box) return;
    box.innerHTML = '';
    ['论文', '项目', '课程', '助教'].forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '打开 ' + name + ' 文件夹';
      b.disabled = !api.online;
      b.addEventListener('click', function () {
        if (!api.online) return;
        openPath((api.root || '').replace(/[\\/]$/, '') + '/' + name);
      });
      box.appendChild(b);
    });
  }

  /* ------------------------------------------------------------ 计划文件/统计初始化 */
  renderPlan();
  renderTodayFocus();
  updateStats();
  renderFolderShortcutsPlaceholder();

  /* ------------------------------------------------------------ 笔记 */
  var noteArea = $('noteArea');
  if (noteArea) {
    noteArea.value = storeGet(LS.notes, '') || '';
    updateNoteMeta();
    var noteTimer = 0;
    noteArea.addEventListener('input', function () {
      updateNoteMeta();
      if ($('noteSaved')) $('noteSaved').textContent = '保存中…';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () {
        if (storeSet(LS.notes, noteArea.value) && $('noteSaved')) $('noteSaved').textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      }, 500);
    });
  }
  function updateNoteMeta() {
    if ($('noteCount')) $('noteCount').textContent = (noteArea.value || '').length + ' 字';
  }
  if ($('btnDownloadNote')) {
    $('btnDownloadNote').addEventListener('click', function () {
      var md = '# 今日笔记\n\n' + noteArea.value + '\n';
      downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), 'xiaot-note-' + dateStamp() + '.md');
    });
  }
  if ($('btnClearNote')) {
    $('btnClearNote').addEventListener('click', function () {
      if (!confirm('清空今日笔记？')) return;
      noteArea.value = '';
      storeSet(LS.notes, '');
      updateNoteMeta();
      if ($('noteSaved')) $('noteSaved').textContent = '已清空';
    });
  }
  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /* ------------------------------------------------------------ 文件筛选 */
  if ($('fileSearch')) {
    $('fileSearch').addEventListener('input', function () {
      fileQuery = $('fileSearch').value;
      renderFiles();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { loadFiles(fileQuery); }, 380);
    });
  }
  $$('#kindFilter button').forEach(function (b) {
    b.addEventListener('click', function () {
      fileKind = b.getAttribute('data-kind');
      $$('#kindFilter button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      renderFiles();
    });
  });
  if ($('btnRefreshFiles')) $('btnRefreshFiles').addEventListener('click', function () { checkApi(); });
  if ($('btnRefresh')) $('btnRefresh').addEventListener('click', function () { checkApi(); });
  if ($('btnRetryApi')) $('btnRetryApi').addEventListener('click', function () { checkApi(); });

  /* ------------------------------------------------------------ 工具 / LaTeX */
  function openLatex() {
    if (!(api.online && api.tools && api.tools.latex)) {
      toast(api.online ? 'LaTeX 链接未配置' : '先运行 python workbench/server.py');
      return;
    }
    window.open('../go/latex', '_blank', 'noopener');
  }
  if ($('openLatex')) $('openLatex').addEventListener('click', openLatex);
  $$('[data-open="latex"]').forEach(function (b) { b.addEventListener('click', openLatex); });
  $$('[data-open-root]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!api.online) { toast('先启动本地工作台'); return; }
      openPath((api.root || '').replace(/[\\/]$/, '') + '/' + b.getAttribute('data-open-root'));
    });
  });

  /* ------------------------------------------------------------ 手绘板 */
  var canvas = $('sketch');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var color = '#12212b';
    var width = 3;
    var erasing = false;
    var drawing = false;
    var last = null;
    var saveTimer = 0;
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var saved = storeGet(LS.sketch, null);
    if (saved && saved.data) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
      img.src = saved.data;
      if ($('sketchSaved') && saved.at) $('sketchSaved').textContent = '已恢复 ' + saved.at;
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    }
    function begin(e) {
      drawing = true;
      last = pos(e);
      canvas.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.arc(last.x, last.y, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = erasing ? '#fffdf8' : color;
      ctx.fill();
      e.preventDefault();
    }
    function move(e) {
      if (!drawing) return;
      var p = pos(e);
      ctx.strokeStyle = erasing ? '#fffdf8' : color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      saveSketch();
    }
    function saveSketch() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try {
          var data = canvas.toDataURL('image/png');
          localStorage.setItem(LS.sketch, JSON.stringify({ data: data, at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }));
          if ($('sketchSaved')) $('sketchSaved').textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          if ($('sketchSaved')) $('sketchSaved').textContent = '保存失败（存储空间不足）';
        }
      }, 400);
    }
    canvas.addEventListener('pointerdown', begin);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', function () { if (drawing) end(); });

    $$('#swatches button').forEach(function (b) {
      b.addEventListener('click', function () {
        color = b.getAttribute('data-color');
        erasing = false;
        $$('#swatches button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        if ($('btnEraser')) $('btnEraser').classList.remove('is-on');
      });
    });
    if ($('brushWidth')) $('brushWidth').addEventListener('input', function () { width = parseInt(this.value, 10) || 3; });
    if ($('btnEraser')) {
      $('btnEraser').addEventListener('click', function () {
        erasing = !erasing;
        this.classList.toggle('is-on', erasing);
        this.textContent = erasing ? '画笔' : '橡皮';
      });
    }
    if ($('btnClearSketch')) {
      $('btnClearSketch').addEventListener('click', function () {
        if (!confirm('清空手绘板？')) return;
        ctx.fillStyle = '#fffdf8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveSketch();
      });
    }
    if ($('btnSaveSketch')) {
      $('btnSaveSketch').addEventListener('click', function () {
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, 'xiaot-sketch-' + dateStamp() + '.png');
        }, 'image/png');
      });
    }
  }

  /* ------------------------------------------------------------ 文献 */
  var SOURCES = [
    { name: 'Google Scholar', url: function (q) { return 'https://scholar.google.com/scholar?q=' + encodeURIComponent(q); } },
    { name: 'Semantic Scholar', url: function (q) { return 'https://www.semanticscholar.org/search?q=' + encodeURIComponent(q); } },
    { name: 'arXiv', url: function (q) { return 'https://arxiv.org/search/?query=' + encodeURIComponent(q) + '&searchtype=all'; } },
    { name: 'CNKI', url: function (q) { return 'https://kns.cnki.net/kns8s/defaultresult/index?kw=' + encodeURIComponent(q); } },
    { name: '万方', url: function (q) { return 'https://s.wanfangdata.com.cn/paper?q=' + encodeURIComponent(q); } }
  ];
  function renderSources() {
    var box = $('litSources');
    if (!box) return;
    box.innerHTML = '';
    SOURCES.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.name;
      b.addEventListener('click', function () {
        activeSource = i;
        searchSource(i);
      });
      box.appendChild(b);
    });
  }
  function searchSource(i) {
    var q = ($('litQuery') && $('litQuery').value.trim()) || '';
    if (!q) { $('litQuery').focus(); toast('先输入关键词'); return; }
    window.open(SOURCES[i].url(q), '_blank', 'noopener');
  }
  if ($('litForm')) {
    $('litForm').addEventListener('submit', function (e) {
      e.preventDefault();
      searchSource(activeSource);
    });
  }
  function loadReading() {
    var list = storeGet(LS.reading, []);
    return Array.isArray(list) ? list : [];
  }
  function saveReading(list) { storeSet(LS.reading, list); renderReading(); }
  function renderReading() {
    var box = $('readingList');
    if (!box) return;
    var list = loadReading();
    if (!list.length) { box.innerHTML = '<div class="wb-empty">还没有条目。输入检索词后点“加入当前检索”。</div>'; return; }
    box.innerHTML = '';
    list.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'reading-row';
      var info = document.createElement('div');
      var b = document.createElement('b'); b.textContent = item.title || item.query;
      var sm = document.createElement('small'); sm.textContent = (item.source || '检索') + ' · ' + (item.added || '');
      info.appendChild(b); info.appendChild(sm);
      var acts = document.createElement('div');
      var again = document.createElement('button'); again.type = 'button'; again.textContent = '再搜';
      again.addEventListener('click', function () {
        var s = SOURCES.filter(function (x) { return x.name === item.source; })[0] || SOURCES[0];
        window.open(s.url(item.query), '_blank', 'noopener');
      });
      var del = document.createElement('button'); del.type = 'button'; del.textContent = '删除';
      del.addEventListener('click', function () {
        var cur = loadReading(); cur.splice(idx, 1); saveReading(cur);
      });
      acts.appendChild(again); acts.appendChild(del);
      row.appendChild(info); row.appendChild(acts);
      box.appendChild(row);
    });
  }
  if ($('btnAddReading')) {
    $('btnAddReading').addEventListener('click', function () {
      var q = ($('litQuery') && $('litQuery').value.trim()) || '';
      if (!q) { toast('先输入关键词'); return; }
      var list = loadReading();
      list.unshift({ query: q, title: q, source: SOURCES[activeSource].name, added: new Date().toLocaleDateString('zh-CN') });
      saveReading(list.slice(0, 80));
      toast('已加入阅读清单');
    });
  }
  renderSources(); renderReading();

  /* ------------------------------------------------------------ 初始化 */
  activateTab((location.hash || '#today').slice(1), false);
  renderTodayFocus();
  updateStats();
  checkApi();
})();
