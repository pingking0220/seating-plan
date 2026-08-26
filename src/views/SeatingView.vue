<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import SeatCanvas from '@/components/layout/SeatCanvas.vue'
import {
  assignmentAt, seatOf, place, toggleLock, unassign,
  autoFillBySeatNo, clearPlan, flipLayout,
} from '@/core/seating/plan.js'
import { solve, evaluatePlan, explainStudent } from '@/core/solver/solve.js'
import { RULES, defaultRulesConfig, ruleLabel } from '@/core/rules/registry.js'
import { svgToPngBlob, downloadBlob } from '@/core/io/pngExport.js'
import { exportSeatGridXlsx } from '@/core/io/excelExport.js'

const route = useRoute()
const store = useWorkspaceStore()

const plan = computed(() => store.planById(route.params.id))
const cls = computed(() => store.classById(plan.value?.classId))
const layout = computed(() => store.layoutById(plan.value?.layoutId))

const viewMode = ref('student') // student=學生視角（前方在上）| teacher=老師視角（180 度翻轉）
const viewLayout = computed(() => (viewMode.value === 'teacher' ? flipLayout(layout.value) : layout.value))

const selection = ref(null) // { studentId, fromSeatId|null }
const hint = ref('')
const showRules = ref(false)
const infeasible = ref([])

const studentById = computed(() => new Map(cls.value.students.map((s) => [s.id, s])))
const studentAtSeat = computed(() => {
  const m = new Map()
  for (const a of plan.value.assignments) m.set(a.seatId, studentById.value.get(a.studentId))
  return m
})
const lockedSeats = computed(() => new Set(plan.value.assignments.filter((a) => a.locked).map((a) => a.seatId)))
const unassigned = computed(() =>
  cls.value.students.filter((s) => s.active && seatOf(plan.value, s.id) === null),
)
const seatCount = computed(() => layout.value.seats.filter((s) => s.enabled).length)

/* ---------- 規則設定 ---------- */
const rulesCfg = computed(() => {
  if (!plan.value.rules) plan.value.rules = defaultRulesConfig()
  // 補上新版本新增的規則
  for (const r of RULES) if (!plan.value.rules[r.id]) plan.value.rules[r.id] = { enabled: r.defaultEnabled !== false, weight: r.weight }
  if (!plan.value.rules.gender_alt_columns.phase) plan.value.rules.gender_alt_columns.phase = 'auto'
  return plan.value.rules
})
const ruleGroups = computed(() => {
  const groups = new Map()
  for (const r of RULES) {
    if (!groups.has(r.group)) groups.set(r.group, [])
    groups.get(r.group).push(r)
  }
  return [...groups.entries()]
})

/* ---------- 即時衝突評估 ---------- */
const prevRecord = computed(() => store.lastRecordOf(plan.value.classId))
const evaluation = computed(() =>
  evaluatePlan({
    layout: layout.value,
    students: cls.value.students,
    relations: cls.value.relations || [],
    prev: prevRecord.value,
    assignments: plan.value.assignments,
    rulesConfig: rulesCfg.value,
  }),
)
const conflictSeatIds = computed(() => new Set(evaluation.value.violations.map((v) => v.seatId).filter(Boolean)))

function flash(msg) {
  hint.value = msg
  setTimeout(() => { if (hint.value === msg) hint.value = '' }, 2500)
}

/* ---------- 自動排位 ---------- */
function autoArrange(nextCandidate = false) {
  const seed = nextCandidate ? (plan.value.seed || 1) + 1 : plan.value.seed || 1
  const locked = plan.value.assignments.filter((a) => a.locked)
  const res = solve({
    layout: layout.value,
    students: cls.value.students,
    relations: cls.value.relations || [],
    rulesConfig: rulesCfg.value,
    locked,
    prev: prevRecord.value,
    seed,
  })
  infeasible.value = res.infeasible
  plan.value.assignments = [...locked, ...res.assignments]
  plan.value.seed = seed
  selection.value = null
  store.touchPlan(plan.value)
}

/* ---------- 點選編排 ---------- */
function pickStudent(stu) {
  selection.value = selection.value?.studentId === stu.id ? null : { studentId: stu.id, fromSeatId: null }
}
function onSeatClick({ id: seatId }) {
  const p = plan.value
  const seat = layout.value.seats.find((s) => s.id === seatId)
  if (!seat?.enabled) { flash('這個座位已停用'); return }
  if (pointsMode.value) {
    const occupant = studentAtSeat.value.get(seatId)
    if (occupant) applyPoints(occupant, seatId)
    return
  }
  if (selection.value) {
    const r = place(p, selection.value, seatId)
    if (!r.ok) {
      flash(r.reason === 'locked-target' ? '目標座位已鎖定，先解鎖再放' : '這位學生的座位已鎖定')
      return
    }
    selection.value = null
    store.touchPlan(p)
  } else {
    const occupant = studentAtSeat.value.get(seatId)
    if (occupant) selection.value = { studentId: occupant.id, fromSeatId: seatId }
  }
}
function onClearSelect() {
  selection.value = null
}
function unassignSelected() {
  if (!selection.value) return
  unassign(plan.value, selection.value.studentId)
  selection.value = null
  store.touchPlan(plan.value)
}
function toggleLockSelected() {
  if (!selection.value?.fromSeatId) return
  toggleLock(plan.value, selection.value.fromSeatId)
  selection.value = null
  store.touchPlan(plan.value)
}
const selectedStudent = computed(() =>
  selection.value ? studentById.value.get(selection.value.studentId) : null,
)
const selectionLocked = computed(() =>
  selection.value?.fromSeatId ? lockedSeats.value.has(selection.value.fromSeatId) : false,
)
/** 點座位看「為什麼坐這裡」 */
const selectedExplain = computed(() => {
  if (!selection.value?.fromSeatId) return []
  return explainStudent({
    layout: layout.value,
    students: cls.value.students,
    relations: cls.value.relations || [],
    prev: prevRecord.value,
    assignments: plan.value.assignments,
    studentId: selection.value.studentId,
  })
})

/* ---------- 批次操作 ---------- */
function fill() {
  autoFillBySeatNo(plan.value, layout.value, cls.value.students)
  store.touchPlan(plan.value)
}
function clearAll() {
  if (confirm('清空所有座位安排？（鎖定的座位會保留）')) {
    clearPlan(plan.value)
    store.touchPlan(plan.value)
  }
}
function archive() {
  if (!plan.value.assignments.length) { flash('目前沒有任何安排可封存'); return }
  store.archivePlan(plan.value, layout.value)
  flash('已封存！下次自動排位會避開這次的座位與鄰居')
}
const lastArchive = computed(() => {
  const rec = prevRecord.value
  return rec ? new Date(rec.date).toLocaleDateString('zh-TW') : null
})

/* ---------- 畫面縮放（放大座位格與字體） ---------- */
const zoom = computed({
  get: () => plan.value.zoom ?? 1.25,
  set: (v) => {
    plan.value.zoom = v
    store.touchPlan(plan.value)
  },
})
function zoomBy(step) {
  zoom.value = Math.round(Math.min(2, Math.max(1, zoom.value + step)) * 100) / 100
}

/* ---------- 加減分模式 ---------- */
const pointsMode = computed({
  get: () => !!plan.value.pointsMode,
  set: (v) => {
    plan.value.pointsMode = v
    store.touchPlan(plan.value)
  },
})
const pointDelta = ref(1) // +1 或 -1
const ptFlash = ref(null) // { seatId, delta, n } 點擊回饋動畫
let ptFlashN = 0
function applyPoints(stu, seatId) {
  store.addPoints(cls.value.id, stu.id, pointDelta.value)
  ptFlash.value = { seatId, delta: pointDelta.value, n: ++ptFlashN }
}
function resetPoints() {
  if (confirm(`把 ${cls.value.name} 全班的加減分歸零？`)) {
    store.resetPoints(cls.value.id)
  }
}
/** 座位姓名字級：名字越長字越小，避免超出座位格（寬桌 80px 可容更大字） */
function nameFontSize(name) {
  const len = (name || '').length
  return len >= 5 ? 12 : len === 4 ? 14 : 16.5
}

/* ---------- 匯出 ---------- */
const boardEl = ref(null)
function doPrint() {
  window.print()
}
async function exportPng() {
  const svg = boardEl.value.querySelector('svg')
  const blob = await svgToPngBlob(svg, 2)
  downloadBlob(blob, `${plan.value.name}-${viewMode.value === 'teacher' ? '老師視角' : '學生視角'}.png`)
}
function labelOf(seatId) {
  const stu = studentAtSeat.value.get(seatId)
  return stu ? `${stu.seatNo ?? ''} ${stu.name}`.trim() : ''
}
function exportXlsx() {
  exportSeatGridXlsx({
    viewLayout: JSON.parse(JSON.stringify(viewLayout.value)),
    nameOf: labelOf,
    title: `${plan.value.name}（${viewMode.value === 'teacher' ? '老師視角' : '學生視角'}）`,
    filename: `${plan.value.name}.xlsx`,
  })
}

const today = new Date().toLocaleDateString('zh-TW')
</script>

<template>
  <div v-if="plan && cls && layout">
    <div class="head no-print">
      <div>
        <input class="name-input" v-model="plan.name" @change="store.touchPlan(plan)" />
        <p class="dim stats">
          {{ cls.name }}・{{ plan.assignments.length }}/{{ cls.students.filter((s) => s.active).length }} 人已排・{{ seatCount }} 個座位
          <template v-if="lastArchive">・上次封存 {{ lastArchive }}</template>
        </p>
      </div>
      <RouterLink :to="{ name: 'plans' }"><button>← 回座位表列表</button></RouterLink>
    </div>

    <div class="toolbar panel no-print">
      <div class="view-toggle">
        <button :class="{ active: viewMode === 'student' }" @click="viewMode = 'student'">🧑‍🎓 學生視角</button>
        <button :class="{ active: viewMode === 'teacher' }" @click="viewMode = 'teacher'">🧑‍🏫 老師視角</button>
        <span class="zoom-group">
          <button :disabled="zoom <= 1" title="縮小" @click="zoomBy(-0.25)">🔍−</button>
          <span class="dim zoom-label">{{ Math.round(zoom * 100) }}%</span>
          <button :disabled="zoom >= 2" title="放大" @click="zoomBy(0.25)">🔍＋</button>
        </span>
      </div>
      <div class="batch">
        <button
          :class="{ 'pts-on': pointsMode }"
          :title="pointsMode ? '關閉加減分，回到編排模式' : '開啟後點學生即可加減分'"
          @click="pointsMode = !pointsMode"
        >⭐ 加減分</button>
        <template v-if="pointsMode">
          <button class="pt-btn" :class="{ 'plus-on': pointDelta === 1 }" @click="pointDelta = 1">＋1</button>
          <button class="pt-btn" :class="{ 'minus-on': pointDelta === -1 }" @click="pointDelta = -1">−1</button>
          <button @click="resetPoints">歸零</button>
        </template>
        <template v-else>
          <button class="primary" @click="autoArrange(false)">🎲 自動排位</button>
          <button @click="autoArrange(true)">換一個方案</button>
          <button @click="showRules = true">⚖️ 規則</button>
          <button @click="fill">依座號填入</button>
          <button @click="clearAll">清空</button>
          <button @click="archive">📌 封存輪替</button>
        </template>
        <button @click="doPrint">🖨️ 列印</button>
        <button @click="exportPng">🖼️ PNG</button>
        <button v-if="!pointsMode" @click="exportXlsx">📊 Excel</button>
      </div>
    </div>
    <p v-if="pointsMode" class="pts-hint no-print">
      ⭐ 加減分模式：點座位上的學生就{{ pointDelta === 1 ? '加' : '扣' }} 1 分（右下角徽章是目前分數）。編排功能已暫停，再按一次「⭐ 加減分」關閉。
    </p>

    <p v-if="hint" class="hint no-print">⚠ {{ hint }}</p>
    <div v-if="infeasible.length" class="infeasible no-print">
      <p v-for="(m, i) in infeasible" :key="i">🚫 {{ m }}</p>
    </div>

    <div class="workspace">
      <div class="board-col">
        <div class="board panel" ref="boardEl">
          <div class="print-only print-header">
            <h2>{{ plan.name }}</h2>
            <p>{{ cls.name }}・{{ viewMode === 'teacher' ? '老師視角（前方在下）' : '學生視角（前方在上）' }}・{{ today }}</p>
          </div>
          <div class="front-label">{{ viewMode === 'teacher' ? '▼ 前方（黑板）在下' : '▲ 前方（黑板）在上' }}</div>
          <div class="canvas-scroll">
            <div class="canvas-zoom" :style="{ width: zoom * 100 + '%' }">
              <SeatCanvas
                :layout="viewLayout"
                :selected="selection?.fromSeatId ? [selection.fromSeatId] : []"
                mode="seating"
                :cell-w="80"
                :cell-h="46"
                :show-grid="false"
                @select="onSeatClick"
                @clear-select="onClearSelect"
              >
                <template #seat-label="{ seat, cx, cy, w, h }">
                  <text :x="cx" :y="cy - 7" text-anchor="middle" font-size="9.5" fill="#64748b">
                    {{ studentAtSeat.get(seat.id)?.seatNo ?? '' }}
                  </text>
                  <text
                    :x="cx" :y="cy + 11" text-anchor="middle"
                    :font-size="nameFontSize(studentAtSeat.get(seat.id)?.name)"
                    font-weight="600" fill="#1f2937"
                  >
                    {{ studentAtSeat.get(seat.id)?.name ?? '' }}
                  </text>
                  <text v-if="lockedSeats.has(seat.id)" :x="cx - w / 2 + 8" :y="cy - h / 2 + 15" font-size="10">🔒</text>
                  <circle v-if="conflictSeatIds.has(seat.id)" :cx="cx + w / 2 - 10" :cy="cy - h / 2 + 10" r="4.5" fill="#f59e0b" class="no-print-svg" />
                  <!-- 加減分徽章 -->
                  <g v-if="pointsMode && studentAtSeat.get(seat.id)" class="no-print-svg">
                    <circle
                      :cx="cx + w / 2 - 12" :cy="cy + h / 2 - 12" r="8.5"
                      :fill="(studentAtSeat.get(seat.id).points || 0) > 0 ? '#16a34a' : (studentAtSeat.get(seat.id).points || 0) < 0 ? '#dc2626' : '#94a3b8'"
                    />
                    <text :x="cx + w / 2 - 12" :y="cy + h / 2 - 9" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">
                      {{ studentAtSeat.get(seat.id).points || 0 }}
                    </text>
                  </g>
                  <text
                    v-if="ptFlash && ptFlash.seatId === seat.id"
                    :key="ptFlash.n"
                    class="pt-anim no-print-svg"
                    :x="cx + w / 2 - 12" :y="cy - 4" text-anchor="middle"
                    font-size="13" font-weight="700"
                    :fill="ptFlash.delta > 0 ? '#16a34a' : '#dc2626'"
                  >{{ ptFlash.delta > 0 ? '+1' : '−1' }}</text>
                </template>
              </SeatCanvas>
            </div>
          </div>
        </div>

        <div v-if="evaluation.violations.length" class="conflicts panel no-print">
          <h4>⚠ {{ evaluation.violations.length }} 個未滿足的條件（分數 {{ evaluation.score }}，越低越好）</h4>
          <ul>
            <li v-for="(v, i) in evaluation.violations" :key="i">
              <span class="chip rule-chip">{{ ruleLabel(v.ruleId) }}</span> {{ v.message }}
            </li>
          </ul>
        </div>
        <div v-else-if="plan.assignments.length" class="conflicts ok panel no-print">
          ✅ 所有啟用的規則都滿足（分數 0）
        </div>
      </div>

      <aside class="side no-print">
        <div v-if="selectedStudent" class="panel picked">
          <h4>{{ selectedStudent.seatNo }} {{ selectedStudent.name }}</h4>
          <p class="dim">{{ selection.fromSeatId ? '點另一個座位交換／移動' : '點一個座位入座' }}</p>
          <div class="picked-ops">
            <button v-if="selection.fromSeatId" @click="toggleLockSelected">
              {{ selectionLocked ? '🔓 解除鎖定' : '🔒 鎖定座位' }}
            </button>
            <button v-if="selection.fromSeatId" @click="unassignSelected">放回名單</button>
            <button @click="selection = null">取消</button>
          </div>
          <div v-if="selectedExplain.length" class="explain">
            <p class="dim">這個座位對他而言：</p>
            <p v-for="(e, i) in selectedExplain" :key="i" :class="e.penalty ? 'bad' : 'good'">
              {{ e.penalty ? '⚠' : '✓' }} {{ e.message }}
            </p>
          </div>
        </div>

        <div class="panel palette">
          <h4>未安排（{{ unassigned.length }}）</h4>
          <p v-if="!unassigned.length" class="dim" style="margin: 0">全部排好了 🎉</p>
          <div class="chips">
            <button
              v-for="stu in unassigned" :key="stu.id"
              class="stu-chip"
              :class="{ picked: selection?.studentId === stu.id }"
              @click="pickStudent(stu)"
            >{{ stu.seatNo }} {{ stu.name }}</button>
          </div>
        </div>

        <div class="panel tips dim">
          🎲 自動排位會依「規則」考量需求標籤與人際關係；橘點是未滿足規則的座位，點開可看原因。手動微調後衝突清單會即時更新。
        </div>
      </aside>
    </div>

    <!-- 規則設定 -->
    <div v-if="showRules" class="modal-mask no-print" @click.self="showRules = false">
      <div class="modal rules-modal">
        <h3>排位規則與權重</h3>
        <p class="dim" style="margin: 4px 0 14px">勾選要啟用的規則，權重越高越優先滿足。改完直接按「自動排位」生效。</p>
        <div v-for="[groupName, rules] in ruleGroups" :key="groupName" class="rule-group">
          <h4>{{ groupName }}</h4>
          <div v-for="r in rules" :key="r.id" class="rule-row">
            <label class="rule-main">
              <input type="checkbox" v-model="rulesCfg[r.id].enabled" @change="store.touchPlan(plan)" />
              <span>{{ r.label }}</span>
              <select
                v-if="r.id === 'gender_alt_columns'"
                v-model="rulesCfg[r.id].phase"
                :disabled="!rulesCfg[r.id].enabled"
                class="phase-sel"
                @click.prevent
                @change="store.touchPlan(plan)"
              >
                <option value="auto">自動</option>
                <option value="M">男生先（最左排男生）</option>
                <option value="F">女生先（最左排女生）</option>
              </select>
              <span class="dim desc">{{ r.desc }}</span>
            </label>
            <input
              type="range" min="1" max="10"
              v-model.number="rulesCfg[r.id].weight"
              :disabled="!rulesCfg[r.id].enabled"
              @change="store.touchPlan(plan)"
            />
            <span class="w">{{ rulesCfg[r.id].weight }}</span>
          </div>
        </div>
        <div style="text-align: right; margin-top: 12px">
          <button class="primary" @click="showRules = false; autoArrange(false)">套用並自動排位</button>
          <button @click="showRules = false" style="margin-left: 8px">關閉</button>
        </div>
      </div>
    </div>
  </div>
  <p v-else class="dim">找不到這張座位表。<RouterLink :to="{ name: 'plans' }">回列表</RouterLink></p>
</template>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.name-input { font-size: 22px; font-weight: 700; border-color: transparent; background: transparent; padding: 2px 6px; width: 420px; max-width: 60vw; }
.name-input:hover { border-color: var(--border); }
.stats { margin: 4px 0 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; margin-bottom: 12px; flex-wrap: wrap; }
.view-toggle, .batch { display: flex; gap: 6px; flex-wrap: wrap; }
.view-toggle button.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.hint { background: var(--warn-bg); color: var(--warn-text); border-radius: 8px; padding: 8px 14px; margin: 0 0 12px; }
.infeasible { background: #fef2f2; color: var(--danger); border-radius: 8px; padding: 8px 14px; margin: 0 0 12px; }
.infeasible p { margin: 2px 0; }
.workspace { display: grid; grid-template-columns: 1fr 240px; gap: 14px; align-items: start; }
.board-col { display: flex; flex-direction: column; gap: 12px; }
.board { padding: 12px; }
.front-label { text-align: center; font-size: 12.5px; color: var(--text-dim); margin-bottom: 6px; letter-spacing: 2px; }
.conflicts { padding: 12px 16px; }
.conflicts h4 { margin: 0 0 8px; }
.conflicts ul { margin: 0; padding-left: 4px; list-style: none; font-size: 13.5px; line-height: 1.9; }
.conflicts.ok { color: #15803d; background: #f0fdf4; }
.rule-chip { font-size: 11px; margin-right: 4px; }
.side { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 12px; }
.picked, .palette { padding: 12px 14px; }
.picked h4, .palette h4 { margin: 0 0 6px; }
.picked p { margin: 0 0 8px; font-size: 13px; }
.picked-ops { display: flex; gap: 6px; flex-wrap: wrap; }
.picked-ops button { font-size: 12.5px; padding: 4px 10px; }
.explain { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
.explain p { margin: 3px 0; font-size: 12.5px; }
.explain .good { color: #15803d; }
.explain .bad { color: #b45309; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; max-height: 40vh; overflow-y: auto; }
.stu-chip { font-size: 13px; padding: 4px 10px; border-radius: 999px; }
.stu-chip.picked { background: var(--primary); border-color: var(--primary); color: #fff; }
.tips { padding: 10px 14px; font-size: 12.5px; line-height: 1.6; }
.print-header { text-align: center; margin-bottom: 8px; }
.print-header h2 { margin: 0; }
.print-header p { margin: 4px 0 0; color: #555; }
.rules-modal h3 { margin: 0; }
.rule-group h4 { margin: 14px 0 6px; color: var(--text-dim); font-size: 13px; letter-spacing: 1px; }
.rule-row { display: grid; grid-template-columns: 1fr 140px 24px; gap: 10px; align-items: center; padding: 5px 0; }
.rule-main { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.phase-sel { font-size: 12.5px; padding: 3px 6px; }
.rule-main .desc { font-size: 12px; }
.rule-row .w { text-align: right; font-size: 13px; color: var(--text-dim); }
.zoom-group { display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.zoom-label { font-size: 12.5px; min-width: 40px; text-align: center; }
.canvas-scroll { overflow-x: auto; }
.canvas-zoom { min-width: 100%; }
.pts-hint { background: #fefce8; color: #854d0e; border-radius: 8px; padding: 8px 14px; margin: 0 0 12px; font-size: 13.5px; }
.batch button.pts-on { background: #fbbf24; border-color: #f59e0b; color: #78350f; font-weight: 600; }
.pt-btn { min-width: 48px; font-weight: 700; }
.pt-btn.plus-on { background: #dcfce7; border-color: #16a34a; color: #15803d; }
.pt-btn.minus-on { background: #fee2e2; border-color: #dc2626; color: #b91c1c; }
.pt-anim { animation: pt-rise 0.8s ease-out forwards; }
@keyframes pt-rise {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-12px); }
}
@media print {
  /* 一頁印完一個班：畫布給定固定高度、等比縮放進 A4 橫式單頁 */
  .workspace { display: block; }
  .board { border: none; box-shadow: none; padding: 0; page-break-inside: avoid; page-break-after: avoid; }
  .canvas-scroll { overflow: visible; }
  .canvas-zoom { width: 100% !important; }
  .board :deep(.seat-canvas) { height: 150mm; width: 100%; margin: 0 auto; display: block; }
  .conflicts { display: none; }
  .no-print-svg { display: none; }
}
@media (max-width: 800px) { .workspace { grid-template-columns: 1fr; } .side { position: static; } }
</style>
