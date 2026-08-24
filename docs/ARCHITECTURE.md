# 多元教室排座位系統 — 架構規劃

> 版本 v0.1 草案 · 2026-08-24 · 力行國小

## 0. 需求定調（來自需求訪談）

| 項目 | 決定 |
|---|---|
| 使用者 | 少數幾位老師，**不做帳號權限系統** |
| 分享對象 | 校內外老師都能用 → **不能綁校內 NAS** |
| 資料來源 | 既有 **Excel 名單**匯入為主 |
| 核心痛點 | **多樣教室座位佈局**（排排坐 / 島型 / ㄇ字型 / 專科教室…） |
| 排位方式 | **規則式自動排位 + 老師手動微調** |

## 1. 核心架構決策：純前端 Local-first 應用

```
瀏覽器（老師的電腦）
├─ Vue 3 SPA（靜態檔案，開網址即用）
├─ IndexedDB（班級 / 名單 / 佈局 / 座位表全部存本機）
└─ 檔案 I/O：Excel 匯入、Excel/PDF/PNG 匯出、JSON 備份

靜態託管（Cloudflare Pages 或 GitHub Pages）
└─ 只放前端檔案，**不存任何學生資料**
```

**零後端、零資料庫伺服器。** 理由：

1. **跨校分享** — 排課系統在 NAS 上只限校內網路；靜態站點任何學校老師開網址就能用。
2. **個資安全** — 學生姓名、特教註記完全不離開老師的電腦，不上傳任何伺服器。這是說服其他老師敢用的關鍵，也要在 UI 上明講。
3. **零維運成本** — 沒有容器、沒有備份排程、沒有 Prisma migration。
4. **離線可用** — 做成 PWA，教室沒網路也能排。

代價：資料綁在該瀏覽器 → 用「一鍵備份 .json + 匯入還原 + 定期備份提醒」補償。

> 保留升級路徑：排位引擎與資料模型全部寫成 `core/` 純函式（不依賴 Vue、不依賴瀏覽器 API）。日後若要加雲端同步或併回排課系統，只需接上 I/O 層，引擎完全不用改。

## 2. 資料模型

```js
Workspace       { schemaVersion, settings, updatedAt }

ClassRoster     { id, name, year, students[], relations[] }
  Student       { id, seatNo, name, gender, height?, traits[], note, active }
  Trait         'need_front' | 'hearing' | 'wheelchair' | 'near_teacher'
                | 'easily_distracted' | 'left_handed' | 'emotional_buffer' | 自訂
  Relation      { a, b, type, weight }
                type: forbid_adjacent | prefer_adjacent
                    | forbid_same_group | prefer_same_group

RoomLayout      { id, name, kind, grid{cols,rows}, seats[], furniture[], front }
  Seat          { id, col, row, rotation, groupId?, tags[], enabled }
  Seat.tags     'window' | 'door' | 'aisle' | 'accessible' | 'fixed_pc'
                | 'lab_bench' | 'front_row' | 自訂
  Furniture     { id, kind, col, row, w, h, label }
                kind: podium | board | door | window | cabinet | sink | screen

RuleSet         { id, name, rules[{ id, enabled, weight, params }] }

SeatingPlan     { id, classId, layoutId, ruleSetId, name, createdAt,
                  assignments[{ seatId, studentId, locked }],
                  score, violations[], seed }

PlanHistory     { classId, entries[{ planId, date, seatOf{}, groupOf{} }] }
```

設計要點：

- `Seat` 用**網格座標**（col/row）而非自由像素 → 相鄰判定、走道判定、分組判定全部變成整數運算，規則寫起來乾淨。自由擺放留給 `Furniture`。
- 「靠窗 / 靠門 / 前排 / 走道邊」不手動標，由 `seatAttributes.js` 依 `furniture` 位置與 `front` 方向**自動推導**，老師改動教室擺設後屬性自動跟著更新。
- `schemaVersion` + `migrations.js` 從第一天就要有，否則日後改資料結構會讓老師的舊資料開不起來。

## 3. 教室佈局編輯器（本系統的核心賣點）

三種建立方式，由易到難：

**① 範本庫（Preset）** — 開箱即用
- 傳統排排坐（可調行列，含中央走道）
- 雙人併桌 / 三人併桌
- 四人島型 / 六人島型（分組討論）
- ㄇ字型、馬蹄型（發表、辯論）
- 圓圈圍坐（班會、綜合活動）
- 電腦教室（沿牆 U 型固定機位、雙排背對背）
- 自然實驗室（固定實驗桌，每桌 4–6 人 + 洗手台）
- 視聽/音樂教室（階梯式、樂器區）
- 考試模式（單人單桌、間距最大化）

**② 快速產生器** — 輸入「幾行 × 幾列、每組幾人、走道在第幾列」→ 自動生成，再微調。

**③ 自由編輯器** — SVG 網格畫布
- 拖曳新增/刪除/搬移座位、框選批次操作
- 旋轉座位朝向（島型、ㄇ字型必要）
- 圈選座位設為同一組（`groupId`）
- 標記座位屬性（無障礙、固定電腦、壞掉停用）
- 擺放講台/黑板/門/窗/櫃子/洗手台 → 決定「前方」與屬性推導
- 佈局可存成範本、匯出 `.layout.json` 分享給其他老師

## 4. 排位引擎（規則式 + 局部搜尋）

純 JavaScript，30 人規模 **< 300ms** 出結果，不需要 Python/OR-Tools。

```
輸入：students[] + layout.seats[] + ruleSet + 已鎖定座位 + 歷史紀錄
  │
  ├─ 階段一 硬性約束過濾
  │    鎖定座位固定 → 輪椅只進無障礙座 → 容量檢查 → 縮減可行域
  │    ✗ 無解 → 回報「哪一條硬性規則造成無解」（不是丟一句失敗）
  │
  ├─ 階段二 貪婪初始配置
  │    依約束緊迫度排序學生（限制最多的先安置）
  │
  ├─ 階段三 局部搜尋改善
  │    兩兩交換鄰域（30人=435 對）+ 模擬退火，多次隨機重啟
  │    目標函數 = Σ(軟性規則違反 × 權重)
  │
  └─ 輸出：3 個候選方案 + 每個座位的「為什麼」+ 衝突清單
```

**規則清單**（每條可開關 + 權重滑桿）

| 類型 | 規則 |
|---|---|
| 硬性 | 鎖定座位、無障礙座位、指定不可相鄰、座位容量 |
| 個別需求 | 視力/聽力需前排、需靠近教師、易分心者遠離門窗、左撇子安排走道側或桌位左端、情緒生留緩衝空位 |
| 生理 | 身高由前而後遞增（同排容差） |
| 人際 | 衝突組合不相鄰/不同組、互助配對相鄰、指定學生同組或分開 |
| 分組品質 | 每組性別平衡、能力異質分組、每組人數平均 |
| 公平輪替 | 避免與上次同座位/同組員、避免長期坐邊角或後排、左右區塊輪換 |

**可解釋性是老師信任的關鍵**：點任一座位要能看到「小明放這裡是因為【視力需前排】+【與小華不可相鄰】」；違反軟性規則的座位顯示黃色警示與原因，老師可選擇接受或手動改。

**種子可重現**：同一 seed 產生同一結果；按「換一個方案」換 seed，老師可比較後挑選。

## 5. Excel 整合

**匯入**（SheetJS `xlsx`，已在排課系統用過）
- 支援 `.xlsx` / `.csv` / **直接從 Excel 複製貼上**（解析剪貼簿 TSV，最省事的路徑）
- **欄位對應精靈**：每位老師的名單格式都不一樣，自動猜測「座號/姓名/性別/備註」欄位並讓使用者調整，記住上次的對應設定
- 匯入預覽 + 錯誤標示（重複座號、空白姓名）
- 支援增量更新（轉入轉出學生，比對座號保留既有標籤與人際設定）

**匯出**
- 座位表 `.xlsx`（格狀排版，直接列印）
- 座位表 `.pdf` / A4 橫式（**老師視角／學生視角一鍵翻轉** — 這個一定要有，不然會排反）
- 座位圖 `.png`（貼班群、傳 LINE）
- 桌牌名條（每人一張可對摺）
- 學生清單含需求標籤（交接用）
- 全資料 `.json` 備份

## 6. 分享機制

| 分享什麼 | 做法 |
|---|---|
| 系統本身 | 給網址即可，靜態站點，任何學校老師開了就能用 |
| 教室佈局範本 | 匯出 `.layout.json`，或產生分享碼（LZ 壓縮進 URL hash，資料不經伺服器） |
| 座位表給同事看 | 匯出 PNG/PDF；或唯讀分享連結（**預設匿名化只顯示座號**，含姓名需明確勾選並提示個資風險） |

## 7. 專案結構

```
seating-plan/
├─ src/
│  ├─ views/            ClassesView / RosterView / LayoutEditorView
│  │                    SeatingView / RulesView / ExportView / SettingsView
│  ├─ components/
│  │   ├─ layout/       SeatCanvas · SeatNode · FurnitureNode · LayoutToolbar · PresetPicker
│  │   ├─ roster/       ImportWizard · ColumnMapper · StudentTable · TraitEditor · RelationMatrix
│  │   ├─ seating/      SeatingBoard · StudentPalette · ConflictPanel · CandidateSwitcher · ExplainPopover
│  │   └─ common/
│  ├─ core/             ★ 純函式、零框架依賴、100% 單元測試覆蓋
│  │   ├─ model/        types · defaults · validate · migrations
│  │   ├─ layout/       presets · generator · seatAttributes · adjacency
│  │   ├─ rules/        registry · evaluators/*.js · scoring
│  │   ├─ solver/       greedy · localSearch · rng · explain
│  │   └─ io/           excelImport · excelExport · printExport · shareCodec
│  ├─ stores/           classes · layouts · plans · rules · ui   (Pinia)
│  └─ persistence/      db(IndexedDB) · autosave · backup
├─ tests/               core/ 各模組的 vitest 測試
└─ docs/
```

技術棧沿用排課系統的熟悉組合：**Vue 3 + Vite + Pinia + SheetJS**，去掉 Express / Prisma / Python。新增 `idb-keyval`（IndexedDB）與 `lz-string`（分享碼）。

## 8. 開發階段

| 階段 | 內容 | 結束時可交付什麼 |
|---|---|---|
| **M1** | 資料模型 + IndexedDB + Excel 匯入精靈 + 學生清單編輯 | 能把 Excel 名單匯進來、編需求標籤 |
| **M2** | 佈局編輯器 + 範本庫 + 屬性自動推導 | 能畫出各種教室，範本可分享 |
| **M3** | 手動拖曳排位 + 列印/匯出（含視角翻轉） | **已經可以實際拿去用了** |
| **M4** | 規則引擎 + 自動排位 + 衝突面板 + 可解釋性 | 一鍵自動排、老師微調 |
| **M5** | 輪替歷史 + 分享碼 + PWA 離線 + 備份提醒 | 完整版，可推廣給他校 |

M3 就有可用產品，建議先做到 M3 給幾位老師試用收回饋，再決定 M4 規則的優先順序。

## 9. 已知風險與對策

| 風險 | 對策 |
|---|---|
| 瀏覽器清快取 → 資料全失 | 一鍵 `.json` 備份 / 還原；超過 N 天未備份主動提醒；匯出座位表時順帶備份 |
| 個資疑慮 | 資料不出本機（UI 首頁明講）；分享連結預設匿名化 |
| 換電腦沒同步 | 備份檔手動搬移；`core/` 純函式設計讓日後加雲端同步成本很低 |
| 規則互相打架導致無解 | 硬性規則衝突要指出**是哪兩條**，並提供「降級為軟性規則」按鈕 |
| 老師覺得自動排的結果莫名其妙 | 每個座位都要能解釋原因；永遠允許手動覆寫並鎖定 |
