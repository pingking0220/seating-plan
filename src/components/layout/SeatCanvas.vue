<script setup>
import { computed, ref } from 'vue'
import { FURNITURE_KINDS, groupColor } from '@/core/model/defaults.js'

const C = 44 // 每格 px（SVG 座標）
const props = defineProps({
  layout: { type: Object, required: true },
  selected: { type: Array, default: () => [] },
  tool: { type: String, default: 'select' },
  interactive: { type: Boolean, default: true },
  mode: { type: String, default: 'layout' }, // 'layout' | 'seating'
})
const emit = defineEmits(['select', 'clear-select', 'add-at', 'erase', 'drag-start', 'drag-delta', 'drag-end'])

const svgEl = ref(null)
const width = computed(() => props.layout.grid.cols * C)
const height = computed(() => props.layout.grid.rows * C)
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

/* ---------- 指標事件 ---------- */
let drag = null
function cellOf(e) {
  const rect = svgEl.value.getBoundingClientRect()
  const col = Math.floor(((e.clientX - rect.left) / rect.width) * props.layout.grid.cols)
  const row = Math.floor(((e.clientY - rect.top) / rect.height) * props.layout.grid.rows)
  return {
    col: Math.max(0, Math.min(props.layout.grid.cols - 1, col)),
    row: Math.max(0, Math.min(props.layout.grid.rows - 1, row)),
  }
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
  const cx = seat.col * C + C / 2
  const cy = seat.row * C + C / 2
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
    <g stroke="#eef1f5" stroke-width="1">
      <line v-for="c in layout.grid.cols - 1" :key="'v' + c" :x1="c * C" y1="0" :x2="c * C" :y2="height" />
      <line v-for="r in layout.grid.rows - 1" :key="'h' + r" x1="0" :y1="r * C" :x2="width" :y2="r * C" />
    </g>

    <!-- 家具 -->
    <g v-for="f in layout.furniture" :key="f.id">
      <rect
        :x="f.col * C + 2" :y="f.row * C + 2"
        :width="f.w * C - 4" :height="f.h * C - 4"
        rx="6"
        :fill="f.kind === 'board' ? '#334155' : '#e2e8f0'"
        :stroke="selectedSet.has(f.id) ? '#2563eb' : '#cbd5e1'"
        :stroke-width="selectedSet.has(f.id) ? 3 : 1"
      />
      <text
        :x="f.col * C + (f.w * C) / 2" :y="f.row * C + (f.h * C) / 2 + 5"
        text-anchor="middle" :font-size="14"
        :fill="f.kind === 'board' ? '#fff' : '#475569'"
      >{{ kindDef(f.kind).emoji }} {{ kindDef(f.kind).label }}</text>
    </g>

    <!-- 座位 -->
    <g v-for="s in layout.seats" :key="s.id" :opacity="s.enabled ? 1 : 0.3">
      <rect
        :x="s.col * C + 3" :y="s.row * C + 3"
        :width="C - 6" :height="C - 6" rx="9"
        :fill="seatFill(s)"
        :stroke="selectedSet.has(s.id) ? '#2563eb' : '#b6c2d0'"
        :stroke-width="selectedSet.has(s.id) ? 3 : 1.5"
      />
      <!-- 朝向缺口 -->
      <rect
        :x="s.col * C + C / 2 - 7" :y="s.row * C + 2" width="14" height="5" rx="2.5"
        fill="#7c8b9d" :transform="notchTransform(s)"
      />
      <text v-if="!s.enabled" :x="s.col * C + C / 2" :y="s.row * C + C / 2 + 6" text-anchor="middle" font-size="17" fill="#94a3b8">✕</text>
      <text v-if="s.tags.length" :x="s.col * C + C - 10" :y="s.row * C + C - 8" text-anchor="middle" font-size="11">
        {{ s.tags.includes('accessible') ? '♿' : s.tags.includes('fixed_pc') ? '💻' : '🧪' }}
      </text>
      <slot name="seat-label" :seat="s" :cx="s.col * C + C / 2" :cy="s.row * C + C / 2" />
    </g>
  </svg>
</template>

<style scoped>
.seat-canvas { width: 100%; height: auto; display: block; border-radius: 10px; touch-action: none; user-select: none; }
.seat-canvas.interactive { cursor: pointer; }
</style>
