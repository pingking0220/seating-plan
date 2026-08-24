<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import ImportWizard from '@/components/roster/ImportWizard.vue'
import StudentTable from '@/components/roster/StudentTable.vue'
import { RELATION_TYPES } from '@/core/rules/registry.js'

const route = useRoute()
const store = useWorkspaceStore()
const cls = computed(() => store.classById(route.params.id))
const showImport = ref(false)

function onImported({ students, mode }) {
  store.importStudents(cls.value.id, students, mode)
  showImport.value = false
}
const stats = computed(() => {
  const s = cls.value?.students ?? []
  const m = s.filter((x) => x.gender === 'M').length
  const f = s.filter((x) => x.gender === 'F').length
  return `${s.length} 人（男 ${m}・女 ${f}）`
})

/* ---------- 人際關係 ---------- */
const relA = ref('')
const relB = ref('')
const relType = ref('forbid_adjacent')
const nameOf = (id) => cls.value.students.find((s) => s.id === id)?.name || '?'
const typeLabel = (t) => RELATION_TYPES.find((x) => x.id === t)?.label || t
function addRel() {
  store.addRelation(cls.value.id, relA.value, relB.value, relType.value)
  relA.value = ''
  relB.value = ''
}
</script>

<template>
  <div v-if="cls">
    <div class="head">
      <div>
        <h2>
          <input class="name-input" v-model="cls.name" @change="store.touch(cls)" />
        </h2>
        <p class="dim" style="margin: 4px 0 0">{{ stats }}</p>
      </div>
      <div class="actions">
        <button @click="store.addStudent(cls.id)">＋ 新增學生</button>
        <button class="primary" @click="showImport = true">📥 匯入名單</button>
      </div>
    </div>

    <p v-if="!cls.students.length" class="empty dim">
      名單是空的 — 按「匯入名單」把 Excel 名單貼上來，或手動新增學生。
    </p>
    <template v-else>
      <StudentTable :cls="cls" />

      <div class="panel relations">
        <h3>人際關係設定</h3>
        <p class="dim">自動排位會參考這裡：衝突的分開坐、互助的坐一起。</p>
        <form class="rel-form" @submit.prevent="addRel">
          <select v-model="relA">
            <option value="" disabled>選學生</option>
            <option v-for="s in cls.students" :key="s.id" :value="s.id">{{ s.seatNo }} {{ s.name }}</option>
          </select>
          <select v-model="relType">
            <option v-for="t in RELATION_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
          <select v-model="relB">
            <option value="" disabled>選學生</option>
            <option v-for="s in cls.students" :key="s.id" :value="s.id" :disabled="s.id === relA">{{ s.seatNo }} {{ s.name }}</option>
          </select>
          <button class="primary" type="submit" :disabled="!relA || !relB || relA === relB">加入</button>
        </form>
        <div class="rel-list">
          <span v-for="r in cls.relations" :key="r.id" class="chip rel-chip" :class="r.type.startsWith('forbid') ? 'forbid' : 'prefer'">
            {{ nameOf(r.a) }}〔{{ typeLabel(r.type) }}〕{{ nameOf(r.b) }}
            <button class="x" @click="store.removeRelation(cls.id, r.id)">✕</button>
          </span>
          <span v-if="!cls.relations?.length" class="dim" style="font-size: 13px">尚未設定</span>
        </div>
      </div>
    </template>

    <ImportWizard
      v-if="showImport"
      :has-existing="cls.students.length > 0"
      @close="showImport = false"
      @imported="onImported"
    />
  </div>
  <p v-else class="dim">找不到這個班級。<RouterLink to="/">回班級列表</RouterLink></p>
</template>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.name-input {
  font-size: 22px; font-weight: 700; border-color: transparent; background: transparent; padding: 2px 6px;
}
.name-input:hover { border-color: var(--border); }
.actions { display: flex; gap: 8px; }
.empty { padding: 48px 0; text-align: center; }
.relations { margin-top: 16px; padding: 16px 18px; }
.relations h3 { margin: 0 0 4px; font-size: 16px; }
.relations > p { margin: 0 0 12px; font-size: 13px; }
.rel-form { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.rel-list { display: flex; flex-wrap: wrap; gap: 8px; }
.rel-chip { font-size: 13px; padding: 4px 10px; }
.rel-chip.forbid { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.rel-chip.prefer { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
.rel-chip .x { border: none; background: none; padding: 0 0 0 4px; font-size: 12px; color: inherit; cursor: pointer; }
</style>
