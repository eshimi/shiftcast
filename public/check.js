/* 気象病セルフチェック: 回答はこの端末の中だけで集計する(保存・送信しない) */
(function () {
  var form = document.getElementById('chk'), res = document.getElementById('chkRes'), err = document.getElementById('chkErr');
  if (!form) return;
  var LEVELS = [
    { max: 3, title: '出やすさの傾向：低め', text: '今のところ、天気や気圧の影響を受けやすいという傾向はあまり見られません。ただし、感じ方は変わることもあります。気になる不調があれば、気圧との関係を記録して確かめてみましょう。', links: [['columns/what-is-kishobyo', '気象病（天気痛）とは？ 仕組みを知る'], ['columns/headache-diary', '頭痛ダイアリーのつけ方']] },
    { max: 6, title: '出やすさの傾向：ややあり', text: '天気や気圧の変化で、不調を感じやすい面があるかもしれません。気圧が下がる日の前に備えると、楽になることがあります。', links: [['columns/day-before', '気圧が下がる前日にできる5つの準備'], ['columns/kiatsu-zutsu', '気圧で頭痛が起こるのはなぜ？'], ['columns/headache-diary', '頭痛ダイアリーのつけ方']] },
    { max: 10, title: '出やすさの傾向：高め', text: '天気や気圧の変化で、不調が出やすい傾向がありそうです。気圧の予報を見て、前日から備えることをおすすめします。つらさが強い・頻繁なときは、医療機関への相談も検討してください。', links: [['columns/day-before', '気圧が下がる前日にできる5つの準備'], ['columns/when-it-hurts', '気圧で頭痛・不調を感じたら：セルフケア'], ['columns/which-department', '気象病・天気痛は何科を受診する？'], ['columns/when-to-see-doctor', '受診の目安']] }
  ];
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = form.querySelectorAll('.chk-q li').length, score = 0, answered = 0;
    for (var i = 0; i < n; i++) {
      var c = form.querySelector('input[name="q' + i + '"]:checked');
      if (c) { answered++; score += Number(c.value); }
    }
    if (answered < n) { err.hidden = false; return; }
    err.hidden = true;
    var lv = LEVELS.filter(function (l) { return score <= l.max; })[0];
    document.getElementById('chkTitle').textContent = lv.title;
    document.getElementById('chkScore').textContent = '当てはまった項目：' + score + ' / ' + n;
    document.getElementById('chkText').textContent = lv.text;
    var ul = document.getElementById('chkLinks'); ul.textContent = '';
    lv.links.forEach(function (l) { var li = document.createElement('li'), a = document.createElement('a'); a.href = '/' + l[0]; a.textContent = l[1]; li.appendChild(a); ul.appendChild(li); });
    res.hidden = false; res.focus(); res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  form.addEventListener('reset', function () { res.hidden = true; err.hidden = true; });
})();
