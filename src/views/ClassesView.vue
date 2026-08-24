<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import ImportWizard from '@/components/roster/ImportWizard.vue'

const store = useWorkspaceStore()
const router = useRouter()
const newName = ref('')
const showImport = ref(false)

function create() {
  const name = newName.value.trim()
  if (!name) return
  const cls = store.addClass(name)
  newName.value = ''
  router.push({ name: 'roster', params: { id: cls.id } })
}
function remove(cls) {
  if (confirm(`確定刪除「${cls.name}」？名單與座位表都會一併刪除。`)) {
    store.removeClass(cls.id)
  }
}
function onImported({ groups }) {
  const summary = store.importClassGroups(groups)
  showImport.value = false
  if (summary.created + summary.updated === 1 && summary.firstId) {
    router.push({ name: 'roster', params: { id: summary.firstId } })
  }
}
</script>

<template>
  <div>
    <div class="head">
      <h2>我的班級</h2>
      <div class="head-actions">
        <button @click="showImport = true">📥 匯入名單</button>
        <form class="create" @submit.prevent="create">
          <input v-model="newName" placeholder="班級名稱，例如：五年三班" />
          <button class="primary" type="submit">＋ 建立班級</button>
        </form>
      </div>
    </div>

    <p v-if="!store.classes.length" class="empty dim">
      還沒有班級。可以直接「匯入名單」— 含班級欄位的全學年名單會自動分班建立。
    </p>

    <div class="grid">
      <div v-for="cls in store.classes" :key="cls.id" class="panel card">
        <RouterLink :to="{ name: 'roster', params: { id: cls.id } }" class="card-main">
          <h3>{{ cls.name }}</h3>
          <p class="dim">{{ cls.students.length }} 位學生</p>
        </RouterLink>
        <button class="danger-ghost" @click="remove(cls)">刪除</button>
      </div>
    </div>

    <ImportWizard
      v-if="showImport"
      context="global"
      :has-existing="false"
      @close="showImport = false"
      @imported="onImported"
    />
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.create { display: flex; gap: 8px; }
.create input { width: 240px; }
.empty { padding: 48px 0; text-align: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.card { padding: 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.card-main { text-decoration: none; color: inherit; flex: 1; }
.card-main h3 { margin-bottom: 6px; }
.card-main p { margin: 0; font-size: 13px; }
.card button { font-size: 12.5px; padding: 4px 10px; }
</style>
