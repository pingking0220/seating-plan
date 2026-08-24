// 座位屬性自動推導 — 依家具位置與前方方向計算，老師不必手動標
// 回傳 Map<seatId, string[]>，可能的值：front_row / window / door / aisle

function inRect(f, col, row) {
  return col >= f.col && col < f.col + f.w && row >= f.row && row < f.row + f.h
}

function nearFurniture(layout, kind, col, row, dist = 1) {
  return layout.furniture.some((f) => {
    if (f.kind !== kind) return false
    // 與家具矩形的 Chebyshev 距離 <= dist
    const dx = Math.max(f.col - col, 0, col - (f.col + f.w - 1))
    const dy = Math.max(f.row - row, 0, row - (f.row + f.h - 1))
    return Math.max(dx, dy) <= dist
  })
}

export function computeSeatAttributes(layout) {
  const result = new Map()
  const seats = layout.seats.filter((s) => s.enabled)
  if (!seats.length) return result

  const occupied = new Set()
  for (const s of layout.seats) occupied.add(`${s.col},${s.row}`)
  for (const f of layout.furniture) {
    for (let c = f.col; c < f.col + f.w; c++) {
      for (let r = f.row; r < f.row + f.h; r++) occupied.add(`${c},${r}`)
    }
  }

  // 前排：沿前方方向距離最近的一整列座位
  const axis = layout.front === 'left' || layout.front === 'right' ? 'col' : 'row'
  const values = seats.map((s) => s[axis])
  const frontValue =
    layout.front === 'bottom' || layout.front === 'right' ? Math.max(...values) : Math.min(...values)

  for (const s of layout.seats) {
    const tags = []
    if (s.enabled && s[axis] === frontValue) tags.push('front_row')
    if (nearFurniture(layout, 'window', s.col, s.row)) tags.push('window')
    if (nearFurniture(layout, 'door', s.col, s.row)) tags.push('door')
    // 走道側：左右任一格是空格（不含格線外）
    const leftFree = s.col - 1 >= 0 && !occupied.has(`${s.col - 1},${s.row}`)
    const rightFree = s.col + 1 < layout.grid.cols && !occupied.has(`${s.col + 1},${s.row}`)
    if (leftFree || rightFree) tags.push('aisle')
    result.set(s.id, tags)
  }
  return result
}

export const DERIVED_TAG_LABELS = {
  front_row: '前排',
  window: '靠窗',
  door: '靠門',
  aisle: '走道側',
}
