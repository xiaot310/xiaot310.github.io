/* =====================================================================
 * ice-criteria.js — 四种海冰失效准则（站点共用，无依赖）
 * 拉为正、压为负，单位 MPa。
 * 由单轴拉伸 σt、单轴压缩 σc、纯剪切强度 S 标定。
 * 暴露 window.IceCriteria。
 * ===================================================================== */
(function (global) {
  'use strict';

  var COLORS = {
    rank: '#ff8a5c',
    mises: '#5ab0ff',
    mc: '#b48cff',
    tw: '#4fd1b5'
  };

  var ORDER = ['rank', 'mises', 'mc', 'tw'];

  var P = {
    st: 0.8, sc: 4.0, S: 1.0,
    sinPhi: 0, phi: 0, c: 0,
    F11: 0, F33: 0, G11: 0, G33: 0, G12: 0, G13: 0,
    sMin: 0, apex: 0
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* 由三个强度重新标定所有系数；返回生效值（可能被夹紧）。 */
  function set(st, sc, S) {
    st = clamp(Number(st) || 0.8, 0.2, 2.0);
    sc = clamp(Number(sc) || 4.0, 0.4, 10.0);
    if (sc - st < 0.1) sc = Math.min(10, st + 0.1);

    // 剪切强度下限：保证 Tsai–Wu 的二次型不退化为双曲面
    var sMin = 0.5 * Math.sqrt(st * sc) * 1.02;
    S = Number(S);
    if (!isFinite(S)) S = 1.0;
    S = clamp(S, sMin, 6.0);

    P.st = st; P.sc = sc; P.S = S; P.sMin = sMin;

    P.sinPhi = (sc - st) / (sc + st);
    P.phi = Math.asin(P.sinPhi);
    P.c = st * (1 + P.sinPhi) / (2 * Math.cos(P.phi));

    P.F11 = 1 / st - 1 / sc;
    P.F33 = 0.5 * P.F11;                 // 柱轴方向：线性项一半
    P.G11 = 1 / (st * sc);
    P.G33 = 0.25 * P.G11;                // 柱轴方向：二次项四分之一
    P.G12 = P.G11 - 1 / (2 * S * S);     // 由纯剪切 (S, −S) 标定
    P.G13 = -0.2 * P.G11;                // 面内–柱轴交叉项

    // 静水拉伸闭合点：a p² + b p − 1 = 0
    var a = 2 * P.G11 + P.G33 + 2 * P.G12 + 4 * P.G13;
    var b = 2 * P.F11 + P.F33;
    P.apex = (-b + Math.sqrt(b * b + 4 * a)) / (2 * a);

    return P;
  }

  /* ---- 四种准则的等值函数 g：g < 1 安全，g ≥ 1 破坏 ---- */
  function gRank(s1, s2, s3) {
    var hi = Math.max(s1, s2, s3);
    var lo = Math.min(s1, s2, s3);
    return Math.max(hi / P.st, -lo / P.sc, 0);
  }
  function gMises(s1, s2, s3) {
    var a = s1 - s2, b = s2 - s3, c = s3 - s1;
    return Math.sqrt((a * a + b * b + c * c) / 2) / P.sc;
  }
  function gMC(s1, s2, s3) {
    var hi = Math.max(s1, s2, s3);
    var lo = Math.min(s1, s2, s3);
    return hi / P.st - lo / P.sc;
  }
  function gTW(s1, s2, s3) {
    return P.F11 * (s1 + s2) + P.F33 * s3
      + P.G11 * (s1 * s1 + s2 * s2) + P.G33 * s3 * s3
      + 2 * P.G12 * s1 * s2 + 2 * P.G13 * (s1 + s2) * s3;
  }

  function g(id, s1, s2, s3) {
    switch (id) {
      case 'rank': return gRank(s1, s2, s3);
      case 'mises': return gMises(s1, s2, s3);
      case 'mc': return gMC(s1, s2, s3);
      case 'tw': return gTW(s1, s2, s3);
      default: return 0;
    }
  }

  /* ---- 二维切片：σ3 固定，沿极角扫描求 g = 1 的边界 ----
   * 返回闭合多边形点列（可能超出视窗，交给画布裁剪），或 null（整片已失效）。
   */
  function envelope(id, s3, R, n) {
    n = n || 144;
    R = R || 5;
    if (g(id, 0, 0, s3) >= 1) return null;

    var pts = [];
    var hiCap = Math.max(R * 3, 2);
    for (var i = 0; i <= n; i++) {
      var t = i / n * Math.PI * 2;
      var cx = Math.cos(t), cy = Math.sin(t);
      var lo = 0, hi = hiCap;
      var gh = g(id, cx * hi, cy * hi, s3);
      var guard = 0;
      while (gh < 1 && hi < 400 && guard++ < 40) {
        hi *= 1.5;
        gh = g(id, cx * hi, cy * hi, s3);
      }
      if (gh < 1) { pts.push([cx * hi, cy * hi]); continue; }
      for (var k = 0; k < 38; k++) {
        var mid = (lo + hi) / 2;
        if (g(id, cx * mid, cy * mid, s3) < 1) lo = mid; else hi = mid;
      }
      var r = (lo + hi) / 2;
      pts.push([cx * r, cy * r]);
    }
    return pts;
  }

  /* 包络在二维切片上的最大半径（用于“适配视窗”） */
  function extent(id, s3) {
    if (g(id, 0, 0, s3) >= 1) return 0;
    var maxR = 0;
    for (var i = 0; i < 72; i++) {
      var t = i / 72 * Math.PI * 2;
      var cx = Math.cos(t), cy = Math.sin(t);
      var lo = 0, hi = 0.5, gh = g(id, cx * hi, cy * hi, s3);
      var guard = 0;
      while (gh < 1 && hi < 80 && guard++ < 40) {
        hi *= 1.45;
        gh = g(id, cx * hi, cy * hi, s3);
      }
      if (gh < 1) continue;
      for (var k = 0; k < 34; k++) {
        var mid = (lo + hi) / 2;
        if (g(id, cx * mid, cy * mid, s3) < 1) lo = mid; else hi = mid;
      }
      maxR = Math.max(maxR, (lo + hi) / 2);
    }
    return maxR;
  }

  /* ---- 三维：在静水压力 p 的切片平面内，沿方向 θ 求边界半径 ----
   * 主应力空间取正交基 e1 = (2,−1,−1)/√6，e2 = (0,1,−1)/√2。
   */
  function devDir(theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return [
      (2 / Math.sqrt(6)) * c,
      (-1 / Math.sqrt(6)) * c + (1 / Math.sqrt(2)) * s,
      (-1 / Math.sqrt(6)) * c - (1 / Math.sqrt(2)) * s
    ];
  }

  function radius3D(id, p, theta) {
    if (g(id, p, p, p) >= 1) return NaN;
    var e = devDir(theta);
    var lo = 0, hi = 0.35;
    var gh = g(id, p + e[0] * hi, p + e[1] * hi, p + e[2] * hi);
    var guard = 0;
    while (gh < 1 && hi < 40 && guard++ < 32) {
      hi *= 1.45;
      gh = g(id, p + e[0] * hi, p + e[1] * hi, p + e[2] * hi);
    }
    if (gh < 1) return NaN;
    for (var k = 0; k < 36; k++) {
      var mid = (lo + hi) / 2;
      if (g(id, p + e[0] * mid, p + e[1] * mid, p + e[2] * mid) < 1) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function allG(s1, s2, s3) {
    return {
      rank: gRank(s1, s2, s3),
      mises: gMises(s1, s2, s3),
      mc: gMC(s1, s2, s3),
      tw: gTW(s1, s2, s3)
    };
  }

  global.IceCriteria = {
    ORDER: ORDER,
    COLORS: COLORS,
    set: set,
    get: function () { return P; },
    g: g,
    allG: allG,
    envelope: envelope,
    extent: extent,
    radius3D: radius3D,
    devDir: devDir
  };
})(window);
