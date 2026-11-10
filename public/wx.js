/* 天気マーク（細い線のアイコン）。48x48の座標で描いた線画で、色は currentColor（文字色）に従う。
   インラインSVGとしても、canvas(Path2D)にも同じデータで描ける。window.WX として使う。
   - WX.el(key, size)       → <svg> の要素（天気アイコン）
   - WX.draw(ctx,key,cx,top,size,color) → グラフ(canvas)に描く
   - WX.fromOwm('10d')      → OpenWeatherMapのコードからキーへ
   キー: sun moon cloud cloud-sun cloud-moon rain rain-sun rain-moon thunder snow sleet fog wind umbrella thermo */
(function () {
  // 雲(アウトライン)。左下(x,y)を起点に、倍率kで描く。
  function cloud(x, y, k) {
    var f = function (n) { return +(n * k).toFixed(2); };
    return 'M' + x + ' ' + y + 'h' + f(20) + 'a' + f(7) + ' ' + f(7) + ' 0 0 0 ' + f(1.2) + ' ' + f(-13.9) +
      'a' + f(10) + ' ' + f(10) + ' 0 0 0 ' + f(-19.8) + ' ' + f(-1.3) + 'a' + f(7.6) + ' ' + f(7.6) + ' 0 0 0 ' + f(-1.4) + ' ' + f(15.2) + 'z';
  }
  // 雨の線（斜め）。(x,y)から下へ
  function drop(x, y, len) { return 'M' + x + ' ' + y + 'l' + (-len * 0.45).toFixed(1) + ' ' + len; }
  // 雪の結晶（3本の線の交差）
  function flake(x, y, r) {
    var a = r, b = +(r * 0.5).toFixed(2), c = +(r * 0.87).toFixed(2);
    return 'M' + x + ' ' + (y - a) + 'v' + 2 * a + 'M' + (x - c) + ' ' + (y - b) + 'l' + 2 * c + ' ' + 2 * b + 'M' + (x - c) + ' ' + (y + b) + 'l' + 2 * c + ' ' + (-2 * b);
  }
  // 太陽: 中心(cx,cy)・半径r・光線。from..to(度)の範囲だけ描ける（雲に隠れる側を省く）
  function sun(cx, cy, r, from, to, full) {
    var p = [], i, a, x1, y1, x2, y2, f = function (n) { return +n.toFixed(2); };
    var a0 = (from || 0) * Math.PI / 180, a1 = (to || 360) * Math.PI / 180;
    if (full) {
      p.push('M' + f(cx + r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + f(-2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + f(2 * r) + ' 0z');
    } else {
      p.push('M' + f(cx + r * Math.cos(a0)) + ' ' + f(cy + r * Math.sin(a0)) + 'A' + r + ' ' + r + ' 0 ' + ((to - from) > 180 ? 1 : 0) + ' 1 ' + f(cx + r * Math.cos(a1)) + ' ' + f(cy + r * Math.sin(a1)));
    }
    for (i = 0; i < 8; i++) {
      var deg = i * 45;
      if (!full && (deg * Math.PI / 180 < a0 - 0.01 || deg * Math.PI / 180 > a1 + 0.01)) continue;
      a = deg * Math.PI / 180;
      x1 = cx + (r + 3.2) * Math.cos(a); y1 = cy + (r + 3.2) * Math.sin(a);
      x2 = cx + (r + 6.4) * Math.cos(a); y2 = cy + (r + 6.4) * Math.sin(a);
      p.push('M' + f(x1) + ' ' + f(y1) + 'L' + f(x2) + ' ' + f(y2));
    }
    return p.join('');
  }
  // 三日月
  function moon(cx, cy, r) {
    var f = function (n) { return +n.toFixed(2); };
    return 'M' + f(cx + r * 0.35) + ' ' + f(cy - r * 0.97) + 'A' + r + ' ' + r + ' 0 1 0 ' + f(cx + r * 0.97) + ' ' + f(cy + r * 0.35) +
      'A' + f(r * 0.82) + ' ' + f(r * 0.82) + ' 0 0 1 ' + f(cx + r * 0.35) + ' ' + f(cy - r * 0.97) + 'z';
  }

  var ICONS = {
    sun: [sun(24, 24, 7.5, 0, 360, true)],
    moon: [moon(24, 24, 14)],
    cloud: [cloud(12, 34, 1.15)],
    'cloud-sun': [sun(16, 16, 5.4, 100, 340), cloud(17, 38, 0.95)],
    'cloud-moon': [moon(15, 15, 7.2), cloud(18, 39, 0.95)],
    rain: [cloud(12, 31, 1.1), drop(19, 36, 5.5), drop(26, 36, 5.5), drop(33, 36, 5.5), drop(22.5, 42.5, 4), drop(29.5, 42.5, 4)],
    'rain-sun': [sun(15, 14, 5, 100, 300), cloud(18, 34, 0.95), drop(24, 38, 4.5), drop(31, 38, 4.5), drop(27.5, 44, 3.5)],
    'rain-moon': [moon(14, 14, 6.6), cloud(18, 34, 0.95), drop(24, 38, 4.5), drop(31, 38, 4.5), drop(27.5, 44, 3.5)],
    thunder: [cloud(12, 30, 1.1), 'M26.5 31.5l-5 7.5h6.5l-4.2 7.5'],
    snow: [cloud(12, 30, 1.1), flake(20, 38, 2.4), flake(30, 38, 2.4), flake(25, 44.5, 2.4)],
    sleet: [cloud(12, 30, 1.1), drop(19, 35, 5), drop(26, 35, 5), flake(31, 40, 2.3), flake(22, 44.5, 2.3)],
    fog: [cloud(12, 28, 1.05), 'M9 34.5h30M13 39.5h22M9 44.5h30'],
    wind: ['M6 20h22a4.5 4.5 0 1 0-4.5-4.5', 'M6 28h30a4.5 4.5 0 1 1-4.5 4.5', 'M6 36h16'],
    umbrella: ['M6 25a18 18 0 0 1 36 0z', 'M24 25v14a3.2 3.2 0 0 1-6.4 0', 'M24 7v-2'],
    thermo: ['M20 28V10a4 4 0 0 1 8 0v18a8 8 0 1 1-8 0z', 'M24 14v17', 'M24 31m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0']
  };
  var LABEL = {
    sun: '晴れ', moon: '晴れ（夜）', cloud: 'くもり', 'cloud-sun': '晴れ時々くもり', 'cloud-moon': 'くもり（夜）', rain: '雨',
    'rain-sun': '晴れ一時雨', 'rain-moon': '雨（夜）', thunder: '雷', snow: '雪', sleet: 'みぞれ', fog: '霧', wind: '風', umbrella: '傘', thermo: '気温'
  };
  var OWM = {
    '01d': 'sun', '01n': 'moon', '02d': 'cloud-sun', '02n': 'cloud-moon', '03d': 'cloud', '03n': 'cloud', '04d': 'cloud', '04n': 'cloud',
    '09d': 'rain', '09n': 'rain', '10d': 'rain-sun', '10n': 'rain-moon', '11d': 'thunder', '11n': 'thunder', '13d': 'snow', '13n': 'snow', '50d': 'fog', '50n': 'fog'
  };
  var NS = 'http://www.w3.org/2000/svg';

  function el(key, size, sw) {
    var d = ICONS[key];
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', size || 32); svg.setAttribute('height', size || 32);
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', sw || 2); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', 'wx');
    if (!d) { svg.setAttribute('aria-hidden', 'true'); return svg; }
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', LABEL[key] || '');
    d.forEach(function (s) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', s); svg.appendChild(p); });
    return svg;
  }
  var cache = {};
  function draw(ctx, key, cx, top, size, color, sw) {
    var d = ICONS[key];
    if (!d) return;
    ctx.save();
    ctx.translate(cx - size / 2, top);
    ctx.scale(size / 48, size / 48);
    ctx.strokeStyle = color; ctx.lineWidth = sw || 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    d.forEach(function (s) { var p = cache[s] || (cache[s] = new Path2D(s)); ctx.stroke(p); });
    ctx.restore();
  }
  window.WX = { ICONS: ICONS, LABEL: LABEL, el: el, draw: draw, fromOwm: function (c) { return OWM[c] || 'cloud'; } };
})();
