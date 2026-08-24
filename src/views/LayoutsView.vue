<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import PresetPicker from '@/components/layout/PresetPicker.vue'
import SeatCanvas from '@/components/layout/SeatCanvas.vue'
import { createLayout } from '@/core/model/defaults.js'
import { encodeLayoutShare, decodeLayoutShare } from '@/core/io/shareCodec.js'

const store = useWorkspaceStore()
const router = useRouter()
const showPicker = ref(false)
const shareCode = ref(null) // { name, code }
const importCode = ref('')
const showCodeImport = ref(false)

function openShare(l) {
  shareCode.value = { name: l.name, code: encodeLayoutShare(l) }
}
async function copyShare() {
  try {
    await navigator.clipboard.writeText(shareCode.value.code)
    shareCode.value = { ...shareCode.value, copied: true }
  } catch { /* 使用者手動複製 */ }
}
function importFromCode() {
  try {
    const raw = decodeLayoutShare(importCode.value)
    const fresh = createLayout({ ...raw, id: undefined })
    delete fresh.id
    store.addLayout(createLayout({ ...fresh }))
    importCode.value = ''
    showCodeImport.value = false
  } catch (e) {
    alert('匯入失敗：' + e.message)
  }
}

function onChoose(layout) {
  store.addLayout(layout)
  showPicker.value = false
  router.push({ name: 'layout-editor', params: { id: layout.id } })
}
function remove(l) {
  if (confirm(`確定刪除佈局「${l.name}」？`)) store.removeLayout(l.id)
}
function duplicate(l) {
  store.duplicateLayout(l.id)
}
function exportLayout(l) {
  const blob = new Blob([JSON.stringify(l, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${l.name || '教室佈局'}.layout.json`
  a.click()
  URL.revokeObjectURL(url)
}
async function importLayout(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const raw = JSON.parse(await file.text())
    if (!raw.grid || !Array.isArray(raw.seats)) throw new Error('格式不符')
    const layout = createLayout({ ...raw, id: undefined, name: raw.name || file.name.replace(/\.layout\.json$/, '') })
    delete layout.id
    const fresh = createLayout({ ...layout })
    store.addLayout(fresh)
  } catch (err) {
    alert('匯入失敗：不是有效的佈局檔（' + err.message + '）')
  }
  e.target.value = ''
}
</script>

<template>
  <div>
    <div class="head">
      <h2>教室佈局</h2>
      <div class="actions">
        <label class="import-btn">
          📂 匯入佈局檔<input type="file" accept=".json" @change="importLayout" hidden />
        </label>
        <button @click="showCodeImport = true">🔑 貼分享碼</button>
        <button class="primary" @click="showPicker = true">＋ 新增佈局</button>
      </div>
    </div>

    <p v-if="!store.layouts.length" class="empty dim">
      還沒有教室佈局。從範本庫挑一個（排排坐、島型、ㄇ字型、電腦教室…），再依實際教室微調。
    </p>

    <div class="grid">
      <div v-for="l in store.layouts" :key="l.id" class="panel card">
        <RouterLink :to="{ name: 'layout-editor', params: { id: l.id } }" class="thumb">
          <SeatCanvas :layout="l" :interactive="false" />
        </RouterLink>
        <div class="meta">
          <strong>{{ l.name }}</strong>
          <span class="dim">{{ l.seats.length }} 座</span>
        </div>
        <div class="ops">
          <RouterLink :to="{ name: 'layout-editor', params: { id: l.id } }"><button>編輯</button></RouterLink>
          <button @click="duplicate(l)">複製</button>
          <button @click="exportLayout(l)">匯出</button>
          <button @click="openShare(l)">分享碼</button>
          <button class="danger-ghost" @click="remove(l)">刪除</button>
        </div>
      </div>
    </div>

    <PresetPicker v-if="showPicker" @close="showPicker = false" @choose="onChoose" />

    <div v-if="shareCode" class="modal-mask" @click.self="shareCode = null">
      <div class="modal share-modal">
        <h3>分享「{{ shareCode.name }}」</h3>
        <p class="dim">把這串分享碼傳給其他老師（LINE、Email 都行），對方按「貼分享碼」就能匯入。資料不經任何伺服器。</p>
        <textarea readonly rows="5" :value="shareCode.code" @focus="$event.target.select()"></textarea>
        <div style="text-align: right; margin-top: 10px">
          <button class="primary" @click="copyShare">{{ shareCode.copied ? '已複製 ✓' : '📋 複製' }}</button>
          <button @click="shareCode = null" style="margin-left: 8px">關閉</button>
        </div>
      </div>
    </div>

    <div v-if="showCodeImport" class="modal-mask" @click.self="showCodeImport = false">
      <div class="modal share-modal">
        <h3>用分享碼匯入佈局</h3>
        <textarea v-model="importCode" rows="5" placeholder="貼上 SEAT1. 開頭的分享碼…"></textarea>
        <div style="text-align: right; margin-top: 10px">
          <button class="primary" :disabled="!importCode.trim()" @click="importFromCode">匯入</button>
          <button @click="showCodeImport = false" style="margin-left: 8px">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; align-items: center; }
.import-btn { border: 1px solid var(--border); border-radius: 8px; padding: 7px 14px; cursor: pointer; background: var(--panel); font-size: 15px; }
.import-btn:hover { background: #f0f4f8; }
.empty { padding: 48px 0; text-align: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.card { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.thumb { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.meta { display: flex; justify-content: space-between; align-items: baseline; }
.ops { display: flex; gap: 6px; }
.ops button { font-size: 12.5px; padding: 4px 10px; }
.share-modal textarea { width: 100%; font-size: 12px; font-family: monospace; word-break: break-all; }
</style>
