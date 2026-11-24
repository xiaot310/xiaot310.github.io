/* =====================================================================
 * lab.js — 海冰三轴失效准则实验
 * 依赖 ice-criteria.js；Canvas 2D 自绘；三维用自写透视投影。
 * 状态全部写入 URL hash：m / s / st / sc / S / v / fit
 * ===================================================================== */
(function () {
  'use strict';

  var C = window.IceCriteria;
  var IDS = ['rank', 'mises', 'mc', 'tw'];
  var NAMES = { rank: '第一强度理论', mises: 'Mises', mc: 'Mohr–Coulomb', tw: 'Tsai–Wu' };
  var SHORT = { rank: 'RANKINE', mises: 'MISES', mc: 'MOHR–COULOMB', tw: 'TSAI–WU' };
  var COLORS = C.COLORS;
  var DEFAULT = { st: 0.8, sc: 4.0, S: 1.0 };
  var MONO = '"JetBrains Mono", Consolas, "Liberation Mono", monospace';

  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var stage = $('stage');
  var chart2d = $('chart2d');
  var scene3d = $('scene3d');
  var stageHint = $('stageHint');
  var toastEl = $('toast');
  var helpModal = $('helpModal');
  var legendBox = $('legend');
  var verdictBox = $('verdicts');
  var presetsBox = $('presets');

  var state = {
    mode: '2d',
    mat: { st: DEFAULT.st, sc: DEFAULT.sc, S: DEFAULT.S },
    stress: [0.5, -0.5, 0],
    vis: { rank: true, mises: true, mc: true, tw: true },
    selected: null,
    fit: false,
    cam: { yaw: -0.70, pitch: 0.50, zoom: 1, panX: 0, panY: 0 }
  };

  var view = { w: 0, h: 0, dpr: 1 };
  var g2d = null;
  var envCache = { key: '', data: null };
  var sliceCache = { key: '', data: null };
  var fitCache = { key: '', R: 0 };
  var hashTimer = 0;
  var toastTimer = 0;
  var hover = null;
  var dragging2d = false;
  var dragging3d = null;
  var lastFocus = null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try { boot(); } catch (err) { fatal(err); }

  function boot() {
    C.set(DEFAULT.st, DEFAULT.sc, DEFAULT.S);
    state.mat = pickMat(C.get());
    readHash();
    buildLegend();
    buildVerdicts();
    buildPresets();
    bindControls();
    bind2D();
    bind3D();
    bindKeys();
    syncMode();
    syncParams();
    syncStress();
    updateAll(false);
    onResize();
    requestAnimationFrame(function () { onResize(); moveThumb(); });
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { onResize(); }).observe(stage);
    } else {
      window.addEventListener('resize', onResize);
    }
    document.addEventListener('fullscreenchange', onResize);
    $$('[data-close]').forEach(function (el) { el.addEventListener('click', closeHelp); });

    // 同一页面内改 hash、浏览器后退、粘贴新链接时重新读取状态
    window.addEventListener('hashchange', function () {
      if (!location.hash) return;
      readHash();
      clampStress();
      syncMode();
      syncParams();
      syncStress();
      updateAll(true);
      requestAnimationFrame(moveThumb);
    });
  }

  function pickMat(p) {
    return { st: p.st, sc: p.sc, S: p.S };
  }

  function fatal(err) {
    var el = $('fatal');
    if (el) { el.hidden = false; el.textContent = '脚本出错：' + (err && err.message ? err.message : String(err)); }
    if (window.console) console.error(err);
  }
  window.addEventListener('error', function (e) { fatal(e.error || e.message); });

  /* ------------------------------------------------------------ URL 状态 */
  function readHash() {
    var raw = location.hash.replace(/^#/, '');
    if (!raw) return;
    var q;
    try { q = new URLSearchParams(raw); } catch (e) { return; }
    var m = q.get('m');
    if (m === '3d' || m === '2d') state.mode = m;

    var st = parseFloat(q.get('st'));
    var sc = parseFloat(q.get('sc'));
    var S = parseFloat(q.get('S'));
    var eff = C.set(isFinite(st) ? st : DEFAULT.st, isFinite(sc) ? sc : DEFAULT.sc, isFinite(S) ? S : DEFAULT.S);
    state.mat = pickMat(eff);

    var ss = (q.get('s') || '').split(',').map(parseFloat);
    if (ss.length >= 2 && ss.every(function (v) { return isFinite(v); })) {
      state.stress = [ss[0], ss[1], isFinite(ss[2]) ? ss[2] : 0];
    }

    var v = q.get('v');
    if (/^[01]{4}$/.test(v || '')) {
      IDS.forEach(function (id, i) { state.vis[id] = v.charAt(i) === '1'; });
    }
    state.fit = q.get('fit') === '1';
    clampStress();
  }

  function commitHash(now) {
    clearTimeout(hashTimer);
    if (!now) { hashTimer = setTimeout(commitHashNow, 140); return; }
    commitHashNow();
  }

  function commitHashNow() {
    var m = state.mat;
    var v = IDS.map(function (id) { return state.vis[id] ? '1' : '0'; }).join('');
    var h = 'm=' + state.mode +
      '&s=' + state.stress.map(function (x) { return x.toFixed(2); }).join(',') +
      '&st=' + m.st.toFixed(2) + '&sc=' + m.sc.toFixed(2) + '&S=' + m.S.toFixed(2) +
      '&v=' + v + (state.fit ? '&fit=1' : '');
    try {
      history.replaceState(null, '', location.pathname + location.search + '#' + h);
    } catch (err) {
      try { location.hash = h; } catch (err2) { /* file:// 下不可写，忽略 */ }
    }
  }

  /* ------------------------------------------------------------ 面板构建 */
  function buildLegend() {
    legendBox.innerHTML = '';
    IDS.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lg-item';
      b.setAttribute('data-id', id);
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = '<span class="lg-dot" style="background:' + COLORS[id] + ';color:' + COLORS[id] + '"></span>' +
        '<span>' + NAMES[id] + '</span><span class="lg-g">0.00</span>';
      b.addEventListener('click', function () {
        state.vis[id] = !state.vis[id];
        invalidate();
        updateAll(true);
        commitHash();
      });
      legendBox.appendChild(b);
    });
  }

  function buildVerdicts() {
    verdictBox.innerHTML = '';
    IDS.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'verdict';
      b.setAttribute('data-id', id);
      b.innerHTML = '<span class="v-dot" style="background:' + COLORS[id] + ';color:' + COLORS[id] + '"></span>' +
        '<span class="v-main"><span class="v-name">' + NAMES[id] + '</span><span class="v-bar"><i></i></span></span>' +
        '<span class="v-g">—</span><span class="v-badge">—</span>';
      b.addEventListener('click', function () {
        state.selected = state.selected === id ? null : id;
        updateAll(false);
        draw();
        scrollDetailIntoView();
      });
      verdictBox.appendChild(b);
    });
  }

  function buildPresets() {
    var presets = [
      { label: '单轴拉伸', s: [0.6, 0, 0] },
      { label: '单轴压缩', s: [-2, 0, 0] },
      { label: '纯剪切', s: [1, -1, 0] },
      { label: '双轴压缩', s: [-1.5, -1.5, 0] },
      { label: '三轴压缩', s: [0, -1, -2], mode: '3d' },
      { label: '静水拉伸', s: [0.3, 0.3, 0.3], mode: '3d' }
    ];
    presetsBox.innerHTML = '';
    presets.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.innerHTML = p.label + ' <small>' + p.s.map(function (v) { return v.toFixed(2); }).join(', ') + '</small>';
      b.addEventListener('click', function () {
        if (p.mode && state.mode !== p.mode) setMode(p.mode, true);
        state.stress = p.s.slice();
        clampStress();
        syncStress();
        updateAll(true);
        commitHash();
        hideHint();
      });
      presetsBox.appendChild(b);
    });
  }

  function bindControls() {
    $$('.mode-switch button').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });

    bindParam('st', 'stNum', 'stRange');
    bindParam('sc', 'scNum', 'scRange');
    bindParam('S', 'SNum', 'SRange');

    for (var i = 0; i < 3; i++) bindStress(i);

    $('btnResetParams').addEventListener('click', function () {
      var eff = C.set(DEFAULT.st, DEFAULT.sc, DEFAULT.S);
      state.mat = pickMat(eff);
      clampStress();
      invalidate();
      syncParams();
      syncStress();
      updateAll(true);
      commitHash();
      toast('已恢复默认强度');
    });

    $('btnFit').addEventListener('click', function () {
      state.fit = !state.fit;
      $('btnFit').classList.toggle('is-on', state.fit);
      invalidate();
      draw();
      commitHash();
      toast(state.fit ? '视窗已适配全部包络' : '视窗恢复默认比例');
    });

    $('btnResetView').addEventListener('click', resetCam);
    $('btnCopy').addEventListener('click', copyLink);
    $('btnShot').addEventListener('click', shot);
    $('btnFull').addEventListener('click', toggleFull);
    $('btnHelp').addEventListener('click', openHelp);
  }

  function bindParam(key, numId, rangeId) {
    var num = $(numId), range = $(rangeId);
    range.addEventListener('input', function () { setParam(key, parseFloat(range.value)); });
    num.addEventListener('change', function () { setParam(key, parseFloat(num.value)); });
  }

  function bindStress(i) {
    var num = $('s' + (i + 1) + 'Num');
    var range = $('s' + (i + 1) + 'Range');
    range.addEventListener('input', function () { setStress(i, parseFloat(range.value)); });
    num.addEventListener('change', function () { setStress(i, parseFloat(num.value)); });
  }

  function setMode(mode, silent) {
    if (state.mode === mode) return;
    state.mode = mode;
    if (mode === '2d') state.stress[2] = 0;
    syncMode();
    syncStress();
    updateAll(false);
    draw();
    if (!silent) commitHash();
    requestAnimationFrame(moveThumb);
  }

  function syncMode() {
    var is3 = state.mode === '3d';
    $$('.mode-switch button').forEach(function (b) {
      var on = b.getAttribute('data-mode') === state.mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    chart2d.hidden = is3;
    scene3d.hidden = !is3;
    $('btnFit').hidden = is3;
    $('btnResetView').hidden = !is3;
    $('s3Row').classList.toggle('is-locked', !is3);
    $('s3Num').disabled = !is3;
    $('s3Range').disabled = !is3;
    $('stressTag').textContent = is3 ? '三轴应力' : '平面应力';
    $('modeChip').innerHTML = is3 ? '三维 · σ<sub>3</sub> 可调' : '平面应力 · σ<sub>3</sub> = 0';
    $('viewChip').textContent = is3 ? '三维切片' : '二维包络线';
    stageHint.textContent = is3 ? '拖动旋转 · 滚轮缩放 · 右键平移' : '拖动圆点改变应力状态';
    hover = null;
  }

  function moveThumb() {
    var active = document.querySelector('.mode-switch button.is-active');
    var thumb = $('modeThumb');
    if (!active || !thumb) return;
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (active.offsetLeft - 3) + 'px)';
  }

  /* ------------------------------------------------------------ 状态更新 */
  function bounds() {
    return {
      min: -Math.max(0.4, state.mat.sc * 1.15),
      max: Math.max(0.5, state.mat.st * 1.6, 1.1)
    };
  }

  function clampStress() {
    var b = bounds();
    for (var i = 0; i < 3; i++) {
      state.stress[i] = Math.min(b.max, Math.max(b.min, state.stress[i]));
      state.stress[i] = Math.round(state.stress[i] * 100) / 100;
    }
    if (state.mode === '2d') state.stress[2] = 0;
  }

  function setParam(key, value) {
    if (!isFinite(value)) return;
    var m = state.mat;
    var eff = C.set(
      key === 'st' ? value : m.st,
      key === 'sc' ? value : m.sc,
      key === 'S' ? value : m.S
    );
    state.mat = pickMat(eff);
    clampStress();
    invalidate();
    syncParams();
    syncStress();
    updateAll(true);
    commitHash();
  }

  function setStress(i, value) {
    if (!isFinite(value)) return;
    if (i === 2 && state.mode === '2d') return;
    var b = bounds();
    value = Math.min(b.max, Math.max(b.min, value));
    value = Math.round(value * 100) / 100;
    if (state.stress[i] === value) { syncStress(); return; }
    state.stress[i] = value;
    syncStress();
    updateAll(true);
    commitHash();
    hideHint();
  }

  function syncParams() {
    var m = state.mat;
    var p = C.get();
    setPair('stNum', 'stRange', m.st);
    setPair('scNum', 'scRange', m.sc);

    var minS = Math.max(0.2, Math.round(p.sMin * 100) / 100);
    $('SNum').min = minS;
    $('SRange').min = minS;
    setPair('SNum', 'SRange', m.S);

    $('hdrSt').textContent = fmt(m.st);
    $('hdrSc').textContent = fmt(m.sc);
    $('paramDerived').textContent =
      'φ = ' + (p.phi * 180 / Math.PI).toFixed(1) + '° · c = ' + fmt4(p.c) + ' MPa' +
      ' · F11 = ' + fmt4(p.F11) + ' · G11 = ' + fmt4(p.G11) + ' · G12 = ' + fmt4(p.G12) +
      ' · S 下限 = ' + fmt4(p.sMin);
    $('coefLine').textContent =
      'φ = ' + (p.phi * 180 / Math.PI).toFixed(1) + '°，c = ' + fmt4(p.c) + ' MPa，' +
      'F11 = ' + fmt4(p.F11) + '，G11 = ' + fmt4(p.G11) + '，G12 = ' + fmt4(p.G12) +
      '，p_apex = ' + fmt4(p.apex) + ' MPa';
  }

  function setPair(numId, rangeId, value) {
    var num = $(numId), range = $(rangeId);
    if (document.activeElement !== num) num.value = value.toFixed(2);
    range.value = value;
  }

  function syncStress() {
    var b = bounds();
    for (var i = 0; i < 3; i++) {
      var num = $('s' + (i + 1) + 'Num');
      var range = $('s' + (i + 1) + 'Range');
      num.min = b.min; num.max = b.max;
      range.min = b.min; range.max = b.max;
      if (document.activeElement !== num) num.value = state.stress[i].toFixed(2);
      range.value = state.stress[i];
    }
    if (state.mode === '2d') {
      $('s3Num').value = '0.00';
      $('s3Range').value = '0';
    }
  }

  function updateAll(doDraw) {
    var all = C.allG(state.stress[0], state.stress[1], state.stress[2]);
    var maxId = IDS[0], maxG = -Infinity;
    IDS.forEach(function (id) { if (all[id] > maxG) { maxG = all[id]; maxId = id; } });

    IDS.forEach(function (id) {
      var row = verdictBox.querySelector('[data-id="' + id + '"]');
      var leg = legendBox.querySelector('[data-id="' + id + '"]');
      var g = all[id];
      var fail = g >= 1;
      var near = !fail && g >= 0.85;

      row.querySelector('.v-g').textContent = fmt(g);
      var bar = row.querySelector('.v-bar i');
      bar.style.width = Math.min(Math.max(g, 0) / 1.5, 1) * 100 + '%';
      bar.style.background = fail ? '#ff6b57' : COLORS[id];
      var badge = row.querySelector('.v-badge');
      badge.textContent = fail ? '失效' : (near ? '接近' : '安全');
      badge.className = 'v-badge ' + (fail ? 'fail' : (near ? 'near' : 'safe'));
      row.classList.toggle('is-active', state.selected === id);

      leg.classList.toggle('is-off', !state.vis[id]);
      leg.setAttribute('aria-pressed', state.vis[id] ? 'true' : 'false');
      leg.querySelector('.lg-g').textContent = fmt(g);
    });

    var p = (state.stress[0] + state.stress[1] + state.stress[2]) / 3;
    var hi = Math.max(state.stress[0], state.stress[1], state.stress[2]);
    var lo = Math.min(state.stress[0], state.stress[1], state.stress[2]);
    $('derP').textContent = fmt(p);
    $('derTau').textContent = fmt((hi - lo) / 2);
    $('derG').textContent = fmt(maxG);
    $('derG').style.color = maxG >= 1 ? '#ff9b8a' : '#cfe6ee';

    var fails = IDS.filter(function (id) { return all[id] >= 1; });
    var explain = $('explain');
    if (fails.length) {
      explain.textContent = fails.map(function (id) { return NAMES[id]; }).join('、') +
        ' 已进入失效区；控制准则为 ' + NAMES[maxId] + '（g = ' + fmt(maxG) + '）。';
    } else {
      explain.textContent = '四种准则均未达到失效面；控制准则为 ' + NAMES[maxId] +
        '（g = ' + fmt(maxG) + '，剩余 ' + fmt(Math.max(0, 1 - maxG)) + '）。';
    }

    if (state.selected) renderDetail(all);
    else renderDetailEmpty();

    if (doDraw) draw();
  }

  function scrollDetailIntoView() {
    var panel = $('panel');
    var card = $('detailCard');
    if (!panel || !card) return;
    var pr = panel.getBoundingClientRect();
    var cr = card.getBoundingClientRect();
    var delta = cr.bottom - pr.bottom + 14;
    if (delta > 0) {
      try { panel.scrollTo({ top: panel.scrollTop + delta, behavior: reduce ? 'auto' : 'smooth' }); }
      catch (e) { panel.scrollTop += delta; }
    }
  }

  function renderDetailEmpty() {
    $('detailHint').textContent = '点击任一准则';
    $('detailBody').innerHTML = '<p class="muted">在右侧判定表中点一行，查看该准则的公式与代入值。</p>';
  }

  function renderDetail(all) {
    var id = state.selected;
    var s1 = state.stress[0], s2 = state.stress[1], s3 = state.stress[2];
    var p = C.get();
    var hi = Math.max(s1, s2, s3);
    var lo = Math.min(s1, s2, s3);
    var g = all[id];
    var h = '<div class="calc-title"><b>' + NAMES[id] + '</b><span>g = ' + fmt(g) + '</span></div>';

    if (id === 'rank') {
      var a1 = hi / p.st, a2 = -lo / p.sc;
      h += '<div class="calc-formula">g = max( σ<sub>max</sub>/σ<sub>t</sub> , −σ<sub>min</sub>/σ<sub>c</sub> )<br>' +
        'σ<sub>max</sub> = ' + fmt(hi) + '，σ<sub>min</sub> = ' + fmt(lo) + '</div>';
      h += steps([
        ['σ<sub>max</sub>/σ<sub>t</sub>', fmt(hi) + ' / ' + fmt(p.st) + ' = ' + fmt(a1)],
        ['−σ<sub>min</sub>/σ<sub>c</sub>', '−(' + fmt(lo) + ') / ' + fmt(p.sc) + ' = ' + fmt(a2)]
      ]);
    } else if (id === 'mises') {
      var d12 = s1 - s2, d23 = s2 - s3, d31 = s3 - s1;
      var sum = d12 * d12 + d23 * d23 + d31 * d31;
      h += '<div class="calc-formula">g = √[ ((σ₁−σ₂)² + (σ₂−σ₃)² + (σ₃−σ₁)²) / 2 ] / σ<sub>c</sub></div>';
      h += steps([
        ['σ₁−σ₂，σ₂−σ₃，σ₃−σ₁', fmt(d12) + '，' + fmt(d23) + '，' + fmt(d31)],
        ['平方和', fmt(sum)],
        ['平方和 / 2', fmt(sum / 2)],
        ['√(…) / σc', fmt(Math.sqrt(sum / 2)) + ' / ' + fmt(p.sc) + ' = ' + fmt(g)]
      ]);
    } else if (id === 'mc') {
      var b1 = hi / p.st, b2 = lo / p.sc;
      h += '<div class="calc-formula">g = σ<sub>max</sub>/σ<sub>t</sub> − σ<sub>min</sub>/σ<sub>c</sub><br>' +
        'σ<sub>max</sub> = ' + fmt(hi) + '，σ<sub>min</sub> = ' + fmt(lo) + '</div>';
      h += steps([
        ['σ<sub>max</sub>/σ<sub>t</sub>', fmt(hi) + ' / ' + fmt(p.st) + ' = ' + fmt(b1)],
        ['σ<sub>min</sub>/σ<sub>c</sub>', fmt(lo) + ' / ' + fmt(p.sc) + ' = ' + fmt(b2)],
        ['差值', fmt(b1) + ' − (' + fmt(b2) + ') = ' + fmt(g)]
      ]);
    } else {
      var t1 = p.F11 * (s1 + s2);
      var t2 = p.F33 * s3;
      var t3 = p.G11 * (s1 * s1 + s2 * s2);
      var t4 = p.G33 * s3 * s3;
      var t5 = 2 * p.G12 * s1 * s2;
      var t6 = 2 * p.G13 * (s1 + s2) * s3;
      h += '<div class="calc-formula">g = F<sub>11</sub>(σ₁+σ₂) + F<sub>33</sub>σ₃ + G<sub>11</sub>(σ₁²+σ₂²) + G<sub>33</sub>σ₃² + 2G<sub>12</sub>σ₁σ₂ + 2G<sub>13</sub>(σ₁+σ₂)σ₃</div>';
      h += steps([
        ['F11(σ₁+σ₂)', fmt4(p.F11) + ' × ' + fmt(s1 + s2) + ' = ' + fmt(t1)],
        ['F33·σ₃', fmt4(p.F33) + ' × ' + fmt(s3) + ' = ' + fmt(t2)],
        ['G11(σ₁²+σ₂²)', fmt4(p.G11) + ' × ' + fmt(s1 * s1 + s2 * s2) + ' = ' + fmt(t3)],
        ['G33·σ₃²', fmt4(p.G33) + ' × ' + fmt(s3 * s3) + ' = ' + fmt(t4)],
        ['2G12·σ₁σ₂', fmt4(2 * p.G12) + ' × ' + fmt(s1 * s2) + ' = ' + fmt(t5)],
        ['2G13(σ₁+σ₂)σ₃', fmt4(2 * p.G13) + ' × ' + fmt((s1 + s2) * s3) + ' = ' + fmt(t6)],
        ['合计 g', fmt(t1 + t2 + t3 + t4 + t5 + t6)]
      ]);
    }

    var stateTxt = g >= 1 ? '已失效' : (g >= 0.85 ? '接近失效面' : '安全');
    h += '<div class="calc-verdict">判定：<strong class="' + (g >= 1 ? 'bad' : '') + '">' + stateTxt +
      '</strong>（g ' + (g >= 1 ? '≥' : '<') + ' 1）</div>';

    $('detailHint').textContent = SHORT[id];
    $('detailBody').innerHTML = h;
  }

  function steps(rows) {
    var h = '<div class="calc-steps">';
    rows.forEach(function (r) {
      h += '<div class="calc-step"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    });
    return h + '</div>';
  }

  /* ------------------------------------------------------------ 绘制入口 */
  function invalidate() {
    envCache.key = '';
    sliceCache.key = '';
    fitCache.key = '';
  }

  function onResize() {
    var r = stage.getBoundingClientRect();
    view.w = Math.max(1, Math.round(r.width));
    view.h = Math.max(1, Math.round(r.height));
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    [chart2d, scene3d].forEach(function (c) {
      c.width = Math.round(view.w * view.dpr);
      c.height = Math.round(view.h * view.dpr);
    });
    draw();
    moveThumb();
  }

  function draw() {
    if (!view.w || !view.h) return;
    if (state.mode === '2d') draw2D(); else draw3D();
  }

  function defaultR() {
    return Math.max(state.mat.st * 3, state.mat.sc * 1.32, 1.8);
  }

  function fitRange() {
    var key = [state.mat.st, state.mat.sc, state.mat.S, state.stress[2],
      IDS.map(function (id) { return state.vis[id] ? 1 : 0; }).join('')].join('|');
    if (fitCache.key === key) return fitCache.R;
    var max = 0;
    IDS.forEach(function (id) {
      if (state.vis[id]) max = Math.max(max, C.extent(id, state.stress[2]));
    });
    var R = max > 0 ? Math.min(30, Math.max(1, max * 1.08)) : defaultR();
    fitCache = { key: key, R: R };
    return R;
  }

  function getEnvelopes(R) {
    var key = [state.mat.st, state.mat.sc, state.mat.S, state.stress[2], R,
      IDS.map(function (id) { return state.vis[id] ? 1 : 0; }).join('')].join('|');
    if (envCache.key === key) return envCache.data;
    var data = {};
    IDS.forEach(function (id) {
      if (state.vis[id]) data[id] = C.envelope(id, state.stress[2], R, 190);
    });
    envCache = { key: key, data: data };
    return data;
  }

  function getSliceEnvelopes(z, B) {
    var key = [state.mat.st, state.mat.sc, state.mat.S, z, B,
      IDS.map(function (id) { return state.vis[id] ? 1 : 0; }).join('')].join('|');
    if (sliceCache.key === key) return sliceCache.data;
    var data = {};
    IDS.forEach(function (id) {
      if (state.vis[id]) data[id] = C.envelope(id, z, B, 180);
    });
    sliceCache = { key: key, data: data };
    return data;
  }

  /* ------------------------------------------------------------ 二维 */
  function draw2D() {
    var ctx = chart2d.getContext('2d');
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#08131d');
    bg.addColorStop(0.55, '#081721');
    bg.addColorStop(1, '#0a1b26');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W * 0.52, H * 0.48, 20, W * 0.52, H * 0.48, Math.max(W, H) * 0.62);
    glow.addColorStop(0, 'rgba(58, 140, 165, .10)');
    glow.addColorStop(1, 'rgba(8, 19, 29, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    var padL = 56, padR = 26, padT = 42;
    var padB = view.w < 620 ? 78 : 98;
    var availW = W - padL - padR;
    var availH = H - padT - padB;
    var size = Math.min(availW, availH);
    if (size < 60) return;
    var cx = padL + availW / 2;
    var cy = padT + availH / 2;
    var R = state.fit ? fitRange() : defaultR();
    var scale = (size / 2) / R;
    var left = cx - size / 2, top = cy - size / 2, right = cx + size / 2, bottom = cy + size / 2;
    g2d = { cx: cx, cy: cy, scale: scale, R: R, left: left, top: top, right: right, bottom: bottom };
    $('viewChip').textContent = '二维包络线 · ±' + fmt(R) + ' MPa';

    drawGrid2D(ctx, left, top, size, R, scale, cx, cy);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, size, size);
    ctx.clip();

    var env = getEnvelopes(R);
    var order = IDS.filter(function (id) { return state.vis[id] && id !== state.selected; });
    if (state.selected && state.vis[state.selected]) order.push(state.selected);
    order.forEach(function (id) {
      var pts = env[id];
      if (!pts) return;
      drawEnvelope(ctx, pts, COLORS[id], state.selected === id, cx, cy, scale);
    });

    // 应力点与投影虚线
    var s1 = state.stress[0], s2 = state.stress[1];
    var px = cx + s1 * scale, py = cy - s2 * scale;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(210, 235, 245, .22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py); ctx.lineTo(cx, py);
    ctx.moveTo(px, py); ctx.lineTo(px, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    var all = C.allG(s1, s2, state.stress[2]);
    var maxId = IDS[0], maxG = -Infinity;
    IDS.forEach(function (id) { if (all[id] > maxG) { maxG = all[id]; maxId = id; } });

    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.strokeStyle = hexA(COLORS[maxId], .35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = '#f2fbff';
    ctx.shadowColor = hexA(COLORS[maxId], .95);
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 点标签
    drawLabel(ctx, px, py, [
      'σ₁ ' + fmt(s1) + '   σ₂ ' + fmt(s2),
      'g_max ' + fmt(maxG) + ' · ' + SHORT[maxId]
    ], { left: left, top: top, right: right, bottom: bottom }, COLORS[maxId]);

    ctx.restore();

    // 边框与轴标题（不被裁剪）
    ctx.strokeStyle = 'rgba(190, 225, 238, .13)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left + .5, top + .5, size - 1, size - 1);

    ctx.font = '500 9.5px ' + MONO;
    ctx.fillStyle = 'rgba(190, 220, 232, .45)';
    ctx.textAlign = 'center';
    ctx.fillText('σ₁ / MPa', cx, bottom + 31);

    // 光标读数（不参与状态，只在画布上提示）
    if (hover) {
      var ht = '光标  σ₁ ' + fmt(hover.s1) + '   σ₂ ' + fmt(hover.s2);
      ctx.font = '500 9px ' + MONO;
      var hw = ctx.measureText(ht).width + 16;
      var hx = right - hw - 10, hy = top + 10;
      ctx.fillStyle = 'rgba(4, 12, 18, .66)';
      roundRect(ctx, hx, hy, hw, 21, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190, 225, 238, .16)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(214, 229, 236, .66)';
      ctx.textAlign = 'left';
      ctx.fillText(ht, hx + 8, hy + 14);
    }
  }

  function drawGrid2D(ctx, left, top, size, R, scale, cx, cy) {
    var step = niceStep(R / 4);
    var n = Math.floor(R / step + 1e-9);
    var bottom = top + size, right = left + size;

    ctx.lineWidth = 1;
    ctx.font = '500 8.5px ' + MONO;
    ctx.textAlign = 'center';

    for (var i = -n; i <= n; i++) {
      var v = i * step;
      var x = cx + v * scale;
      var y = cy - v * scale;
      if (Math.abs(v) > 1e-9) {
        ctx.strokeStyle = 'rgba(178, 214, 228, .065)';
        ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x, bottom);
        ctx.moveTo(left, y); ctx.lineTo(right, y);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(150, 180, 194, .5)';
      if (Math.abs(v) <= R + 1e-9) {
        ctx.fillText(fmtTick(v, step), x, bottom + 15);
        ctx.textAlign = 'right';
        ctx.fillText(fmtTick(v, step), left - 8, y + 3);
        ctx.textAlign = 'center';
      }
    }

    // 零轴
    ctx.strokeStyle = 'rgba(190, 225, 238, .24)';
    ctx.beginPath();
    ctx.moveTo(left, cy); ctx.lineTo(right, cy);
    ctx.moveTo(cx, top); ctx.lineTo(cx, bottom);
    ctx.stroke();
  }

  function drawEnvelope(ctx, pts, color, selected, cx, cy, scale) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = cx + pts[i][0] * scale;
      var y = cy - pts[i][1] * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = hexA(color, selected ? .07 : .035);
    ctx.fill();
    ctx.lineJoin = 'round';
    if (selected) {
      ctx.shadowColor = hexA(color, .55);
      ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = hexA(color, selected ? .95 : .62);
    ctx.lineWidth = selected ? 2 : 1.3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ------------------------------------------------------------ 三维 */
  function box3d() {
    return Math.min(24, Math.max(9.5, state.mat.sc * 2.1, state.mat.st * 3.8));
  }

  function draw3D() {
    var ctx = scene3d.getContext('2d');
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#07111a');
    bg.addColorStop(0.6, '#081722');
    bg.addColorStop(1, '#0a1c27');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W * .55, H * .42, 20, W * .55, H * .42, Math.max(W, H) * .64);
    glow.addColorStop(0, 'rgba(58, 140, 165, .12)');
    glow.addColorStop(1, 'rgba(8, 19, 29, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    var B = box3d();
    var cam = makeCam(B);
    var proj = cam.project;

    drawFloor3D(ctx, proj, B);
    drawBox3D(ctx, proj, B);
    drawSlice3D(ctx, proj, B);
    drawAxes3D(ctx, proj, B);
    drawPoint3D(ctx, proj, B);

    // 角标
    ctx.font = '500 8.5px ' + MONO;
    ctx.fillStyle = 'rgba(126, 150, 164, .55)';
    ctx.textAlign = 'left';
    ctx.fillText('主应力空间 · 视窗 ±' + fmt(B) + ' MPa', 14, H - 16);
  }

  function makeCam(B) {
    var cp = Math.cos(state.cam.pitch), sp = Math.sin(state.cam.pitch);
    var cy = Math.cos(state.cam.yaw), sy = Math.sin(state.cam.yaw);
    var dist = B * 1.98 * state.cam.zoom;
    var eye = [dist * cp * cy, dist * cp * sy, dist * sp];
    var fwd = norm([-eye[0], -eye[1], -eye[2]]);
    var right = norm(cross(fwd, [0, 0, 1]));
    var up = cross(right, fwd);
    var f = 1.12 * Math.min(view.w, view.h);
    var ox = view.w / 2 + state.cam.panX;
    var oy = view.h / 2 + state.cam.panY;

    return {
      project: function (p) {
        var vx = p[0] - eye[0], vy = p[1] - eye[1], vz = p[2] - eye[2];
        var z = vx * fwd[0] + vy * fwd[1] + vz * fwd[2];
        if (z < 0.06) return null;
        return [
          ox + f * (vx * right[0] + vy * right[1] + vz * right[2]) / z,
          oy - f * (vx * up[0] + vy * up[1] + vz * up[2]) / z,
          z
        ];
      }
    };
  }

  function drawFloor3D(ctx, proj, B) {
    var step = niceStep(B / 3.2);
    var n = Math.floor(B / step);
    ctx.lineWidth = 1;
    for (var i = -n; i <= n; i++) {
      var v = i * step;
      var a = proj([-B, v, -B]), b = proj([B, v, -B]);
      var c = proj([v, -B, -B]), d = proj([v, B, -B]);
      ctx.strokeStyle = 'rgba(150, 190, 205, .045)';
      if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      if (c && d) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    }
    var p1 = proj([-B, -B, -B]), p2 = proj([B, -B, -B]), p3 = proj([B, B, -B]), p4 = proj([-B, B, -B]);
    if (p1 && p2 && p3 && p4) {
      ctx.strokeStyle = 'rgba(150, 190, 205, .10)';
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.closePath();
      ctx.stroke();
    }
  }

  function drawBox3D(ctx, proj, B) {
    var corners = [];
    for (var i = 0; i < 8; i++) {
      corners.push([(i & 1 ? B : -B), (i & 2 ? B : -B), (i & 4 ? B : -B)]);
    }
    var edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(160, 200, 215, .32)';
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var a = proj(corners[e[0]]), b = proj(corners[e[1]]);
      if (!a || !b) return;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // 把平面多边形裁剪到 [-B, B] 的方形内（Sutherland–Hodgman）
  function clipPoly2(pts, B) {
    var insideFns = [
      function (p) { return p[0] >= -B; },
      function (p) { return p[0] <= B; },
      function (p) { return p[1] >= -B; },
      function (p) { return p[1] <= B; }
    ];
    var out = pts;
    for (var e = 0; e < 4; e++) {
      var inside = insideFns[e];
      var input = out;
      out = [];
      if (!input.length) break;
      for (var i = 0; i < input.length; i++) {
        var a = input[i], b = input[(i + 1) % input.length];
        var ain = inside(a), bin = inside(b);
        if (ain) out.push(a);
        if (ain !== bin) {
          var t = 0, x, y;
          if (e === 0) { t = (-B - a[0]) / (b[0] - a[0]); x = -B; y = a[1] + t * (b[1] - a[1]); }
          else if (e === 1) { t = (B - a[0]) / (b[0] - a[0]); x = B; y = a[1] + t * (b[1] - a[1]); }
          else if (e === 2) { t = (-B - a[1]) / (b[1] - a[1]); y = -B; x = a[0] + t * (b[0] - a[0]); }
          else { t = (B - a[1]) / (b[1] - a[1]); y = B; x = a[0] + t * (b[0] - a[0]); }
          out.push([x, y]);
        }
      }
    }
    return out;
  }

  function drawSlice3D(ctx, proj, B) {
    var z = state.stress[2];
    var corners = [[-B, -B, z], [B, -B, z], [B, B, z], [-B, B, z]].map(proj);
    if (corners.some(function (c) { return !c; })) return;

    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (var i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90, 176, 255, .035)';
    ctx.fill();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(120, 190, 230, .22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // 切片上的淡网格
    var step = B / 4;
    for (var k = -2; k <= 2; k++) {
      var v = k * step;
      var a = proj([-B, v, z]), b = proj([B, v, z]);
      var c = proj([v, -B, z]), d = proj([v, B, z]);
      ctx.strokeStyle = 'rgba(190, 225, 238, .055)';
      if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      if (c && d) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    }

    // 当前 σ3 处的二维包络
    var sliceEnv = getSliceEnvelopes(z, B);
    IDS.forEach(function (id) {
      if (!state.vis[id]) return;
      var pts = sliceEnv[id];
      if (!pts) return;
      var clipped = clipPoly2(pts, B);
      if (clipped.length < 3) return;
      ctx.beginPath();
      for (var ci = 0; ci < clipped.length; ci++) {
        var pr = proj([clipped[ci][0], clipped[ci][1], z]);
        if (!pr) continue;
        if (ci === 0) ctx.moveTo(pr[0], pr[1]); else ctx.lineTo(pr[0], pr[1]);
      }
      ctx.closePath();
      ctx.fillStyle = hexA(COLORS[id], state.selected === id ? .06 : .03);
      ctx.fill();
      ctx.strokeStyle = hexA(COLORS[id], state.selected === id ? .95 : .72);
      ctx.lineWidth = state.selected === id ? 2 : 1.5;
      ctx.stroke();
    });

    var lab = proj([-B, B, z]);
    if (lab) {
      ctx.font = '500 9px ' + MONO;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(120, 190, 230, .8)';
      ctx.fillText('σ₃ = ' + fmt(z), lab[0] + 8, lab[1] - 8);
    }
    $('viewChip').textContent = '三维 · σ₃ = ' + fmt(z) + ' 切片';
  }

  function drawAxes3D(ctx, proj, B) {
    var axes = [
      { v: [B, 0, 0], label: 'σ₁', align: 'left' },
      { v: [0, B, 0], label: 'σ₂', align: 'left' },
      { v: [0, 0, B], label: 'σ₃', align: 'left' }
    ];
    ctx.lineWidth = 1;
    axes.forEach(function (ax) {
      var neg = proj([-ax.v[0], -ax.v[1], -ax.v[2]]);
      var zero = proj([0, 0, 0]);
      var pos = proj(ax.v);
      if (neg && zero) {
        ctx.strokeStyle = 'rgba(190, 225, 238, .16)';
        ctx.beginPath(); ctx.moveTo(neg[0], neg[1]); ctx.lineTo(zero[0], zero[1]); ctx.stroke();
      }
      if (zero && pos) {
        ctx.strokeStyle = 'rgba(190, 225, 238, .5)';
        ctx.beginPath(); ctx.moveTo(zero[0], zero[1]); ctx.lineTo(pos[0], pos[1]); ctx.stroke();
        var back = proj([ax.v[0] * .93, ax.v[1] * .93, ax.v[2] * .93]);
        if (back) arrowHead(ctx, back, pos, 'rgba(190, 225, 238, .5)');
        ctx.font = '500 10px ' + MONO;
        ctx.fillStyle = 'rgba(210, 236, 245, .78)';
        ctx.textAlign = 'left';
        ctx.fillText(ax.label, pos[0] + 6, pos[1] + 3);
      }
    });
    var o = proj([0, 0, 0]);
    if (o) {
      ctx.fillStyle = 'rgba(190, 225, 238, .35)';
      ctx.beginPath(); ctx.arc(o[0], o[1], 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function arrowHead(ctx, from, to, color) {
    var dx = to[0] - from[0], dy = to[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var size = 7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    [0.42, -0.42].forEach(function (a) {
      ctx.beginPath();
      ctx.moveTo(to[0], to[1]);
      ctx.lineTo(to[0] - size * (ux * Math.cos(a) - uy * Math.sin(a)),
        to[1] - size * (uy * Math.cos(a) + ux * Math.sin(a)));
      ctx.stroke();
    });
  }

  function drawPoint3D(ctx, proj, B) {
    var s = state.stress;
    var center = proj(s);
    if (!center) return;

    var floorPt = proj([s[0], s[1], -B]);
    if (floorPt) {
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = 'rgba(190, 225, 238, .16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center[0], center[1]);
      ctx.lineTo(floorPt[0], floorPt[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(190, 225, 238, .25)';
      ctx.beginPath(); ctx.arc(floorPt[0], floorPt[1], 2, 0, Math.PI * 2); ctx.fill();
    }

    var feet = [[s[0], 0, 0], [0, s[1], 0], [0, 0, s[2]]];
    feet.forEach(function (f) {
      var q = proj(f);
      if (!q) return;
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(210, 235, 245, .2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(center[0], center[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(210, 235, 245, .35)';
      ctx.beginPath(); ctx.arc(q[0], q[1], 1.6, 0, Math.PI * 2); ctx.fill();
    });

    var all = C.allG(s[0], s[1], s[2]);
    var maxId = IDS[0], maxG = -Infinity;
    IDS.forEach(function (id) { if (all[id] > maxG) { maxG = all[id]; maxId = id; } });

    ctx.beginPath();
    ctx.arc(center[0], center[1], 11, 0, Math.PI * 2);
    ctx.strokeStyle = hexA(COLORS[maxId], .32);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center[0], center[1], 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f2fbff';
    ctx.shadowColor = hexA(COLORS[maxId], .95);
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    drawLabel(ctx, center[0], center[1], [
      'σ (' + fmt(s[0]) + ', ' + fmt(s[1]) + ', ' + fmt(s[2]) + ')',
      'g_max ' + fmt(maxG) + ' · ' + SHORT[maxId]
    ], { left: 4, top: 4, right: view.w - 4, bottom: view.h - 4 }, COLORS[maxId]);
  }

  /* ------------------------------------------------------------ 交互 */
  function bind2D() {
    chart2d.addEventListener('pointerdown', function (e) {
      if (!g2d) return;
      var pt = localPoint(e, chart2d);
      if (pt.x < g2d.left || pt.x > g2d.right || pt.y < g2d.top || pt.y > g2d.bottom) return;
      dragging2d = true;
      chart2d.setPointerCapture(e.pointerId);
      applyPointer2D(pt.x, pt.y);
      e.preventDefault();
    });
    chart2d.addEventListener('pointermove', function (e) {
      if (!g2d) return;
      var pt = localPoint(e, chart2d);
      if (dragging2d) { hover = null; applyPointer2D(pt.x, pt.y); return; }
      if (pt.x >= g2d.left && pt.x <= g2d.right && pt.y >= g2d.top && pt.y <= g2d.bottom) {
        hover = {
          s1: (pt.x - g2d.cx) / g2d.scale,
          s2: (g2d.cy - pt.y) / g2d.scale
        };
      } else {
        hover = null;
      }
      draw2D();
    });
    chart2d.addEventListener('pointerup', function () { dragging2d = false; });
    chart2d.addEventListener('pointercancel', function () { dragging2d = false; });
    chart2d.addEventListener('pointerleave', function () { hover = null; draw2D(); });
    chart2d.addEventListener('dblclick', function () {
      state.stress[0] = 0; state.stress[1] = 0;
      syncStress(); updateAll(true); commitHash();
    });
  }

  function applyPointer2D(x, y) {
    var s1 = (x - g2d.cx) / g2d.scale;
    var s2 = (g2d.cy - y) / g2d.scale;
    state.stress[0] = Math.round(clamp(s1, -g2d.R, g2d.R) * 100) / 100;
    state.stress[1] = Math.round(clamp(s2, -g2d.R, g2d.R) * 100) / 100;
    syncStress();
    updateAll(true);
    commitHash();
    hideHint();
  }

  function bind3D() {
    scene3d.addEventListener('pointerdown', function (e) {
      scene3d.setPointerCapture(e.pointerId);
      dragging3d = {
        x: e.clientX, y: e.clientY,
        pan: e.button === 2 || e.shiftKey
      };
      hideHint();
      e.preventDefault();
    });
    scene3d.addEventListener('pointermove', function (e) {
      if (!dragging3d) return;
      var dx = e.clientX - dragging3d.x;
      var dy = e.clientY - dragging3d.y;
      dragging3d.x = e.clientX;
      dragging3d.y = e.clientY;
      if (dragging3d.pan) {
        state.cam.panX += dx;
        state.cam.panY += dy;
      } else {
        state.cam.yaw -= dx * 0.0072;
        state.cam.pitch = clamp(state.cam.pitch + dy * 0.006, -1.25, 1.35);
      }
      draw3D();
    });
    scene3d.addEventListener('pointerup', function () { dragging3d = null; });
    scene3d.addEventListener('pointercancel', function () { dragging3d = null; });
    scene3d.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    scene3d.addEventListener('wheel', function (e) {
      e.preventDefault();
      state.cam.zoom = clamp(state.cam.zoom * Math.exp(e.deltaY * 0.0012), 0.5, 2.4);
      draw3D();
    }, { passive: false });
    scene3d.addEventListener('dblclick', resetCam);
  }

  function resetCam() {
    state.cam = { yaw: -0.70, pitch: 0.50, zoom: 1, panX: 0, panY: 0 };
    if (state.mode === '3d') {
      draw3D();
      toast('视角已复位');
    } else {
      state.fit = false;
      $('btnFit').classList.remove('is-on');
      invalidate();
      draw();
      commitHash();
      toast('视窗已复位');
    }
  }

  function hideHint() {
    stageHint.classList.add('is-hidden');
  }

  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (e.key === 'Escape') { closeHelp(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      var k = e.key;
      if (k === '?') { e.preventDefault(); openHelp(); return; }
      if (k === 'd' || k === 'D') { setMode(state.mode === '2d' ? '3d' : '2d'); return; }
      if (k === 'r' || k === 'R') { resetCam(); return; }
      if (k === 's' || k === 'S') { e.preventDefault(); shot(); return; }
      if (k === 'f' || k === 'F') { e.preventDefault(); toggleFull(); return; }
      if (k === '0') { state.selected = null; updateAll(false); draw(); return; }
      if (k >= '1' && k <= '4') {
        state.selected = IDS[parseInt(k, 10) - 1];
        updateAll(false); draw(); return;
      }
      if (k === 'ArrowLeft') { e.preventDefault(); nudge(0, -0.05); }
      else if (k === 'ArrowRight') { e.preventDefault(); nudge(0, 0.05); }
      else if (k === 'ArrowUp') { e.preventDefault(); nudge(1, 0.05); }
      else if (k === 'ArrowDown') { e.preventDefault(); nudge(1, -0.05); }
      else if (k === 'PageUp') { e.preventDefault(); nudge(2, 0.05); }
      else if (k === 'PageDown') { e.preventDefault(); nudge(2, -0.05); }
    });
  }

  function nudge(i, d) {
    setStress(i, state.stress[i] + d);
  }

  function copyLink() {
    commitHash(true);
    copyText(location.href).then(function () {
      toast('链接已复制，包含全部参数');
    }).catch(function () {
      toast('复制失败，请从地址栏复制');
    });
  }

  function shot() {
    var canvas = state.mode === '2d' ? chart2d : scene3d;
    var name = 'yiting-ice-' + state.mode + '-' + Date.now() + '.png';
    var done = function (url, revoke) {
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('已保存 PNG');
    };
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (!blob) { done(canvas.toDataURL('image/png'), false); return; }
        done(URL.createObjectURL(blob), true);
      }, 'image/png');
    } else {
      done(canvas.toDataURL('image/png'), false);
    }
  }

  function toggleFull() {
    if (!document.fullscreenElement) {
      if (stage.requestFullscreen) stage.requestFullscreen().catch(function () { toast('当前浏览器不支持全屏'); });
    } else {
      document.exitFullscreen();
    }
  }

  function openHelp() {
    lastFocus = document.activeElement;
    helpModal.hidden = false;
    var x = helpModal.querySelector('.modal-x');
    if (x) x.focus();
  }
  function closeHelp() {
    if (helpModal.hidden) return;
    helpModal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function toast(msg) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  /* ------------------------------------------------------------ 工具 */
  function localPoint(e, canvas) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function fmt(v) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v) < 0.005) v = 0;
    return v.toFixed(2).replace('-', '−');
  }
  function fmt4(v) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v) < 0.00005) v = 0;
    return v.toFixed(4).replace('-', '−');
  }
  function fmtTick(v, step) {
    var s;
    if (Math.abs(v - Math.round(v)) < 1e-6) s = String(Math.round(v));
    else if (step < 1) s = v.toFixed(2);
    else s = v.toFixed(1);
    return s.replace('-', '−');
  }
  function niceStep(x) {
    var p = Math.pow(10, Math.floor(Math.log10(x)));
    var m = x / p;
    if (m < 1.5) return p;
    if (m < 3) return 2 * p;
    if (m < 7) return 5 * p;
    return 10 * p;
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawLabel(ctx, x, y, lines, bounds, color) {
    ctx.font = '500 9.5px ' + MONO;
    var w = 0;
    lines.forEach(function (t) { w = Math.max(w, ctx.measureText(t).width); });
    w += 18;
    var h = lines.length * 14 + 10;
    var bx = x + 15, by = y - h - 12;
    if (bx + w > bounds.right) bx = x - w - 15;
    if (by < bounds.top) by = y + 16;
    bx = clamp(bx, bounds.left + 3, bounds.right - w - 3);
    by = clamp(by, bounds.top + 3, bounds.bottom - h - 3);

    ctx.fillStyle = 'rgba(4, 12, 18, .82)';
    roundRect(ctx, bx, by, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = hexA(color, .35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    lines.forEach(function (t, i) {
      ctx.fillStyle = i === 0 ? 'rgba(230, 245, 252, .88)' : hexA(color, .9);
      ctx.fillText(t, bx + 9, by + 15 + i * 14);
    });
  }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(a) {
    var l = Math.sqrt(dot(a, a)) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  // 只读调试入口：便于自动化检查布局与状态（不影响交互）
  window.IceLab = {
    state: state,
    view: view,
    draw: draw,
    get g2d() { return g2d; }
  };
})();
