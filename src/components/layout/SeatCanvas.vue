<script setup>
import { computed, ref } from 'vue'
import { FURNITURE_KINDS, groupColor } from '@/core/model/defaults.js'

const props = defineProps({
  layout: { type: Object, required: true },
  selected: { type: Array, default: () => [] },
  tool: { type: String, default: 'select' },
  interactive: { type: Boolean, default: true },
  mode: { type: String, default: 'layout' }, // 'layout' | 'seating'
  cellW: { type: Number, default: 44 }, // 座位格寬（px，SVG 座標）
  cellH: { type: Number, default: 44 }, // 座位格高
  showGrid: { type: Boolean, default: true },
  // compact：走道（沒有座位的行/列）用固定尺寸，不隨座位大小縮放
  compact: { type: Boolean, default: false },
  aisleW: { type: Number, default: 28 },
  aisleH: { type: Number, default: 26 },
})
const emit = defineEmits(['select', 'clear-select', 'add-at', 'erase', 'drag-start', 'drag-delta', 'drag-end'])

const cw = computed(() => props.cellW)
const ch = computed(() => props.cellH)

const seatCols = computed(() => new Set(props.layout.seats.map((s) => s.col)))
const seatRows = computed(() => new Set(props.layout.seats.map((s) => s.row)))

/** 每一行/列的起始座標（前綴和）— compact 時走道行列用固定尺寸 */
const colX = computed(() => {
  const arr = [0]
  for (let c = 0; c < props.layout.grid.cols; c++) {
    const w = !props.compact || seatCols.value.has(c) ? cw.value : props.aisleW
    arr.push(arr[c] + w)
  }
  return arr
})
const rowY = computed(() => {
  const arr = [0]
  for (let r = 0; r < props.layout.grid.rows; r++) {
    const h = !props.compact || seatRows.value.has(r) ? ch.value : props.aisleH
    arr.push(arr[r] + h)
  }
  return arr
})

const svgEl = ref(null)
const width = computed(() => colX.value[props.layout.grid.cols])
const height = computed(() => rowY.value[props.layout.grid.rows])
const selectedSet = computed(() => new Set(props.selected))

const seatMap = computed(() => {
  const m = new Map()
  for (const s of props.layout.seats) m.set(`${s.col},${s.row}`, s)
  return m
})
function furnitureAt(col, row) {
  return props.layout.furniture.find(
    (f) => col >= f.col && col < f.col + f.w && row >= f.row && row < f.row + f.h,
  )
}
function kindDef(kind) {
  return FURNITURE_KINDS.find((k) => k.id === kind) || { label: kind, emoji: '▫' }
}
function seatFill(seat) {
  return groupColor(seat.groupId, props.layout) || '#e8eef5'
}
function furnX(f) {
  return colX.value[f.col]
}
function furnW(f) {
  return colX.value[Math.min(f.col + f.w, props.layout.grid.cols)] - colX.value[f.col]
}
function furnY(f) {
  return rowY.value[f.row]
}
function furnH(f) {
  return rowY.value[Math.min(f.row + f.h, props.layout.grid.rows)] - rowY.value[f.row]
}

/* ---------- 指標事件 ---------- */
let drag = null
function cellOf(e) {
  const rect = svgEl.value.getBoundingClientRect()
  const sx = ((e.clientX - rect.left) / rect.width) * width.value
  const sy = ((e.clientY - rect.top) / rect.height) * height.value
  let col = props.layout.grid.cols - 1
  for (let c = 0; c < props.layout.grid.cols; c++) {
    if (sx < colX.value[c + 1]) { col = c; break }
  }
  let row = props.layout.grid.rows - 1
  for (let r = 0; r < props.layout.grid.rows; r++) {
    if (sy < rowY.value[r + 1]) { row = r; break }
  }
  return { col: Math.max(0, col), row: Math.max(0, row) }
}
function onPointerDown(e) {
  if (!props.interactive) return
  const { col, row } = cellOf(e)
  const seat = seatMap.value.get(`${col},${row}`)
  const furn = furnitureAt(col, row)
  const target = seat ? { type: 'seat', id: seat.id } : furn ? { type: 'furniture', id: furn.id } : null

  if (props.tool === 'erase') {
    if (target) emit('erase', target)
    return
  }
  if (props.tool === 'seat' || props.tool === 'furniture') {
    if (!target) emit('add-at', { col, row })
    return
  }
  // select 工具
  if (!target) {
    emit('clear-select')
    return
  }
  if (props.mode === 'seating') {
    if (target.type === 'seat') emit('select', { ...target, additive: false })
    return
  }
  emit('select', { ...target, additive: e.ctrlKey || e.metaKey || e.shiftKey })
  emit('drag-start', target)
  drag = { startCol: col, startRow: row, lastDc: 0, lastDr: 0 }
  svgEl.value.setPointerCapture(e.pointerId)
}
function onPointerMove(e) {
  if (!drag) return
  const { col, row } = cellOf(e)
  const dc = col - drag.startCol
  const dr = row - drag.startRow
  if (dc !== drag.lastDc || dr !== drag.lastDr) {
    drag.lastDc = dc
    drag.lastDr = dr
    emit('drag-delta', { dc, dr })
  }
}
function onPointerUp() {
  if (!drag) return
  const moved = drag.lastDc !== 0 || drag.lastDr !== 0
  drag = null
  emit('drag-end', { moved })
}

/** 座位朝向缺口：rotation 0=朝上 90=朝右 180=朝下 270=朝左 */
function notchTransform(seat) {
  const cx = colX.value[seat.col] + cw.value / 2
  const cy = rowY.value[seat.row] + ch.value / 2
  return `rotate(${seat.rotation || 0} ${cx} ${cy})`
}
</script>

<template>
  <svg
    ref="svgEl"
    :viewBox="`0 0 ${width} ${height}`"
    class="seat-canvas"
    style="font-family: 'Segoe UI', 'Microsoft JhengHei', sans-serif"
    :class="{ interactive }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <!-- 底 + 格線 -->
    <rect :width="width" :height="height" fill="#fbfcfe" />
    <g v-if="showGrid" stroke="#eef1f5" stroke-width="1">
      <line v-for="c in layout.grid.cols - 1" :key="'v' + c" :x1="colX[c]" y1="0" :x2="colX[c]" :y2="height" />
      <line v-for="r in layout.grid.rows - 1" :key="'h' + r" x1="0" :y1="rowY[r]" :x2="width" :y2="rowY[r]" />
    </g>

    <!-- 家具 -->
    <g v-for="f in layout.furniture" :key="f.id">
      <rect
        :x="furnX(f) + 2" :y="furnY(f) + 2"
        :width="furnW(f) - 4" :height="furnH(f) - 4"
        rx="6"
        :fill="f.kind === 'board' ? '#334155' : '#e2e8f0'"
        :stroke="selectedSet.has(f.id) ? '#2563eb' : '#cbd5e1'"
        :stroke-width="selectedSet.has(f.id) ? 3 : 1"
      />
      <text
        :x="furnX(f) + furnW(f) / 2" :y="furnY(f) + furnH(f) / 2 + 5"
        text-anchor="middle" :font-size="14"
        :fill="f.kind === 'board' ? '#fff' : '#475569'"
      >{{ kindDef(f.kind).emoji }} {{ kindDef(f.kind).label }}</text>
    </g>

    <!-- 座位 -->
    <g v-for="s in layout.seats" :key="s.id" :opacity="s.enabled ? 1 : 0.3">
      <rect
        :x="colX[s.col] + 3" :y="rowY[s.row] + 3"
        :width="cw - 6" :height="ch - 6" rx="8"
        :fill="seatFill(s)"
        :stroke="selectedSet.has(s.id) ? '#2563eb' : '#b6c2d0'"
        :stroke-width="selectedSet.has(s.id) ? 3 : 1.5"
      />
      <!-- 朝向缺口 -->
      <rect
        :x="colX[s.col] + cw / 2 - 7" :y="rowY[s.row] + 2" width="14" height="5" rx="2.5"
        fill="#7c8b9d" :transform="notchTransform(s)"
      />
      <text v-if="!s.enabled" :x="colX[s.col] + cw / 2" :y="rowY[s.row] + ch / 2 + 6" text-anchor="middle" font-size="17" fill="#94a3b8">✕</text>
      <text v-if="s.tags.length" :x="colX[s.col] + cw - 10" :y="rowY[s.row] + ch - 8" text-anchor="middle" font-size="11">
        {{ s.tags.includes('accessible') ? '♿' : s.tags.includes('fixed_pc') ? '💻' : '🧪' }}
      </text>
      <slot name="seat-label" :seat="s" :cx="colX[s.col] + cw / 2" :cy="rowY[s.row] + ch / 2" :w="cw" :h="ch" />
    </g>
  </svg>
</template>

<style scoped>
.seat-canvas { width: 100%; height: auto; display: block; border-radius: 10px; touch-action: none; user-select: none; }
.seat-canvas.interactive { cursor: pointer; }
</style>
