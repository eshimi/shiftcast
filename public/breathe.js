// 呼吸を整える(/breathe)。ゆっくりした呼吸をガイドする。通信なし・オフラインでも動く。
// 気圧アラート等から ?mode=relax|n478|box（&start=1 で自動開始）で起動できる。
(function () {
  var root = document.getElementById('breathe');
  if (!root) return;

  var PATTERNS = {
    relax: [['吸う', 4, 'in'], ['止める', 2, 'hold'], ['吐く', 6, 'out']],
    n478: [['吸う', 4, 'in'], ['止める', 7, 'hold'], ['吐く', 8, 'out']],
    box: [['吸う', 4, 'in'], ['止める', 4, 'hold'], ['吐く', 4, 'out'], ['止める', 4, 'hold']],
  };
  var DESCS = {
    relax: '<span class="tag">気圧対策の基本。</span>吐く息を長めにして、気圧の乱れで高ぶった神経を鎮めます。迷ったらこれ。<br><span class="nums">4秒吸う・2秒止める・6秒吐く</span>',
    n478: '<span class="tag">深い鎮静。</span>長く止めて長く吐く、強めに落ち着けるリズム。入眠前や不安・動悸に。<br><span class="nums">4秒吸う・7秒止める・8秒吐く</span>',
    box: '<span class="tag">整えて集中。</span>すべて同じ長さの四角い呼吸。自律神経を均等に整え、気持ちを立て直したいときに。<br><span class="nums">4秒ずつ 吸う・止める・吐く・止める</span>',
  };
  var HINTS = { in: '鼻からゆっくり吸う', hold: '静かにとめる', out: '口から細く長く吐く' };

  var $ = function (s) { return root.querySelector(s); };
  var orb = $('.orb'), halo = $('.halo'), count = $('.count'),
      phaseEl = $('.phase'), hintEl = $('.hint'), descEl = $('.desc'),
      startBtn = $('.start'), cycleEl = $('.cycle'), chimeBtn = $('.chime'),
      patterns = $('.patterns');

  var current = 'relax', running = false, stepi = 0, cycles = 0;
  var phaseTimer = null, countTimer = null, chimeOn = false, actx = null;

  function showDesc() { descEl.innerHTML = DESCS[current]; }

  function selectPattern(key) {
    if (!PATTERNS[key]) return;
    current = key;
    Array.prototype.forEach.call(patterns.querySelectorAll('.pat'), function (p) {
      p.setAttribute('aria-pressed', p.dataset.key === key ? 'true' : 'false');
    });
    showDesc();
  }

  patterns.addEventListener('click', function (e) {
    var btn = e.target.closest('.pat'); if (!btn) return;
    selectPattern(btn.dataset.key);
    if (running) stop();
  });

  function flipChime() { chimeOn = !chimeOn; chimeBtn.setAttribute('aria-pressed', chimeOn ? 'true' : 'false'); }
  chimeBtn.addEventListener('click', flipChime);

  function tone(type) {
    if (!chimeOn) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime;
      o.type = 'sine';
      o.frequency.value = type === 'in' ? 392 : type === 'out' ? 294 : 330;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      o.connect(g); g.connect(actx.destination); o.start(now); o.stop(now + 1.2);
    } catch (e) {}
  }

  function setScale(type, dur) {
    orb.style.setProperty('--dur', dur + 's');
    halo.style.setProperty('--dur', dur + 's');
    if (type === 'in') { orb.style.transform = 'scale(1)'; halo.style.transform = 'scale(1)'; orb.classList.add('big'); }
    else if (type === 'out') { orb.style.transform = 'scale(0.5)'; halo.style.transform = 'scale(0.5)'; orb.classList.remove('big'); }
  }

  function countdown(dur) {
    var n = dur; count.textContent = n; clearInterval(countTimer);
    countTimer = setInterval(function () { n--; if (n <= 0) clearInterval(countTimer); else count.textContent = n; }, 1000);
  }

  function runStep() {
    if (!running) return;
    var steps = PATTERNS[current], s = steps[stepi], label = s[0], dur = s[1], type = s[2];
    phaseEl.textContent = label;
    phaseEl.style.color = type === 'hold' ? 'var(--muted)' : 'var(--accent)';
    hintEl.textContent = HINTS[type];
    setScale(type, dur); countdown(dur); tone(type);
    phaseTimer = setTimeout(function () {
      stepi++;
      if (stepi >= steps.length) { stepi = 0; cycles++; cycleEl.textContent = cycles + ' 呼吸'; }
      runStep();
    }, dur * 1000);
  }

  function start() {
    running = true; stepi = 0; startBtn.textContent = 'おわる'; descEl.style.opacity = '.35';
    if (chimeOn && !actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    runStep();
  }
  function stop() {
    running = false; clearTimeout(phaseTimer); clearInterval(countTimer);
    startBtn.textContent = 'はじめる'; phaseEl.textContent = 'おつかれさま'; phaseEl.style.color = '';
    hintEl.textContent = 'ゆっくり目を開けて。'; count.textContent = ''; descEl.style.opacity = '1';
    orb.style.setProperty('--dur', '2.4s'); halo.style.setProperty('--dur', '2.4s');
    orb.style.transform = 'scale(0.5)'; halo.style.transform = 'scale(0.5)'; orb.classList.remove('big');
  }

  startBtn.addEventListener('click', function () {
    if (running) { stop(); } else { cycles = 0; cycleEl.textContent = '0 呼吸'; start(); }
  });

  // 初期表示。?mode= / #hash で呼吸法を指定でき、&start=1 で自動開始(気圧アラートからの導線用)。
  var params = new URLSearchParams(location.search);
  var mode = params.get('mode') || (location.hash || '').replace('#', '');
  selectPattern(PATTERNS[mode] ? mode : 'relax');
  if (params.get('start') === '1') { cycles = 0; cycleEl.textContent = '0 呼吸'; start(); }
})();
