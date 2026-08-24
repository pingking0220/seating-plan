// 佈局分享碼：LZ 壓縮 + URI-safe 編碼，資料不經任何伺服器
import LZString from 'lz-string'

const PREFIX = 'SEAT1.'

export function encodeLayoutShare(layout) {
  const slim = {
    name: layout.name,
    kind: layout.kind,
    grid: layout.grid,
    front: layout.front,
    seats: layout.seats.map((s) => ({ id: s.id, col: s.col, row: s.row, rotation: s.rotation, groupId: s.groupId, tags: s.tags, enabled: s.enabled })),
    furniture: layout.furniture.map((f) => ({ id: f.id, kind: f.kind, col: f.col, row: f.row, w: f.w, h: f.h })),
  }
  return PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(slim))
}

export function decodeLayoutShare(code) {
  const trimmed = String(code || '').trim()
  if (!trimmed.startsWith(PREFIX)) throw new Error('不是有效的分享碼（開頭應為 SEAT1.）')
  const json = LZString.decompressFromEncodedURIComponent(trimmed.slice(PREFIX.length))
  if (!json) throw new Error('分享碼解壓失敗')
  const raw = JSON.parse(json)
  if (!raw.grid || !Array.isArray(raw.seats)) throw new Error('分享碼內容不完整')
  return raw
}
