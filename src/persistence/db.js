// IndexedDB 持久化（idb-keyval）— 整個 workspace 存一把 key
import { get, set } from 'idb-keyval'
import { migrate } from '@/core/model/migrations.js'
import { createWorkspace } from '@/core/model/defaults.js'

const KEY = 'seating-workspace'

export async function loadWorkspace() {
  try {
    const raw = await get(KEY)
    return raw ? migrate(raw) : createWorkspace()
  } catch (e) {
    console.error('讀取資料失敗', e)
    return createWorkspace()
  }
}

export async function saveWorkspace(ws) {
  ws.updatedAt = Date.now()
  // Pinia state 含 reactive proxy，structuredClone 前先轉純物件
  await set(KEY, JSON.parse(JSON.stringify(ws)))
}

/** 匯出 .json 備份檔 */
export function exportBackup(ws) {
  const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `排座位備份-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackup(text) {
  const raw = JSON.parse(text)
  return migrate(raw)
}
