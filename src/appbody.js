// /app/ の画面本体（共通のヘッダー・フッターは pages.js の layout が付ける）。client は public/app.js
export const APP_BODY = `  <!-- ダッシュボード -->
  <section id="view-dash" class="view">
    <div class="dash-loc">
      <div id="areaChips" class="chips seg-toggle" role="tablist" aria-label="エリア"></div>
      <span id="fetched" class="upd"></span>
    </div>
    <section id="moodHero" class="mhero" aria-label="今日の体調そらもよう" hidden></section>
    <div id="summary" class="card summary astrip"></div>
    <section class="card chart-card" aria-label="気圧の推移・予報">
      <div class="card-h"><h2 class="sec-t">気圧の推移・予報</h2><span class="unit">hPa</span></div>
      <div class="chart-box"><div id="yAxis" class="yaxis"></div><div id="chartScroll" class="chart-scroll"><div id="chartWrap"><canvas id="chart"></canvas></div></div></div>
      <div class="legend">
        <span><i class="lg rise"></i>上昇注意</span> <span><i class="lg slight"></i>やや注意</span> <span><i class="lg caution"></i>注意</span> <span><i class="lg warning"></i>警戒</span>
        <span class="muted">点線＝予報</span>
      </div>
    </section>
    <h2 class="sec-h">いまの天気</h2>
    <div id="fxCard" class="fx-wrap-app" hidden></div>
    <div id="jma" class="card" hidden></div>
    <div id="stats" class="card"></div>
    <p class="disclaimer">本データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。<a href="/terms.html">利用規約</a></p>
  </section>

  <!-- 記録 -->
  <section id="view-log" class="view" hidden>
    <div class="card">
      <div class="card-h"><b id="formTitle">体調を記録</b><button id="cancelEdit" class="link" hidden>編集をやめる</button></div>
      <label class="lbl">いまの体調（タップするだけで記録できます）</label>
      <div id="pain" class="pain" role="radiogroup" aria-label="痛みの度合い"></div>
      <details id="logMore" class="log-more">
        <summary>くわしく記録する（症状・服薬・日時・メモ）<span class="muted">任意</span></summary>
        <label class="lbl">症状</label>
        <div id="tags" class="chips multiline"></div>
        <div class="row"><input id="newTag" placeholder="独自タグを追加" maxlength="20"><button id="addTag" class="btn sm">追加</button></div>
        <label class="lbl">服薬</label>
        <div id="myMeds" class="chips multiline"></div>
        <div class="row"><input id="medQ" placeholder="医薬品名で検索" autocomplete="off"></div>
        <div id="medSug" class="sug"></div>
        <div id="selMeds" class="chips multiline"></div>
        <label class="lbl" for="when">日時</label>
        <input id="when" type="datetime-local">
        <label class="lbl" for="note">メモ</label>
        <textarea id="note" rows="2" maxlength="500" placeholder="任意"></textarea>
      </details>
      <button id="save" class="btn primary block">記録する</button>
    </div>
    <div class="card">
      <div class="card-h"><b>記録</b>
        <div id="logMode" class="seg" role="tablist"><button data-m="list" class="on">リスト</button><button data-m="cal">カレンダー</button></div></div>
      <ul id="logList" class="list"></ul>
      <div id="calBox" hidden>
        <div class="cal-nav"><button id="calPrev" class="link" aria-label="前の月">‹ 前の月</button><b id="calTitle"></b><button id="calNext" class="link" aria-label="次の月">次の月 ›</button></div>
        <div id="calGrid" class="cal-grid"></div>
        <ul id="calDay" class="list"></ul>
      </div>
    </div>
  </section>

  <!-- 分析 -->
  <section id="view-insight" class="view" hidden>
    <div class="card"><div class="card-h"><b>あなたの傾向</b></div>
      <div id="insightProg" class="iprog" hidden><p id="insightProgText"></p><div class="iprog-bar" aria-hidden="true"><i id="insightProgFill"></i></div></div>
      <p id="insightText" class="big"></p><div id="insightDetail" class="muted"></div></div>
    <p class="disclaimer">簡易的な統計であり、医学的な診断ではありません。気になる症状は医療機関にご相談ください。</p>
  </section>

  <!-- 設定 -->
  <section id="view-settings" class="view" hidden>
    <div class="card">
      <div class="card-h"><b>エリア</b></div>
      <p class="muted">1つ目が主エリアです（通知・地域統計に使用）。位置情報は都道府県単位に丸め、GPS座標は保存しません。</p>
      <ul id="areaList" class="list"></ul>
      <div class="row"><select id="areaSel"></select><button id="addArea" class="btn sm">追加</button></div>
    </div>
    <div class="card">
      <div class="card-h"><b>プッシュ通知</b></div>
      <p class="muted">毎晩、翌日に選んだレベル以上の気圧低下が予測されるときだけ通知します。</p>
      <label class="switch"><input type="checkbox" id="notifyChk"> 気圧低下アラートを受け取る</label>
      <div id="pushState" class="muted"></div>
      <label class="lbl" for="notifyMin">通知するレベル</label>
      <select id="notifyMin">
        <option value="caution">「注意」以上（これまでどおり）</option>
        <option value="warning">「警戒」のみ</option>
      </select>
      <label class="lbl" for="notifyHour">通知する時刻（前の晩）</label>
      <select id="notifyHour">${[17, 18, 19, 20, 21, 22, 23].map((hh) => `<option value="${hh}">${hh}:00ごろ</option>`).join('')}</select>
    </div>
    <div class="card">
      <div class="card-h"><b>マイ薬リスト</b></div>
      <ul id="myMedList" class="list"></ul>
    </div>
    <div class="card">
      <div class="card-h"><b>利用上の注意・プライバシー</b></div>
      <ul class="notes">
        <li>オープンAPIの気圧データは、標高や局地的な地形の影響を完全には反映できません。</li>
        <li>本データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。</li>
        <li>氏名・メールアドレス等は取得しません。端末ごとの匿名IDで記録を管理します。</li>
        <li>地域の「不調割合」は都道府県単位の匿名集計で、人数が少ない地域は表示しません。</li>
      </ul>
      <p><a href="/terms.html">利用規約・プライバシーの詳細</a></p>
      <button id="wipe" class="btn danger block">自分のデータをすべて削除</button>
    </div>
  </section>`;
export const APP_TABS = `<nav class="tabs" aria-label="気圧・記録のメニュー">
  <button data-v="dash" class="on"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 19.5c3-.3 4-6 6.5-6.5s3.5 3.5 6 1.5 3-8.5 4.5-9"/><path d="M3.5 4.5v15.2h17"/></svg></span>気圧</button>
  <button data-v="log"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20l.8-4L17.2 4.6a1.8 1.8 0 012.6 2.5L8.4 18.7z"/><path d="M14.5 7.5l2.8 2.8M4.5 21h15"/></svg></span>記録</button>
  <button data-v="insight"><span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.3"/><path d="M15.4 15.6l5 5"/></svg></span>分析</button>
  <button data-v="settings"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg></span>設定</button>
</nav>
<div id="toast" class="toast" hidden></div>`;
