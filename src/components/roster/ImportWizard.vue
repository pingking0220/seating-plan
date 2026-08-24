<script setup>
import { computed, ref } from 'vue'
import {
  FIELDS, parseClipboard, parseWorkbook, guessMapping,
  buildStudents, splitByClass, stripClassName,
} from '@/core/io/excelImport.js'

// context: 'class' = 匯入單一班級（RosterView）| 'global' = 整份名單拆多班（ClassesView）
const props = defineProps({
  hasExisting: Boolean,
  context: { type: String, default: 'class' },
})
const emit = defineEmits(['close', 'imported'])

const step = ref(1)
const rows = ref([])
const mapping = ref([])
const hasHeader = ref(false)
const pasteText = ref('')
const mode = ref('replace')
const fileError = ref('')
const pickedClass = ref('') // class context 下選擇要匯入哪個班級

function applyRows(r) {
  if (!r.length) { fileError.value = '沒有讀到任何資料'; return }
  rows.value = r
  const guess = guessMapping(r)
  mapping.value = guess.mapping
  hasHeader.value = guess.hasHeader
  step.value = 2
  fileError.value = ''
  pickedClass.value = ''
}

function fromPaste() {
  applyRows(parseClipboard(pasteText.value))
}

async function fromFile(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const buf = await file.arrayBuffer()
    applyRows(parseWorkbook(buf))
  } catch (err) {
    console.error(err)
    fileError.value = '檔案讀取失敗，請確認是 .xlsx 或 .csv 格式'
  }
  e.target.value = ''
}

const result = computed(() =>
  step.value === 2 ? buildStudents(rows.value, mapping.value, { hasHeader: hasHeader.value }) : { students: [], errors: [] },
)
const hasClassCol = computed(() => mapping.value.includes('className'))
const groups = computed(() => (hasClassCol.value ? splitByClass(result.value.students) : []))
const previewRows = computed(() => rows.value.slice(0, 8))
const colCount = computed(() => Math.max(0, ...rows.value.map((r) => r.length)))

/** class context 下實際要匯入的學生 */
const pickedStudents = computed(() => {
  if (!hasClassCol.value) return result.value.students
  const name = pickedClass.value || groups.value[0]?.className
  return groups.value.find((g) => g.className === name)?.students ?? []
})

function doImport() {
  if (props.context === 'global') {
    emit('imported', { groups: hasClassCol.value ? groups.value : [{ className: null, students: stripClassName(result.value.students) }], mode: mode.value })
  } else {
    emit('imported', { students: stripClassName(pickedStudents.value), mode: mode.value })
  }
}

const importCount = computed(() =>
  props.context === 'global' ? result.value.students.length : pickedStudents.value.length,
)
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <h3 style="margin-bottom: 16px">匯入名單</h3>

      <template v-if="step === 1">
        <div class="sources">
          <div class="source panel">
            <h4>📋 從 Excel 複製貼上</h4>
            <p class="dim">在 Excel 選取名單範圍（含或不含標題列皆可）→ Ctrl+C → 貼到下面</p>
            <textarea v-model="pasteText" rows="8" placeholder="在這裡貼上…"></textarea>
            <button class="primary" :disabled="!pasteText.trim()" @click="fromPaste">下一步：預覽</button>
          </div>
          <div class="source panel">
            <h4>📄 選擇檔案</h4>
            <p class="dim">支援 .xlsx / .csv，讀取第一個工作表</p>
            <input type="file" accept=".xlsx,.xls,.csv" @change="fromFile" />
            <p v-if="fileError" class="err">{{ fileError }}</p>
          </div>
        </div>
        <p class="dim hint">名單可以包含「班級」欄位 — 一份全學年名單也能一次匯入、自動分班。</p>
      </template>

      <template v-else>
        <p class="dim">確認每一欄對應的內容（已自動猜測，可修改）：</p>
        <label class="header-toggle">
          <input type="checkbox" v-model="hasHeader" /> 第一列是標題列（不匯入）
        </label>
        <div class="preview-wrap">
          <table class="preview">
            <thead>
              <tr>
                <th v-for="i in colCount" :key="i">
                  <select v-model="mapping[i - 1]">
                    <option v-for="f in FIELDS" :key="f.key" :value="f.key">{{ f.label }}</option>
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in previewRows" :key="ri" :class="{ header: hasHeader && ri === 0 }">
                <td v-for="i in colCount" :key="i">{{ row[i - 1] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="rows.length > 8" class="dim" style="font-size: 12.5px">…共 {{ rows.length }} 列</p>

        <!-- 偵測到班級欄位 -->
        <div v-if="hasClassCol && context === 'global'" class="class-info">
          將匯入 <strong>{{ groups.length }}</strong> 個班級：
          <span v-for="g in groups" :key="g.className" class="chip">{{ g.className }}（{{ g.students.length }} 人）</span>
        </div>
        <div v-else-if="hasClassCol && context === 'class'" class="class-info">
          偵測到班級欄位，要匯入哪個班級的學生？
          <select v-model="pickedClass">
            <option v-for="g in groups" :key="g.className" :value="g.className">
              {{ g.className }}（{{ g.students.length }} 人）
            </option>
          </select>
        </div>

        <div v-if="result.errors.length" class="errors">
          <p><strong>⚠ {{ result.errors.length }} 個問題：</strong></p>
          <ul>
            <li v-for="(e, i) in result.errors.slice(0, 6)" :key="i">第 {{ e.row }} 列：{{ e.message }}</li>
            <li v-if="result.errors.length > 6">…還有 {{ result.errors.length - 6 }} 個</li>
          </ul>
        </div>

        <div v-if="hasExisting" class="mode">
          <label><input type="radio" v-model="mode" value="replace" /> 取代目前名單</label>
          <label><input type="radio" v-model="mode" value="append" /> 附加到目前名單後面</label>
        </div>

        <div class="actions">
          <button @click="step = 1">← 上一步</button>
          <button class="primary" :disabled="!importCount" @click="doImport">
            <template v-if="context === 'global' && hasClassCol">
              匯入 {{ groups.length }} 個班級（共 {{ importCount }} 人）
            </template>
            <template v-else>匯入 {{ importCount }} 位學生</template>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sources { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.source { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.source h4 { margin: 0; }
.source p { margin: 0; font-size: 13px; }
.source textarea { resize: vertical; font-size: 13px; }
.err { color: var(--danger); font-size: 13px; }
.hint { margin: 12px 0 0; font-size: 13px; }
.header-toggle { display: block; margin: 10px 0; }
.preview-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.preview { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.preview th, .preview td { border-bottom: 1px solid var(--border); padding: 6px 10px; text-align: left; white-space: nowrap; }
.preview th { background: #f8fafc; }
.preview tr.header td { color: var(--text-dim); text-decoration: line-through; }
.class-info { margin-top: 12px; font-size: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.errors { background: var(--warn-bg); color: var(--warn-text); border-radius: 8px; padding: 10px 14px; margin-top: 12px; font-size: 13.5px; }
.errors p, .errors ul { margin: 0; }
.errors ul { padding-left: 18px; }
.mode { display: flex; gap: 20px; margin-top: 14px; }
.actions { display: flex; justify-content: space-between; margin-top: 18px; }
@media (max-width: 640px) { .sources { grid-template-columns: 1fr; } }
</style>
