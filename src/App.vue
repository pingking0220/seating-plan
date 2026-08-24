<script setup>
import { computed, onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace.js'
import { exportBackup, parseBackup } from '@/persistence/db.js'

const store = useWorkspaceStore()
onMounted(() => store.init())

function backup() {
  exportBackup(JSON.parse(JSON.stringify(store.ws)))
  store.markBackedUp()
}

async function restore(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!confirm(`用「${file.name}」還原？目前瀏覽器裡的所有資料會被備份檔的內容取代。`)) {
    e.target.value = ''
    return
  }
  try {
    const ws = parseBackup(await file.text())
    store.replaceWorkspace(ws)
    alert('還原完成！')
  } catch (err) {
    alert('還原失敗：不是有效的備份檔（' + err.message + '）')
  }
  e.target.value = ''
}

const hasData = computed(
  () => store.ws.classes.length || store.ws.layouts.length || store.ws.plans.length,
)
const needBackup = computed(() => {
  if (!store.loaded || !hasData.value) return false
  const last = store.ws.settings?.lastBackupAt
  return !last || Date.now() - last > 14 * 24 * 60 * 60 * 1000
})
</script>

<template>
  <div class="shell">
    <header class="topbar no-print">
      <RouterLink to="/" class="brand">🪑 排座位系統</RouterLink>
      <nav class="nav">
        <RouterLink to="/">班級</RouterLink>
        <RouterLink to="/layouts">教室佈局</RouterLink>
        <RouterLink to="/plans">座位表</RouterLink>
      </nav>
      <span class="privacy dim">所有資料只存在這台電腦的瀏覽器，不會上傳任何伺服器</span>
      <label class="restore-btn" title="從 .json 備份檔還原">
        📂 還原<input type="file" accept=".json" hidden @change="restore" />
      </label>
      <button @click="backup">💾 備份資料</button>
    </header>

    <div v-if="needBackup" class="backup-banner no-print">
      ⏰ 資料有一段時間沒備份了 — 瀏覽器清除快取會讓資料消失，建議
      <button class="inline-btn" @click="backup">立即備份</button>
    </div>

    <main class="content">
      <RouterView v-if="store.loaded" />
      <p v-else class="dim" style="padding: 40px">載入中…</p>
    </main>
  </div>
</template>

<style scoped>
.shell { max-width: 1080px; margin: 0 auto; padding: 0 20px 60px; }
.topbar {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 0; margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.brand {
  font-size: 19px; font-weight: 700;
  color: var(--text); text-decoration: none;
}
.nav { display: flex; gap: 4px; }
.nav a { text-decoration: none; color: var(--text-dim); padding: 5px 12px; border-radius: 8px; font-size: 14.5px; }
.nav a.router-link-active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.privacy { flex: 1; font-size: 12.5px; }
.restore-btn {
  border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px;
  cursor: pointer; background: var(--panel); font-size: 14px;
}
.restore-btn:hover { background: #f0f4f8; }
.backup-banner {
  background: var(--warn-bg); color: var(--warn-text);
  border-radius: 10px; padding: 9px 16px; margin-bottom: 16px; font-size: 13.5px;
}
.inline-btn {
  border: none; background: none; padding: 0; font-size: 13.5px;
  color: var(--primary); text-decoration: underline; cursor: pointer;
}
</style>
