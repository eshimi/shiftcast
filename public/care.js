/* /care: 今日の判定(体調そらもよう)を読み込み、効いた要因の対策に印を付ける */
(function () {
  var area = '13';
  try { area = localStorage.getItem('area') || '13'; } catch (e) {}
  fetch('/api/week?area=' + encodeURIComponent(area)).then(function (r) { return r.json(); }).then(function (w) {
    var m = w && w.mood; if (!m) return;
    var box = document.getElementById('careToday');
    var names = { past: '過去の低下', pressure: '気圧', temp: '気温差', rain: '降水', hum: '湿度' };
    box.hidden = false;
    box.className = 'card care-today mood-' + m.level;
    var h = document.createElement('div');
    h.innerHTML = '<p class="care-h"><b>今日の体調そらもよう</b><small>' + (w.area ? w.area.name : '') + '</small></p>' +
      '<p class="care-lv"><span class="lvno">' + m.level + '<small>/5</small></span> <b></b></p><p class="care-d"></p>';
    h.querySelector('b + b, .care-lv b').textContent = m.label;
    h.querySelector('.care-d').textContent = m.desc + (m.factors && m.factors.length ? '　効いている要因: ' + m.factors.map(function (k) { return names[k]; }).join('・') : '');
    box.appendChild(h);
    (m.factors || []).forEach(function (k) {
      var a = document.querySelector('.care-f[data-f="' + k + '"]');
      if (a) { a.classList.add('on'); a.querySelector('.care-badge').hidden = false; }
    });
    if (m.level >= 4) {
      var p = document.createElement('p'); p.className = 'muted small';
      p.textContent = '今日は、体調への影響は小さそうです。下の対策は、気圧が下がる日の備えとして、ご覧ください。';
      box.appendChild(p);
    }
  }).catch(function () {});
})();
