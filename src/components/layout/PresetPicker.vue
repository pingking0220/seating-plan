<script setup>
import { computed, ref } from 'vue'
import { PRESETS } from '@/core/layout/presets.js'
import { generateSeats, requiredGrid, PATTERNS } from '@/core/layout/generator.js'
import { createLayout } from '@/core/model/defaults.js'
import SeatCanvas from './SeatCanvas.vue'

const emit = defineEmits(['close', 'choose'])
const tab = ref('preset')

// 每個範本先 build 一次當縮圖
const previews = computed(() => PRESETS.map((p) => ({ ...p, layout: p.build() })))

// 快速產生器
const gen = ref({ pattern: 'pair', groupsPerRow: 3, rows: 5, hGap: 1, vGap: 0 })
const genLayout = computed(() => {
  try {
    const grid = requiredGrid({ ...gen.value, startCol: 1, startRow: 2 })
    return createLayout({
      name: '自訂排列',
      kind: 'generated',
      grid: { cols: Math.max(grid.cols, 8), rows: Math.max(grid.rows, 6) },
      seats: generateSeats({ ...gen.value, startCol: 1, startRow: 2 }),
      furniture: [],
    })
  } catch {
    return null
  }
})

function choosePreset(p) {
  emit('choose', p.build())
}
function chooseGenerated() {
  if (genLayout.value) emit('choose', JSON.parse(JSON.stringify(genLayout.value)))
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <div class="tabs">
        <button :class="{ active: tab === 'preset' }" @click="tab = 'preset'">📚 範本庫</button>
        <button :class="{ active: tab === 'gen' }" @click="tab = 'gen'">⚙️ 快速產生</button>
      </div>

      <div v-if="tab === 'preset'" class="preset-grid">
        <button v-for="p in previews" :key="p.id" class="preset-card panel" @click="choosePreset(p)">
          <SeatCanvas :layout="p.layout" :interactive="false" />
          <strong>{{ p.name }}</strong>
          <span class="dim">{{ p.description }}</span>
        </button>
      </div>

      <div v-else class="gen">
        <div class="gen-form">
          <label>排列模式
            <select v-model="gen.pattern">
              <option v-for="(v, k) in PATTERNS" :key="k" :value="k">{{ v.label }}</option>
            </select>
          </label>
          <label>每排幾組 <input type="number" min="1" max="10" v-model.number="gen.groupsPerRow" /></label>
          <label>幾排 <input type="number" min="1" max="10" v-model.number="gen.rows" /></label>
          <label>水平走道格數 <input type="number" min="0" max="4" v-model.number="gen.hGap" /></label>
          <label>垂直間隔格數 <input type="number" min="0" max="4" v-model.number="gen.vGap" /></label>
          <p class="dim">共 {{ genLayout ? genLayout.seats.length : 0 }} 個座位（產生後還能自由微調、加家具）</p>
          <button class="primary" @click="chooseGenerated">用這個排列建立佈局</button>
        </div>
        <div class="gen-preview panel" v-if="genLayout">
          <SeatCanvas :layout="genLayout" :interactive="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.preset-card { padding: 10px; display: flex; flex-direction: column; gap: 6px; text-align: left; cursor: pointer; }
.preset-card:hover { border-color: var(--primary); }
.preset-card .dim { font-size: 12.5px; }
.gen { display: grid; grid-template-columns: 260px 1fr; gap: 18px; }
.gen-form { display: flex; flex-direction: column; gap: 10px; }
.gen-form label { display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; }
.gen-preview { padding: 10px; align-self: start; }
@media (max-width: 700px) { .gen { grid-template-columns: 1fr; } }
</style>
