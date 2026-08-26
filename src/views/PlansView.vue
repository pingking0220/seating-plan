<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import SeatCanvas from '@/components/layout/SeatCanvas.vue'
import { createPlan } from '@/core/seating/plan.js'
import { solve } from '@/core/solver/solve.js'
import { defaultRulesConfig } from '@/core/rules/registry.js'

const store = useWorkspaceStore()
const router = useRouter()

const classId = ref('')
const layoutId = ref('')

const canCreate = computed(() => classId.value && layoutId.value)
const ready = computed(() => store.classes.length && store.layouts.length)

function create() {
  if (!canCreate.value) return
  const cls = store.classById(classId.value)
  const layout = store.layoutById(layoutId.value)
  const plan = createPlan({
    classId: classId.value,
    layoutId: layoutId.value,
    name: `${cls.name}座位表（${layout.name}）`,
  })
  store.addPlan(plan)
  router.push({ name: 'seating', params: { id: plan.id } })
}
function remove(p) {
  if (confirm(`確定刪除「${p.name}」？`)) store.removePlan(p.id)
}
function layoutOf(p) {
  return store.layoutById(p.layoutId)
}
function classOf(p) {
  return store.classById(p.classId)
}

/* ---------- 批次建立 ---------- */
const showBatch = ref(false)
const templateId = ref('')
const batchClassIds = ref([])
const batchAutoArrange = ref(true)
const batchResult = ref('')

const templatePlan = computed(() => store.planById(templateId.value))
const templateLayout = computed(() => store.layoutById(templatePlan.value?.layoutId))

function openBatch(p) {
  templateId.value = p ? p.id : store.plans[0]?.id || ''
  batchClassIds.value = store.classes
    .filter((c) => c.students.length && c.id !== store.planById(templateId.value)?.classId)
    .map((c) => c.id)
  batchAutoArrange.value = true
  batchResult.value = ''
  showBatch.value = true
}
function toggleBatchClass(id) {
  const i = batchClassIds.value.indexOf(id)
  if (i >= 0) batchClassIds.value.splice(i, 1)
  else batchClassIds.value.push(id)
}
function onTemplateChange() {
  // 換範本時預設排除範本自己的班級
  const tplCls = templatePlan.value?.classId
  batchClassIds.value = store.classes.filter((c) => c.students.length && c.id !== tplCls).map((c) => c.id)
}
/* ---------- 批次列印 ---------- */
const showPrint = ref(false)
const printPlanIds = ref([])
const printViewMode = ref('student')

function openPrint() {
  printPlanIds.value = store.plans
    .filter((p) => store.classById(p.classId) && store.layoutById(p.layoutId) && p.assignments.length)
    .map((p) => p.id)
  printViewMode.value = 'student'
  showPrint.value = true
}
function togglePrintPlan(id) {
  const i = printPlanIds.value.indexOf(id)
  if (i >= 0) printPlanIds.value.splice(i, 1)
  else printPlanIds.value.push(id)
}
function startPrint() {
  store.batchPrint = { planIds: printPlanIds.value.slice(), viewMode: printViewMode.value }
  showPrint.value = false
  router.push({ name: 'print-batch' })
}

function runBatch() {
  const tpl = templatePlan.value
  const layout = templateLayout.value
  if (!tpl || !layout) return
  let created = 0
  let arranged = 0
  for (const cid of batchClassIds.value) {
    const cls = store.classById(cid)
    if (!cls || !cls.students.length) continue
    const plan = createPlan({
      classId: cid,
      layoutId: tpl.layoutId,
      name: `${cls.name}座位表（${layout.name}）`,
      rules: JSON.parse(JSON.stringify(tpl.rules || defaultRulesConfig())),
    })
    if (batchAutoArrange.value) {
      const res = solve({
        layout,
        students: cls.students,
        relations: cls.relations || [],
        rulesConfig: plan.rules,
        prev: store.lastRecordOf(cid),
        seed: 1,
      })
      plan.assignments = res.assignments
      plan.seed = 1
      arranged++
    }
    store.addPlan(plan)
    created++
  }
  batchResult.value = `已建立 ${created} 張座位表${batchAutoArrange.value ? `（${arranged} 張已自動排位）` : ''}`
  setTimeout(() => { showBatch.value = false }, 1200)
}
</script>

<template>
  <div>
    <div class="head">
      <h2>座位表</h2>
      <div class="head-actions">
        <button v-if="store.plans.length" @click="openBatch(null)">📑 批次建立</button>
        <button v-if="store.plans.length" @click="openPrint()">🖨️ 批次列印</button>
        <form v-if="ready" class="create" @submit.prevent="create">
          <select v-model="classId">
            <option value="" disabled>選班級</option>
            <option v-for="c in store.classes" :key="c.id" :value="c.id">{{ c.name }}（{{ c.students.length }}人）</option>
          </select>
          <select v-model="layoutId">
            <option value="" disabled>選教室佈局</option>
            <option v-for="l in store.layouts" :key="l.id" :value="l.id">{{ l.name }}（{{ l.seats.filter((s) => s.enabled).length }}座）</option>
          </select>
          <button class="primary" type="submit" :disabled="!canCreate">＋ 建立座位表</button>
        </form>
      </div>
    </div>

    <p v-if="!ready" class="empty dim">
      建立座位表需要先有<RouterLink to="/">班級名單</RouterLink>和<RouterLink to="/layouts">教室佈局</RouterLink>。
    </p>
    <p v-else-if="!store.plans.length" class="empty dim">
      還沒有座位表。選一個班級和一種教室佈局開始編排。
    </p>

    <div class="grid">
      <div v-for="p in store.plans" :key="p.id" class="panel card">
        <RouterLink v-if="layoutOf(p)" :to="{ name: 'seating', params: { id: p.id } }" class="thumb">
          <SeatCanvas :layout="layoutOf(p)" :interactive="false" />
        </RouterLink>
        <div class="meta">
          <strong>{{ p.name }}</strong>
          <span class="dim">{{ classOf(p)?.name }}・已排 {{ p.assignments.length }} 人</span>
        </div>
        <div class="ops">
          <RouterLink :to="{ name: 'seating', params: { id: p.id } }"><button>編排</button></RouterLink>
          <button @click="openBatch(p)" title="用這張的規則與教室，批次建立其他班級的座位表">套用到其他班</button>
          <button class="danger-ghost" @click="remove(p)">刪除</button>
        </div>
      </div>
    </div>

    <!-- 批次列印 -->
    <div v-if="showPrint" class="modal-mask" @click.self="showPrint = false">
      <div class="modal batch-modal">
        <h3>🖨️ 批次列印</h3>
        <p class="dim">勾選要列印的座位表，一次送印、每班一頁（A4 橫式）。</p>

        <div class="field">
          <div class="cls-head">
            要列印的座位表（{{ printPlanIds.length }} 張）
            <button class="mini" @click="printPlanIds = store.plans.filter((p) => p.assignments.length).map((p) => p.id)">全選</button>
            <button class="mini" @click="printPlanIds = []">全不選</button>
          </div>
          <div class="cls-grid">
            <label v-for="p in store.plans" :key="p.id" class="cls-opt" :class="{ off: !p.assignments.length }">
              <input
                type="checkbox"
                :checked="printPlanIds.includes(p.id)"
                :disabled="!p.assignments.length"
                @change="togglePrintPlan(p.id)"
              />
              {{ p.name }}<span class="dim">（{{ p.assignments.length }}人）</span>
            </label>
          </div>
        </div>

        <div class="field">
          視角
          <div class="view-radio">
            <label><input type="radio" v-model="printViewMode" value="student" /> 🧑‍🎓 學生視角（前方在上）</label>
            <label><input type="radio" v-model="printViewMode" value="teacher" /> 🧑‍🏫 老師視角（前方在下）</label>
          </div>
        </div>

        <div class="actions">
          <button @click="showPrint = false">取消</button>
          <button class="primary" :disabled="!printPlanIds.length" @click="startPrint">
            列印 {{ printPlanIds.length }} 張（每班一頁）
          </button>
        </div>
      </div>
    </div>

    <!-- 批次建立 -->
    <div v-if="showBatch" class="modal-mask" @click.self="showBatch = false">
      <div class="modal batch-modal">
        <h3>📑 批次建立座位表</h3>
        <p class="dim">選一張現有座位表當範本 — 新座位表沿用它的<strong>教室佈局</strong>與<strong>規則設定</strong>，套用到勾選的班級。</p>

        <label class="field">
          範本座位表
          <select v-model="templateId" @change="onTemplateChange">
            <option v-for="p in store.plans" :key="p.id" :value="p.id">
              {{ p.name }}（{{ classOf(p)?.name }}）
            </option>
          </select>
        </label>
        <p v-if="templateLayout" class="dim tpl-info">
          教室：{{ templateLayout.name }}（{{ templateLayout.seats.filter((s) => s.enabled).length }} 座）・規則設定一併複製
        </p>

        <div class="field">
          <div class="cls-head">
            套用到哪些班級（{{ batchClassIds.length }} 個）
            <button class="mini" @click="batchClassIds = store.classes.filter((c) => c.students.length).map((c) => c.id)">全選</button>
            <button class="mini" @click="batchClassIds = []">全不選</button>
          </div>
          <div class="cls-grid">
            <label v-for="c in store.classes" :key="c.id" class="cls-opt" :class="{ off: !c.students.length }">
              <input
                type="checkbox"
                :checked="batchClassIds.includes(c.id)"
                :disabled="!c.students.length"
                @change="toggleBatchClass(c.id)"
              />
              {{ c.name }}<span class="dim">（{{ c.students.length }}人）</span>
            </label>
          </div>
        </div>

        <label class="field check">
          <input type="checkbox" v-model="batchAutoArrange" />
          建立後立即自動排位（依各班的名單、標籤與人際關係）
        </label>

        <p v-if="batchResult" class="batch-done">✅ {{ batchResult }}</p>
        <div class="actions">
          <button @click="showBatch = false">取消</button>
          <button class="primary" :disabled="!templatePlan || !batchClassIds.length" @click="runBatch">
            建立 {{ batchClassIds.length }} 張座位表
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.create { display: flex; gap: 8px; flex-wrap: wrap; }
.empty { padding: 48px 0; text-align: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.card { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.thumb { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.meta { display: flex; flex-direction: column; gap: 2px; }
.meta .dim { font-size: 12.5px; }
.ops { display: flex; gap: 6px; flex-wrap: wrap; }
.ops button { font-size: 12.5px; padding: 4px 10px; }
.batch-modal { max-width: 560px; }
.batch-modal h3 { margin: 0 0 6px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; font-size: 14px; }
.field.check { flex-direction: row; align-items: center; gap: 8px; }
.tpl-info { margin: 6px 0 0; font-size: 13px; }
.cls-head { display: flex; align-items: center; gap: 8px; }
.mini { font-size: 12px; padding: 2px 8px; }
.cls-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px; }
.cls-opt { display: flex; align-items: center; gap: 6px; font-size: 13.5px; padding: 3px 0; }
.cls-opt.off { opacity: 0.45; }
.batch-done { color: #15803d; margin: 12px 0 0; }
.view-radio { display: flex; gap: 18px; flex-wrap: wrap; }
.view-radio label { display: flex; align-items: center; gap: 6px; font-size: 13.5px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
</style>
