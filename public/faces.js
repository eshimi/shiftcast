/* 痛みの度合い(1〜5)の顔アイコンと、今日の見通し(安定/上昇注意/やや注意/注意/警戒)のアイコン。手描き風の落書きテイスト（ゆがんだ輪郭、二重線、太めの丸い線）。
   64x64の座標で描いた線画で、インラインSVGにも canvas(グラフ)にも同じデータで描ける。window.FACE として使う。
   色: 線は --face-stroke（既定は見本と同じインクブルー）、塗りは痛みが強いほど暖かい色の淡い半透明。
   - FACE.el(level, size)               → <svg>（顔）
   - FACE.level(key, size)              → <svg>（見通し: none rise slight caution warning）
   - FACE.draw(ctx, level, cx, cy, size) → canvas に描く */
(function () {
  var OUT = 'M32 5C46 3.5 59 15.5 59 31C60.5 47 47.5 59.5 31 59C15.5 60 4 47.5 5 32C4.5 16.5 17 6 32 5Z';
  var OUT2 = 'M33 7.5C47 6.5 57 18 57 33C56 46.5 45 57 30 56.5C16 57 7 45 7.5 31C8.5 18 19 7.5 33 7.5Z';
  var FILL = ['rgba(110,190,255,.22)', 'rgba(150,205,255,.26)', 'rgba(255,214,110,.34)', 'rgba(255,165,95,.34)', 'rgba(255,105,105,.34)'];
  var LABEL = ['軽い', 'やや痛い', '痛い', 'かなり痛い', '耐えがたい'];
  // 目・口・汗・涙。[パス, 線の太さの倍率]
  var FACES = [
    // 1 軽い: にこっと笑う
    [['M22 24v6.5', 1], ['M42 24v6.5', 1], ['M19.5 38.5Q32 53 44.5 38.5', 1]],
    // 2 ややいたい: 眉が少し下がり、口は平ら
    [['M16 20.5l8.5 2.5', 1], ['M48 20.5l-8.5 2.5', 1], ['M22 29v4', 1], ['M42 29v4', 1], ['M23 46q4.5-3 9 0t9 0', 1], ['M52 12q3.5 5 0 8.5q-3.5-3.5 0-8.5z', 0.8]],
    // 3 いたい: 眉をひそめて、口はへの字
    [['M15.5 19l11.5 5.5', 1], ['M48.5 19L37 24.5', 1], ['M22 31v4.5', 1], ['M42 31v4.5', 1], ['M21.5 47.5Q32 38 42.5 47.5', 1]],
    // 4 かなり痛い: ぎゅっと目をつぶり、歯をくいしばる
    [['M17 22l10 6-10 6', 1], ['M47 22l-10 6 10 6', 1], ['M20 43h24v8H20z', 1], ['M26 43v8M32 43v8M38 43v8', 0.7], ['M53 13q3.5 5 0 8.5q-3.5-3.5 0-8.5z', 0.8]],
    // 5 耐えがたい: 泣き顔（涙）
    [['M17 21l10 6-10 6', 1], ['M47 21l-10 6 10 6', 1], ['M18.5 50Q25 39.5 32 46Q39 39.5 45.5 50', 1], ['M13 35q-3.5 7 0 11.5q3.5-4.5 0-11.5z', 0.8], ['M51 35q3.5 7 0 11.5q-3.5-4.5 0-11.5z', 0.8], ['M8 14l-4-3M56 14l4-3', 0.9]]
  ];
  // ---- 今日の見通し(気圧変化の5段階)のアイコン: 同じ手描きテイスト ----
  var TRI = 'M32 7.5C34.5 7.5 36.5 9.5 38.5 13L57 48.5C59.5 53 57 58 51.5 58L12.5 58C7 58 4.5 53 7 48.5L25.5 13C27.5 9.5 29.5 7.5 32 7.5Z';
  var TRI2 = 'M33 11C35 11 36.5 12.5 38 15.5L54 46C56 49.5 54 53.5 50 53.5L14.5 53.5C10.5 53.5 8.5 49.5 10.5 46L26.5 15.5C28 12.5 30 11 33 11Z';
  var LEVEL_LABEL = { none: '安定', rise: '上昇注意', slight: 'やや注意', caution: '注意', warning: '警戒' };
  // base: 下地の形(塗りあり)・base2: 二重線・marks: 中の記号
  var LEVELS = {
    none: { base: OUT, base2: OUT2, fill: 'rgba(110,200,165,.28)', marks: [['M17.5 34l9.5 10 19.5-23', 1.15]] },
    rise: { base: OUT, base2: OUT2, fill: 'rgba(110,170,255,.28)', marks: [['M32 47V19', 1.1], ['M20.5 30l11.5-12 11.5 12', 1.1]] },
    slight: { base: OUT, base2: OUT2, fill: 'rgba(255,214,110,.34)', marks: [['M32 18V40', 1.1], ['M22 32l10 10.5 10-10.5', 1.1], ['M24 50.5h16', 0.9]] },
    caution: { base: TRI, base2: TRI2, fill: 'rgba(255,165,95,.38)', marks: [['M32 24v16', 1.2], ['M32 47.5v.5', 1.5]] },
    warning: { base: 'M17.5 47.5V35C17 26.2 24 19.3 32 19.6C40.2 19.4 46.8 26 46.5 35V47.2Z', base2: null, fill: 'rgba(255,105,105,.4)',
      marks: [['M12 48C24 47 39 48.2 52 47.2L51.4 55.2C38 56.2 24.5 55 12.6 55.8Z', 1], ['M32 8v6.5', 1], ['M11 17.5l5.5 4.5M53 17.5L47.5 22', 1], ['M4.5 35h6M53.5 35h6', 1], ['M25 40V34.5', 0.9]] }
  };

  var NS = 'http://www.w3.org/2000/svg';
  var DEFAULT_STROKE = '#1d5fa6';

  function el(level, size) {
    var i = Math.min(5, Math.max(1, level | 0)) - 1;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('width', size || 36); svg.setAttribute('height', size || 36);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', LABEL[i]); svg.setAttribute('class', 'face');
    svg.style.cssText = 'fill:none;stroke:var(--face-stroke,' + DEFAULT_STROKE + ');stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;overflow:visible';
    var base = document.createElementNS(NS, 'path');
    base.setAttribute('d', OUT); base.style.fill = FILL[i]; svg.appendChild(base);
    var two = document.createElementNS(NS, 'path');
    two.setAttribute('d', OUT2); two.style.opacity = '.38'; two.style.strokeWidth = '2'; svg.appendChild(two);
    FACES[i].forEach(function (f) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', f[0]);
      if (f[1] !== 1) p.style.strokeWidth = (3.2 * f[1]).toFixed(2);
      svg.appendChild(p);
    });
    return svg;
  }
  function level(key, size) {
    var d = LEVELS[key] || LEVELS.none;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('width', size || 44); svg.setAttribute('height', size || 44);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', LEVEL_LABEL[key] || ''); svg.setAttribute('class', 'face face-level');
    svg.style.cssText = 'fill:none;stroke:var(--face-stroke,' + DEFAULT_STROKE + ');stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;overflow:visible';
    var b = document.createElementNS(NS, 'path'); b.setAttribute('d', d.base); b.style.fill = d.fill; svg.appendChild(b);
    if (d.base2) { var b2 = document.createElementNS(NS, 'path'); b2.setAttribute('d', d.base2); b2.style.opacity = '.38'; b2.style.strokeWidth = '2'; svg.appendChild(b2); }
    d.marks.forEach(function (m) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', m[0]);
      if (m[1] !== 1) p.style.strokeWidth = (3.2 * m[1]).toFixed(2);
      svg.appendChild(p);
    });
    return svg;
  }
  var cache = {};
  var path = function (d) { return cache[d] || (cache[d] = new Path2D(d)); };
  function draw(ctx, level, cx, cy, size) {
    var i = Math.min(5, Math.max(1, level | 0)) - 1;
    var stroke = (getComputedStyle(document.documentElement).getPropertyValue('--face-stroke') || '').trim() || DEFAULT_STROKE;
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 64, size / 64);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = 3.4;
    ctx.fillStyle = '#fff'; ctx.fill(path(OUT)); // 下地(グラフの線が透けないように)
    ctx.fillStyle = FILL[i]; ctx.fill(path(OUT)); ctx.stroke(path(OUT));
    ctx.globalAlpha = 0.38; ctx.lineWidth = 2; ctx.stroke(path(OUT2)); ctx.globalAlpha = 1;
    FACES[i].forEach(function (f) { ctx.lineWidth = 3.4 * f[1]; ctx.stroke(path(f[0])); });
    ctx.restore();
  }
  window.FACE = { el: el, draw: draw, level: level, LABEL: LABEL, LEVEL_LABEL: LEVEL_LABEL };
})();
