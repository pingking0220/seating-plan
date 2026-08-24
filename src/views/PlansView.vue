<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.js'
import SeatCanvas from '@/components/layout/SeatCanvas.vue'
import { createPlan } from '@/core/seating/plan.js'

const store = useWorkspaceStore()
const router = useRouter()

const classId = ref('')
const layoutId = ref('')

const canCreate = computed(() => classId.value && layoutId.value)
const ready = computed(() => store.classes.length && store.layouts.length)

function create() {
  if (!canCreate.value) return
  const cls = store.classById(classId.value)
  const layout = store.layoutById(layoutId.value)
  const plan = createPlan({
    classId: classId.value,
    layoutId: layoutId.value,
    name: `${cls.name}座位表（${layout.name}）`,
  })
  store.addPlan(plan)
  router.push({ name: 'seating', params: { id: plan.id } })
}
function remove(p) {
  if (confirm(`確定刪除「${p.name}」？`)) store.removePlan(p.id)
}
function layoutOf(p) {
  return store.layoutById(p.layoutId)
}
function classOf(p) {
  return store.classById(p.classId)
}
</script>

<template>
  <div>
    <div class="head">
      <h2>座位表</h2>
      <form v-if="ready" class="create" @submit.prevent="create">
        <select v-model="classId">
          <option value="" disabled>選班級</option>
          <option v-for="c in store.classes" :key="c.id" :value="c.id">{{ c.name }}（{{ c.students.length }}人）</option>
        </select>
        <select v-model="layoutId">
          <option value="" disabled>選教室佈局</option>
          <option v-for="l in store.layouts" :key="l.id" :value="l.id">{{ l.name }}（{{ l.seats.filter((s) => s.enabled).length }}座）</option>
        </select>
        <button class="primary" type="submit" :disabled="!canCreate">＋ 建立座位表</button>
      </form>
    </div>

    <p v-if="!ready" class="empty dim">
      建立座位表需要先有<RouterLink to="/">班級名單</RouterLink>和<RouterLink to="/layouts">教室佈局</RouterLink>。
    </p>
    <p v-else-if="!store.plans.length" class="empty dim">
      還沒有座位表。選一個班級和一種教室佈局開始編排。
    </p>

    <div class="grid">
      <div v-for="p in store.plans" :key="p.id" class="panel card">
        <RouterLink v-if="layoutOf(p)" :to="{ name: 'seating', params: { id: p.id } }" class="thumb">
          <SeatCanvas :layout="layoutOf(p)" :interactive="false" />
        </RouterLink>
        <div class="meta">
          <strong>{{ p.name }}</strong>
          <span class="dim">{{ classOf(p)?.name }}・已排 {{ p.assignments.length }} 人</span>
        </div>
        <div class="ops">
          <RouterLink :to="{ name: 'seating', params: { id: p.id } }"><button>編排</button></RouterLink>
          <button class="danger-ghost" @click="remove(p)">刪除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.create { display: flex; gap: 8px; flex-wrap: wrap; }
.empty { padding: 48px 0; text-align: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.card { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.thumb { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.meta { display: flex; flex-direction: column; gap: 2px; }
.meta .dim { font-size: 12.5px; }
.ops { display: flex; gap: 6px; }
.ops button { font-size: 12.5px; padding: 4px 10px; }
</style>
