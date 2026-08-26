<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import SeatCanvas from '@/components/layout/SeatCanvas.vue'
import { flipLayout } from '@/core/seating/plan.js'

const store = useWorkspaceStore()
const router = useRouter()

const job = computed(() => store.batchPrint)
const viewMode = computed(() => job.value?.viewMode || 'student')

const pages = computed(() => {
  if (!job.value) return []
  return job.value.planIds
    .map((id) => store.planById(id))
    .filter((p) => p && store.classById(p.classId) && store.layoutById(p.layoutId))
    .map((p) => {
      const cls = store.classById(p.classId)
      const layout = store.layoutById(p.layoutId)
      const stuById = new Map(cls.students.map((s) => [s.id, s]))
      const atSeat = new Map()
      for (const a of p.assignments) atSeat.set(a.seatId, stuById.get(a.studentId))
      const cellW = p.cellW ?? 80
      const cellH = p.cellH ?? 46
      const nameFont = p.nameFont ?? 17
      return {
        plan: p,
        cls,
        layout: viewMode.value === 'teacher' ? flipLayout(layout) : layout,
        atSeat,
        cellW,
        cellH,
        nameFont,
        seatNoFont: Math.max(7, nameFont * 0.58),
      }
    })
})

function nameFontSize(name, base) {
  const len = (name || '').length
  const factor = len >= 5 ? 0.72 : len === 4 ? 0.85 : 1
  return Math.max(8, base * factor)
}

const today = new Date().toLocaleDateString('zh-TW')

function goBack() {
  store.batchPrint = null
  router.push({ name: 'plans' })
}
function doPrint() {
  window.print()
}

onMounted(() => {
  if (!pages.value.length) {
    router.replace({ name: 'plans' })
    return
  }
  // 稍等版面渲染完再叫出列印對話框
  setTimeout(() => window.print(), 400)
})
</script>

<template>
  <div class="print-batch">
    <div class="bar no-print panel">
      <span>批次列印：{{ pages.length }} 張座位表（{{ viewMode === 'teacher' ? '老師視角' : '學生視角' }}），每班一頁</span>
      <span class="ops">
        <button class="primary" @click="doPrint">🖨️ 再次列印</button>
        <button @click="goBack">← 回座位表列表</button>
      </span>
    </div>

    <div v-for="page in pages" :key="page.plan.id" class="page">
      <div class="page-header">
        <h2>{{ page.plan.name }}</h2>
        <p>{{ page.cls.name }}・{{ viewMode === 'teacher' ? '老師視角（前方在下）' : '學生視角（前方在上）' }}・{{ today }}</p>
        <div class="front-label">{{ viewMode === 'teacher' ? '▼ 前方（黑板）在下' : '▲ 前方（黑板）在上' }}</div>
      </div>
      <SeatCanvas :layout="page.layout" :interactive="false" :cell-w="page.cellW" :cell-h="page.cellH" :show-grid="false" compact>
        <template #seat-label="{ seat, cx, cy }">
          <text :x="cx" :y="cy - page.nameFont * 0.45" text-anchor="middle" :font-size="page.seatNoFont" fill="#64748b">
            {{ page.atSeat.get(seat.id)?.seatNo ?? '' }}
          </text>
          <text
            :x="cx" :y="cy + page.nameFont * 0.65" text-anchor="middle"
            :font-size="nameFontSize(page.atSeat.get(seat.id)?.name, page.nameFont)"
            font-weight="600" fill="#1f2937"
          >
            {{ page.atSeat.get(seat.id)?.name ?? '' }}
          </text>
        </template>
      </SeatCanvas>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 10px 16px; margin-bottom: 16px; flex-wrap: wrap;
}
.ops { display: flex; gap: 8px; }
.page { margin-bottom: 28px; }
.page-header { text-align: center; margin-bottom: 6px; }
.page-header h2 { margin: 0; font-size: 20px; }
.page-header p { margin: 3px 0; color: var(--text-dim); font-size: 13.5px; }
.front-label { font-size: 12px; color: var(--text-dim); letter-spacing: 2px; }
.page :deep(.seat-canvas) { border: 1px solid var(--border); }
@media print {
  .page { margin: 0; page-break-after: always; page-break-inside: avoid; }
  .page:last-child { page-break-after: auto; }
  .page :deep(.seat-canvas) { height: 150mm; width: 100%; margin: 0 auto; display: block; border: none; }
}
</style>
