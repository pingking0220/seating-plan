<script setup>
import { ref } from 'vue'
import { TRAIT_PRESETS, traitLabel } from '@/core/model/defaults.js'
import { useWorkspaceStore } from '@/stores/workspace.js'

const props = defineProps({ cls: { type: Object, required: true } })
const store = useWorkspaceStore()

const editingTraits = ref(null) // student id
const newTraitLabel = ref('')

function allTraits() {
  return [...TRAIT_PRESETS, ...props.cls.customTraits]
}
function toggleTraitPanel(stu) {
  editingTraits.value = editingTraits.value === stu.id ? null : stu.id
}
function addCustom(stu) {
  const t = store.addCustomTrait(props.cls.id, newTraitLabel.value)
  if (t) {
    store.toggleTrait(props.cls.id, stu.id, t.id)
    newTraitLabel.value = ''
  }
}
function remove(stu) {
  if (confirm(`確定移除 ${stu.name || '這位學生'}？`)) store.removeStudent(props.cls.id, stu.id)
}
function changed() {
  store.touch(props.cls)
}
</script>

<template>
  <div class="panel table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width: 70px">座號</th>
          <th style="width: 140px">姓名</th>
          <th style="width: 90px">性別</th>
          <th style="width: 90px">身高</th>
          <th>需求標籤</th>
          <th style="width: 180px">備註</th>
          <th style="width: 60px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stu in cls.students" :key="stu.id">
          <td><input class="cell num" type="number" v-model.number="stu.seatNo" @change="changed" /></td>
          <td><input class="cell" v-model="stu.name" @change="changed" /></td>
          <td>
            <select class="cell" v-model="stu.gender" @change="changed">
              <option value="">—</option>
              <option value="M">男</option>
              <option value="F">女</option>
            </select>
          </td>
          <td><input class="cell num" type="number" v-model.number="stu.height" placeholder="cm" @change="changed" /></td>
          <td class="traits-cell">
            <span v-for="t in stu.traits" :key="t" class="chip" @click="store.toggleTrait(cls.id, stu.id, t)" title="點一下移除">
              {{ traitLabel(t, cls.customTraits) }} ✕
            </span>
            <button class="add-trait" @click="toggleTraitPanel(stu)">＋標籤</button>
            <div v-if="editingTraits === stu.id" class="trait-panel panel">
              <label v-for="t in allTraits()" :key="t.id" class="trait-opt">
                <input
                  type="checkbox"
                  :checked="stu.traits.includes(t.id)"
                  @change="store.toggleTrait(cls.id, stu.id, t.id)"
                />
                {{ t.label }}
              </label>
              <form class="custom" @submit.prevent="addCustom(stu)">
                <input v-model="newTraitLabel" placeholder="自訂標籤…" />
                <button type="submit">加入</button>
              </form>
            </div>
          </td>
          <td><input class="cell" v-model="stu.note" @change="changed" /></td>
          <td><button class="danger-ghost small" @click="remove(stu)">✕</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { border-bottom: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f8fafc; font-weight: 600; font-size: 13px; color: var(--text-dim); }
.cell { width: 100%; border-color: transparent; background: transparent; padding: 5px 7px; }
.cell:hover { border-color: var(--border); background: #fff; }
.cell:focus { background: #fff; }
.num { text-align: center; }
.traits-cell { position: relative; }
.chip { cursor: pointer; margin: 2px 3px 2px 0; }
.add-trait { font-size: 12px; padding: 2px 8px; border-style: dashed; color: var(--text-dim); }
.trait-panel {
  position: absolute; z-index: 10; top: 100%; left: 0;
  padding: 10px 14px; min-width: 240px;
  display: flex; flex-direction: column; gap: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.trait-opt { display: flex; gap: 7px; align-items: center; font-size: 13.5px; }
.custom { display: flex; gap: 6px; margin-top: 6px; }
.custom input { flex: 1; padding: 4px 8px; font-size: 13px; }
.custom button { font-size: 12.5px; padding: 4px 10px; }
.small { font-size: 12px; padding: 3px 8px; }
</style>
