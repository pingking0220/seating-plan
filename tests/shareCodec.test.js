import { describe, it, expect } from 'vitest'
import { encodeLayoutShare, decodeLayoutShare } from '../src/core/io/shareCodec.js'
import { buildPreset } from '../src/core/layout/presets.js'
import { migrate } from '../src/core/model/migrations.js'
import { SCHEMA_VERSION } from '../src/core/model/defaults.js'

describe('shareCodec', () => {
  it('編碼解碼往返一致', () => {
    const layout = buildPreset('island4')
    const code = encodeLayoutShare(layout)
    expect(code.startsWith('SEAT1.')).toBe(true)
    const decoded = decodeLayoutShare(code)
    expect(decoded.name).toBe(layout.name)
    expect(decoded.seats).toHaveLength(layout.seats.length)
    expect(decoded.grid).toEqual(layout.grid)
  })
  it('分享碼比原始 JSON 短', () => {
    const layout = buildPreset('island6')
    expect(encodeLayoutShare(layout).length).toBeLessThan(JSON.stringify(layout).length)
  })
  it('壞掉的分享碼丟出可讀錯誤', () => {
    expect(() => decodeLayoutShare('BAD.xxx')).toThrow('SEAT1')
    expect(() => decodeLayoutShare('SEAT1.!!!!')).toThrow()
  })
})

describe('migrations', () => {
  it('v1 資料升級到目前版本並補齊欄位', () => {
    const v1 = {
      schemaVersion: 1,
      classes: [{ id: 'c1', name: '五甲', students: [] }],
      layouts: [], plans: [], settings: {}, updatedAt: 1,
    }
    const ws = migrate(v1)
    expect(ws.schemaVersion).toBe(SCHEMA_VERSION)
    expect(ws.history).toEqual({})
    expect(ws.settings.lastBackupAt).toBe(null)
    expect(ws.classes[0].relations).toEqual([])
    expect(ws.classes[0].customTraits).toEqual([])
  })
  it('空資料回傳全新 workspace', () => {
    const ws = migrate(null)
    expect(ws.schemaVersion).toBe(SCHEMA_VERSION)
    expect(ws.classes).toEqual([])
  })
})
