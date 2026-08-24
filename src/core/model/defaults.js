// 資料模型工廠與預設值 — 純函式，不依賴 Vue / 瀏覽器 API
export const SCHEMA_VERSION = 2

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

/** 學生個別需求標籤的內建選項（可自訂擴充） */
export const TRAIT_PRESETS = [
  { id: 'need_front', label: '需前排（視力/聽力）' },
  { id: 'near_teacher', label: '需靠近教師' },
  { id: 'wheelchair', label: '輪椅/行動不便' },
  { id: 'easily_distracted', label: '易分心（遠離門窗）' },
  { id: 'left_handed', label: '左撇子' },
  { id: 'emotional_buffer', label: '需緩衝空間' },
]

export function traitLabel(id, customTraits = []) {
  const preset = TRAIT_PRESETS.find((t) => t.id === id)
  if (preset) return preset.label
  const custom = customTraits.find((t) => t.id === id)
  return custom ? custom.label : id
}

export function createStudent(partial = {}) {
  return {
    id: uid(),
    seatNo: null, // 座號（數字）
    name: '',
    gender: '', // 'M' | 'F' | ''
    height: null, // 公分，選填
    traits: [], // trait id 陣列
    note: '',
    active: true, // 轉出學生設 false 保留紀錄
    ...partial,
  }
}

export function createClass(partial = {}) {
  return {
    id: uid(),
    name: '',
    year: '', // 學年度，例如 '114'
    students: [],
    relations: [], // { a, b, type, weight }
    customTraits: [], // 自訂標籤 { id, label }
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  }
}

export function createWorkspace(partial = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    classes: [],
    layouts: [],
    plans: [],
    history: {}, // { [classId]: [{ date, planId, layoutId, seatOf, neighborsOf }] }
    settings: { lastBackupAt: null },
    updatedAt: Date.now(),
    ...partial,
  }
}

/* ---------- 教室佈局 ---------- */

export const FURNITURE_KINDS = [
  { id: 'board', label: '黑板', emoji: '⬛', w: 5, h: 1 },
  { id: 'podium', label: '講台', emoji: '🎤', w: 2, h: 1 },
  { id: 'door', label: '門', emoji: '🚪', w: 1, h: 1 },
  { id: 'window', label: '窗', emoji: '🪟', w: 1, h: 1 },
  { id: 'cabinet', label: '櫃子', emoji: '🗄️', w: 2, h: 1 },
  { id: 'sink', label: '洗手台', emoji: '🚰', w: 1, h: 1 },
  { id: 'screen', label: '螢幕', emoji: '📺', w: 2, h: 1 },
]

/** 手動座位標籤（自動推導的 window/door/front_row/aisle 不在此列） */
export const SEAT_TAGS = [
  { id: 'accessible', label: '無障礙', emoji: '♿' },
  { id: 'fixed_pc', label: '固定電腦', emoji: '💻' },
  { id: 'lab_bench', label: '實驗桌', emoji: '🧪' },
]

export const GROUP_COLORS = [
  '#bfdbfe', '#bbf7d0', '#fde68a', '#fecaca', '#ddd6fe',
  '#fbcfe8', '#a5f3fc', '#fed7aa', '#d9f99d', '#e9d5ff',
]

export function groupColor(groupId, layout) {
  if (!groupId) return null
  const ids = [...new Set(layout.seats.map((s) => s.groupId).filter(Boolean))].sort()
  return GROUP_COLORS[ids.indexOf(groupId) % GROUP_COLORS.length]
}

export function createSeat(partial = {}) {
  return { id: uid(), col: 0, row: 0, rotation: 0, groupId: null, tags: [], enabled: true, ...partial }
}

export function createFurniture(kind, partial = {}) {
  const def = FURNITURE_KINDS.find((k) => k.id === kind) || { w: 1, h: 1 }
  return { id: uid(), kind, col: 0, row: 0, w: def.w, h: def.h, ...partial }
}

export function createLayout(partial = {}) {
  return {
    id: uid(),
    name: '',
    kind: 'custom', // 來源範本 id，僅供參考
    grid: { cols: 15, rows: 11 },
    front: 'top', // 前方（黑板）方向
    seats: [],
    furniture: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  }
}
