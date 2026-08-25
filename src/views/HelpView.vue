<script setup>
const sections = [
  { id: 'quick', label: '快速開始' },
  { id: 'roster', label: '班級與名單' },
  { id: 'layout', label: '教室佈局' },
  { id: 'seating', label: '排座位' },
  { id: 'export', label: '列印與分享' },
  { id: 'data', label: '資料安全' },
  { id: 'faq', label: '常見問題' },
]
</script>

<template>
  <div class="help">
    <div class="head">
      <h2>使用說明</h2>
      <p class="dim">三分鐘上手，從 Excel 名單到印出座位表。</p>
    </div>

    <nav class="toc panel">
      <a v-for="s in sections" :key="s.id" :href="'#' + s.id">{{ s.label }}</a>
    </nav>

    <!-- 快速開始 -->
    <section :id="sections[0].id" class="panel sec">
      <h3>🚀 快速開始（三步驟）</h3>
      <ol class="steps">
        <li>
          <strong>匯入名單</strong> — 到「<RouterLink to="/">班級</RouterLink>」按「📥 匯入名單」，
          從 Excel 選取名單範圍按 <kbd>Ctrl+C</kbd>，直接貼到輸入框。
          只要有「座號、姓名」兩欄就能用；有「班級」欄的全學年名單會自動拆成多個班。
        </li>
        <li>
          <strong>選教室佈局</strong> — 到「<RouterLink to="/layouts">教室佈局</RouterLink>」按「＋ 新增佈局」，
          從 9 種範本挑一個（排排坐、四人島、ㄇ字型、電腦教室…），需要的話再微調。
        </li>
        <li>
          <strong>排座位</strong> — 到「<RouterLink to="/plans">座位表</RouterLink>」選「班級 × 佈局」建立座位表，
          按「🎲 自動排位」或手動點選安排，最後「🖨️ 列印」。
        </li>
      </ol>
    </section>

    <!-- 班級與名單 -->
    <section :id="sections[1].id" class="panel sec">
      <h3>👥 班級與名單</h3>
      <h4>匯入名單</h4>
      <ul>
        <li>支援 <strong>Excel 複製貼上</strong>（最方便）與 .xlsx / .csv 檔案。</li>
        <li>系統會自動猜每一欄是什麼（座號/姓名/性別/身高/備註/班級），猜錯了在預覽表格上方改。</li>
        <li>有沒有標題列都可以，勾選「第一列是標題列」控制。</li>
        <li>名單含「班級」欄時：在班級頁匯入會<strong>一次建立多個班級</strong>；同名班級會更新名單而不是重複建立。</li>
        <li>重複座號、空白姓名會被標出來，不會默默吃掉。</li>
      </ul>
      <h4>需求標籤</h4>
      <p>在學生列表按「＋標籤」，勾選個別需求 — 自動排位會依此安排：</p>
      <ul>
        <li><strong>需前排（視力/聽力）</strong>：排進前兩排</li>
        <li><strong>需靠近教師</strong>：安排在講台/黑板附近</li>
        <li><strong>輪椅/行動不便</strong>：優先無障礙座位（佈局中標♿的座位），沒有就安排走道側</li>
        <li><strong>易分心</strong>：遠離窗戶和門</li>
        <li><strong>左撇子</strong>：左手邊淨空，寫字不打架</li>
        <li><strong>需緩衝空間</strong>：旁邊保留空位</li>
        <li>也可以輸入<strong>自訂標籤</strong>做註記（自訂標籤不影響自動排位）</li>
      </ul>
      <h4>人際關係</h4>
      <p>
        名單下方的「人際關係設定」：選兩位學生＋關係類型（不可相鄰／建議相鄰／不可同組／不可同列／不可同行／建議同組）。
        會吵架的分開坐、小老師配對坐一起，都在這裡設。
      </p>
    </section>

    <!-- 教室佈局 -->
    <section :id="sections[2].id" class="panel sec">
      <h3>🏫 教室佈局</h3>
      <h4>三種建立方式</h4>
      <ul>
        <li><strong>範本庫</strong>：排排坐、雙人併桌、四人島、六人島、ㄇ字型、圓圈圍坐、電腦教室、自然實驗室、考試模式 — 都附好黑板、講台、門窗。</li>
        <li><strong>快速產生</strong>：自己設定「每排幾組 × 幾排 × 走道寬度」。</li>
        <li><strong>自由編輯</strong>：從任一範本進編輯器繼續改。</li>
      </ul>
      <h4>編輯器操作</h4>
      <ul>
        <li><strong>🖱️ 選取/移動</strong>：點座位或家具選取，按住拖曳搬移；<kbd>Ctrl</kbd>+點可多選。</li>
        <li><strong>🪑 加座位</strong>／<strong>🚪 加家具</strong>：點空格新增。窗和門的位置很重要 — 座位的「靠窗／靠門」屬性由它們自動判定。</li>
        <li><strong>🔄 旋轉</strong>：改變座位朝向（座位上的小缺口就是面向），ㄇ字型、電腦教室會用到。</li>
        <li><strong>🎨 設為同組</strong>：選多個座位設成一組（會上色），分組相關的規則靠這個。</li>
        <li>座位可標「♿ 無障礙」「💻 固定電腦」「🧪 實驗桌」，壞掉的座位可「停用」。</li>
        <li>選取單一座位時，側欄會顯示自動判定的屬性：<strong>前排／靠窗／靠門／走道側</strong>。</li>
      </ul>
      <h4>分享給其他老師</h4>
      <p>
        佈局卡片上的「分享碼」會產生一串 <code>SEAT1.</code> 開頭的文字，
        用 LINE 或 Email 傳給同事，對方按「🔑 貼分享碼」就能匯入 — 資料不經任何伺服器。
      </p>
    </section>

    <!-- 排座位 -->
    <section :id="sections[3].id" class="panel sec">
      <h3>🪑 排座位</h3>
      <h4>手動編排</h4>
      <ul>
        <li>點右側名單裡的學生 → 點座位入座。</li>
        <li>點已入座的學生 → 再點另一個座位：空位就移過去，有人就<strong>兩人交換</strong>。</li>
        <li>選取入座學生後可「🔒 鎖定座位」— 鎖定的座位不會被自動排位、填入、清空動到（特教生固定位置用）。</li>
        <li>「依座號填入」：座號順序由前到後、由左到右一鍵排完。</li>
      </ul>
      <h4>自動排位</h4>
      <ul>
        <li>「🎲 自動排位」會綜合需求標籤、人際關係、分組品質自動安排，幾乎瞬間完成。</li>
        <li>「換一個方案」產生另一種排法，可以多按幾次挑喜歡的。</li>
        <li>「⚖️ 規則」裡每條規則都能開關、調權重（1–10，越高越優先）。例如「男女不同排」會讓每一直行同性別、左右交錯（男女男女…）— 不需要的班級把它關掉即可。</li>
        <li>排完看下方<strong>衝突清單</strong>：黃色橘點標出沒滿足規則的座位，寫明原因。手動微調後清單即時更新。</li>
        <li><strong>點任何座位</strong>可以看「這個座位對他而言」的完整原因（✓ 滿足了什麼、⚠ 犧牲了什麼）— 家長問起來有憑有據。</li>
      </ul>
      <h4>公平輪替</h4>
      <p>
        每次換座位前按「📌 封存輪替」記錄現況，下次自動排位就會避開「同座位」「同鄰居」，
        長期下來每個孩子都輪得到不同位置和不同同伴。
      </p>
    </section>

    <!-- 列印與分享 -->
    <section :id="sections[4].id" class="panel sec">
      <h3>🖨️ 列印與分享</h3>
      <ul>
        <li><strong>視角切換</strong>是關鍵：「🧑‍🎓 學生視角」黑板在上（貼教室給學生看）、「🧑‍🏫 老師視角」整間教室 180° 翻轉（放講桌自己看）— 兩張印出來才不會左右相反。</li>
        <li><strong>🖨️ 列印</strong>：A4 橫式，含班名、視角、日期，可直接「另存為 PDF」。</li>
        <li><strong>🖼️ PNG</strong>：高解析圖片，貼班群、傳 LINE。</li>
        <li><strong>📊 Excel</strong>：座位表以格子排進工作表，要再加工也行。</li>
      </ul>
    </section>

    <!-- 資料安全 -->
    <section :id="sections[5].id" class="panel sec">
      <h3>🔒 資料安全</h3>
      <ul>
        <li>所有資料（名單、標籤、關係、座位表）<strong>只存在這台電腦這個瀏覽器</strong>裡，不會上傳任何伺服器 — 學生個資不出你的電腦。</li>
        <li>反過來說：<strong>清除瀏覽器資料會把它清掉</strong>。請定期按右上角「💾 備份資料」存成 .json 檔（超過兩週沒備份會提醒你）。</li>
        <li>換電腦：舊電腦「💾 備份」→ 把 .json 檔帶過去 → 新電腦「📂 還原」。</li>
        <li>同辦公室不同老師開同一個網址，看到的是各自的資料，互不相通。</li>
      </ul>
    </section>

    <!-- FAQ -->
    <section :id="sections[6].id" class="panel sec">
      <h3>❓ 常見問題</h3>
      <dl>
        <dt>我的 Excel 只有「班級、座號、姓名」三欄，可以嗎？</dt>
        <dd>可以，這就是最典型的用法。性別、身高是選填，之後要用相關規則（分組性別平衡、身高排序）再補就好。</dd>
        <dt>自動排位排出來的結果我不滿意？</dt>
        <dd>先按「換一個方案」多看幾種；還是不行就手動微調（點兩下交換），或到「⚖️ 規則」調整權重。你手動改的結果，衝突清單會告訴你犧牲了什麼。</dd>
        <dt>顯示「無障礙座位不足」或「座位不足」？</dt>
        <dd>佈局的座位數（或標♿的座位數）比學生少。到教室佈局補座位，或把輪椅生以外的標籤先拿掉。</dd>
        <dt>轉學生怎麼處理？</dt>
        <dd>轉出：在名單把該生刪除（或先不刪，排位時他若不在座位上不影響）。轉入：名單「＋ 新增學生」補上即可。</dd>
        <dt>可以多班共用一種教室佈局嗎？</dt>
        <dd>可以，座位表是「班級 × 佈局」的組合，同一個佈局能配任何班級；同一班也能有多張座位表（平時島型、考試單人桌）。</dd>
        <dt>手機、平板能用嗎？</dt>
        <dd>能開能看，編排建議用電腦（畫面大、好點選）。加到主畫面後可離線開啟。</dd>
      </dl>
    </section>

    <p class="foot dim">
      有問題或建議，歡迎到
      <a href="https://github.com/pingking0220/seating-plan/issues" target="_blank" rel="noopener">GitHub Issues</a>
      回報。
    </p>
  </div>
</template>

<style scoped>
.help { max-width: 780px; margin: 0 auto; }
.head { margin-bottom: 16px; }
.head p { margin: 4px 0 0; }
.toc {
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 8px 10px; margin-bottom: 16px;
  position: sticky; top: 8px; z-index: 5;
}
.toc a {
  text-decoration: none; color: var(--text-dim);
  padding: 4px 12px; border-radius: 999px; font-size: 13.5px;
}
.toc a:hover { background: var(--primary-soft); color: var(--primary); }
.sec { padding: 20px 24px; margin-bottom: 14px; scroll-margin-top: 70px; }
.sec h3 { margin: 0 0 12px; font-size: 18px; }
.sec h4 { margin: 16px 0 6px; font-size: 15px; }
.sec ul, .sec ol { margin: 6px 0; padding-left: 22px; line-height: 1.85; }
.sec p { line-height: 1.8; margin: 6px 0; }
.steps { counter-reset: step; list-style: none; padding-left: 0; }
.steps li {
  position: relative; padding-left: 44px; margin-bottom: 14px; line-height: 1.8;
}
.steps li::before {
  counter-increment: step; content: counter(step);
  position: absolute; left: 0; top: 2px;
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px;
}
kbd {
  background: #f1f5f9; border: 1px solid var(--border); border-bottom-width: 2px;
  border-radius: 5px; padding: 1px 6px; font-size: 12.5px; font-family: inherit;
}
code {
  background: #f1f5f9; border-radius: 5px; padding: 1px 6px; font-size: 13px;
}
dl { margin: 0; }
dt { font-weight: 600; margin-top: 14px; }
dt::before { content: 'Q：'; color: var(--primary); }
dd { margin: 4px 0 0 0; line-height: 1.8; color: var(--text-dim); }
dd::before { content: 'A：'; }
.foot { text-align: center; padding: 8px 0 24px; font-size: 13.5px; }
.foot a { color: var(--primary); }
</style>
