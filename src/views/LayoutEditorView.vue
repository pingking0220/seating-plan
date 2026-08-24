<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import SeatCanvas from '@/components/layout/SeatCanvas.vue'
import { createSeat, createFurniture, FURNITURE_KINDS, SEAT_TAGS } from '@/core/model/defaults.js'
import { computeSeatAttributes, DERIVED_TAG_LABELS } from '@/core/layout/seatAttributes.js'

const route = useRoute()
const store = useWorkspaceStore()
const layout = computed(() => store.layoutById(route.params.id))

const tool = ref('select')
const furnitureKind = ref('window')
const selected = ref([]) // ids（座位或家具）

const TOOLS = [
  { id: 'select', label: '🖱️ 選取/移動' },
  { id: 'seat', label: '🪑 加座位' },
  { id: 'furniture', label: '🚪 加家具' },
  { id: 'erase', label: '🧹 刪除' },
]

const selectedSeats = computed(() => layout.value.seats.filter((s) => selected.value.includes(s.id)))
const derived = computed(() => computeSeatAttributes(layout.value))

/* ---------- 畫布事件 ---------- */
function onSelect({ id, additive }) {
  if (additive) {
    selected.value = selected.value.includes(id)
      ? selected.value.filter((x) => x !== id)
      : [...selected.value, id]
  } else if (!selected.value.includes(id)) {
    selected.value = [id]
  }
}
function onClearSelect() {
  selected.value = []
}
function onAddAt({ col, row }) {
  if (tool.value === 'seat') {
    layout.value.seats.push(createSeat({ col, row }))
  } else {
    const f = createFurniture(furnitureKind.value, { col, row })
    f.col = Math.min(f.col, layout.value.grid.cols - f.w)
    f.row = Math.min(f.row, layout.value.grid.rows - f.h)
    layout.value.furniture.push(f)
  }
  store.touchLayout(layout.value)
}
function onErase({ type, id }) {
  if (type === 'seat') layout.value.seats = layout.value.seats.filter((s) => s.id !== id)
  else layout.value.furniture = layout.value.furniture.filter((f) => f.id !== id)
  selected.value = selected.value.filter((x) => x !== id)
  store.touchLayout(layout.value)
}

/* 拖曳搬移：記住起始位置，套用累積位移 */
let dragOrigin = null
function onDragStart() {
  dragOrigin = new Map()
  for (const s of layout.value.seats) if (selected.value.includes(s.id)) dragOrigin.set(s.id, { col: s.col, row: s.row })
  for (const f of layout.value.furniture) if (selected.value.includes(f.id)) dragOrigin.set(f.id, { col: f.col, row: f.row })
}
function onDragDelta({ dc, dr }) {
  if (!dragOrigin) return
  const g = layout.value.grid
  for (const s of layout.value.seats) {
    const o = dragOrigin.get(s.id)
    if (o) {
      s.col = Math.max(0, Math.min(g.cols - 1, o.col + dc))
      s.row = Math.max(0, Math.min(g.rows - 1, o.row + dr))
    }
  }
  for (const f of layout.value.furniture) {
    const o = dragOrigin.get(f.id)
    if (o) {
      f.col = Math.max(0, Math.min(g.cols - f.w, o.col + dc))
      f.row = Math.max(0, Math.min(g.rows - f.h, o.row + dr))
    }
  }
}
function onDragEnd({ moved }) {
  dragOrigin = null
  if (moved) store.touchLayout(layout.value)
}

/* ---------- 選取操作 ---------- */
function rotateSelected() {
  for (const s of selectedSeats.value) s.rotation = ((s.rotation || 0) + 90) % 360
  store.touchLayout(layout.value)
}
function groupSelected() {
  const nums = layout.value.seats.map((s) => Number((s.groupId || '').replace(/\D/g, '')) || 0)
  const next = 'g' + (Math.max(0, ...nums) + 1)
  for (const s of selectedSeats.value) s.groupId = next
  store.touchLayout(layout.value)
}
function ungroupSelected() {
  for (const s of selectedSeats.value) s.groupId = null
  store.touchLayout(layout.value)
}
function toggleTag(tagId) {
  const allHave = selectedSeats.value.every((s) => s.tags.includes(tagId))
  for (const s of selectedSeats.value) {
    if (allHave) s.tags = s.tags.filter((t) => t !== tagId)
    else if (!s.tags.includes(tagId)) s.tags.push(tagId)
  }
  store.touchLayout(layout.value)
}
function toggleEnabled() {
  const allOn = selectedSeats.value.every((s) => s.enabled)
  for (const s of selectedSeats.value) s.enabled = !allOn
  store.touchLayout(layout.value)
}
function deleteSelected() {
  layout.value.seats = layout.value.seats.filter((s) => !selected.value.includes(s.id))
  layout.value.furniture = layout.value.furniture.filter((f) => !selected.value.includes(f.id))
  selected.value = []
  store.touchLayout(layout.value)
}
function resizeGrid(axis, v) {
  const min = axis === 'cols'
    ? Math.max(4, ...layout.value.seats.map((s) => s.col + 1), ...layout.value.furniture.map((f) => f.col + f.w))
    : Math.max(4, ...layout.value.seats.map((s) => s.row + 1), ...layout.value.furniture.map((f) => f.row + f.h))
  layout.value.grid[axis] = Math.max(min, Math.min(30, v || min))
  store.touchLayout(layout.value)
}

const derivedOfSelection = computed(() => {
  if (selectedSeats.value.length !== 1) return []
  return derived.value.get(selectedSeats.value[0].id) || []
})
</script>

<template>
  <div v-if="layout">
    <div class="head">
      <div>
        <input class="name-input" v-model="layout.name" @change="store.touchLayout(layout)" />
        <p class="dim stats">{{ layout.seats.length }} 個座位（{{ layout.seats.filter((s) => s.enabled).length }} 可用）</p>
      </div>
      <RouterLink :to="{ name: 'layouts' }"><button>← 回佈局列表</button></RouterLink>
    </div>

    <div class="toolbar panel">
      <div class="tools">
        <button
          v-for="t in TOOLS" :key="t.id"
          :class="{ active: tool === t.id }"
          @click="tool = t.id"
        >{{ t.label }}</button>
        <select v-if="tool === 'furniture'" v-model="furnitureKind">
          <option v-for="k in FURNITURE_KINDS" :key="k.id" :value="k.id">{{ k.emoji }} {{ k.label }}</option>
        </select>
      </div>
      <div class="grid-size">
        <label>寬 <input type="number" min="4" max="30" :value="layout.grid.cols" @change="resizeGrid('cols', $event.target.valueAsNumber)" /></label>
        <label>高 <input type="number" min="4" max="30" :value="layout.grid.rows" @change="resizeGrid('rows', $event.target.valueAsNumber)" /></label>
      </div>
    </div>

    <div class="editor">
      <div class="canvas-wrap panel">
        <div class="front-label">▲ 前方（黑板）</div>
        <SeatCanvas
          :layout="layout"
          :selected="selected"
          :tool="tool"
          @select="onSelect"
          @clear-select="onClearSelect"
          @add-at="onAddAt"
          @erase="onErase"
          @drag-start="onDragStart"
          @drag-delta="onDragDelta"
          @drag-end="onDragEnd"
        />
      </div>

      <aside class="side panel">
        <template v-if="selected.length">
          <h4>已選 {{ selected.length }} 項</h4>
          <div class="side-actions" v-if="selectedSeats.length">
            <button @click="rotateSelected">🔄 旋轉 90°</button>
            <button @click="groupSelected">🎨 設為同組</button>
            <button @click="ungroupSelected">取消分組</button>
            <button @click="toggleEnabled">啟用/停用</button>
            <button
              v-for="t in SEAT_TAGS" :key="t.id"
              :class="{ tagged: selectedSeats.every((s) => s.tags.includes(t.id)) }"
              @click="toggleTag(t.id)"
            >{{ t.emoji }} {{ t.label }}</button>
          </div>
          <button class="danger-ghost" @click="deleteSelected">🗑️ 刪除所選</button>
          <div v-if="derivedOfSelection.length" class="derived">
            <p class="dim">自動判定屬性：</p>
            <span v-for="d in derivedOfSelection" :key="d" class="chip">{{ DERIVED_TAG_LABELS[d] }}</span>
          </div>
        </template>
        <template v-else>
          <h4>操作說明</h4>
          <ul class="help dim">
            <li>「選取」工具：點選座位／家具，拖曳搬移；Ctrl+點可多選</li>
            <li>「加座位」：點空格新增</li>
            <li>「加家具」：選種類後點空格放置（窗／門會影響座位屬性）</li>
            <li>選多個座位後可「設為同組」（分組會上色）</li>
            <li>座位邊上的小缺口是「面向」，旋轉可改</li>
          </ul>
        </template>
      </aside>
    </div>
  </div>
  <p v-else class="dim">找不到這個佈局。<RouterLink :to="{ name: 'layouts' }">回佈局列表</RouterLink></p>
</template>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.name-input { font-size: 22px; font-weight: 700; border-color: transparent; background: transparent; padding: 2px 6px; }
.name-input:hover { border-color: var(--border); }
.stats { margin: 4px 0 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; margin-bottom: 12px; flex-wrap: wrap; }
.tools { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.tools button.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.grid-size { display: flex; gap: 10px; }
.grid-size label { display: flex; align-items: center; gap: 6px; font-size: 13.5px; }
.grid-size input { width: 64px; }
.editor { display: grid; grid-template-columns: 1fr 250px; gap: 14px; align-items: start; }
.canvas-wrap { padding: 12px; }
.front-label { text-align: center; font-size: 12.5px; color: var(--text-dim); margin-bottom: 6px; letter-spacing: 2px; }
.side { padding: 14px; display: flex; flex-direction: column; gap: 10px; position: sticky; top: 12px; }
.side h4 { margin: 0; }
.side-actions { display: flex; flex-direction: column; gap: 6px; }
.side-actions button.tagged { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.derived .chip { margin: 2px 4px 0 0; }
.help { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
@media (max-width: 800px) { .editor { grid-template-columns: 1fr; } .side { position: static; } }
</style>
