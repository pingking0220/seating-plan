import { SCHEMA_VERSION, createWorkspace } from './defaults.js'

/** 依 schemaVersion 逐版升級舊資料；index = 從第幾版升到下一版 */
const steps = {
  // v1 -> v2：新增輪替歷史與備份時間戳
  1: (ws) => {
    ws.history = ws.history || {}
    ws.settings = ws.settings || {}
    if (ws.settings.lastBackupAt === undefined) ws.settings.lastBackupAt = null
    for (const cls of ws.classes || []) {
      cls.relations = cls.relations || []
      cls.customTraits = cls.customTraits || []
    }
    ws.schemaVersion = 2
    return ws
  },
}

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return createWorkspace()
  let ws = raw
  let version = ws.schemaVersion || 1
  while (version < SCHEMA_VERSION) {
    const step = steps[version]
    if (!step) break
    ws = step(ws)
    version = ws.schemaVersion
  }
  ws.schemaVersion = SCHEMA_VERSION
  return ws
}
