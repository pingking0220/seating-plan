// 求解脈絡：把佈局/名單/關係/歷史整理成快速查詢結構
import { computeSeatAttributes } from '../layout/seatAttributes.js'

export function buildContext({ layout, students, relations = [], prev = null }) {
  const seats = layout.seats.filter((s) => s.enabled)
  const seatById = new Map(layout.seats.map((s) => [s.id, s]))
  const byGrid = new Map(layout.seats.map((s) => [`${s.col},${s.row}`, s]))
  const attrs = computeSeatAttributes(layout)

  // 前後排名（front=top：row 小的在前）
  const uniqueRows = [...new Set(seats.map((s) => s.row))].sort((a, b) => a - b)
  if (layout.front === 'bottom') uniqueRows.reverse()
  const rankOfRow = new Map(uniqueRows.map((r, i) => [r, i]))
  const rowRank = new Map(seats.map((s) => [s.id, rankOfRow.get(s.row)]))

  // 相鄰表：正交（走道互動用）與八方（肘部/衝突用）
  const adj = new Map()
  const adj8 = new Map()
  for (const s of seats) {
    const o = new Set()
    const e = new Set()
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue
        const n = byGrid.get(`${s.col + dc},${s.row + dr}`)
        if (n && n.enabled) {
          e.add(n.id)
          if (Math.abs(dc) + Math.abs(dr) === 1) o.add(n.id)
        }
      }
    }
    adj.set(s.id, o)
    adj8.set(s.id, e)
  }

  // 教師附近座位（講台/黑板 Chebyshev 2 格內）
  const nearTeacherSeats = new Set()
  for (const f of layout.furniture) {
    if (f.kind !== 'podium' && f.kind !== 'board') continue
    for (const s of seats) {
      const dx = Math.max(f.col - s.col, 0, s.col - (f.col + f.w - 1))
      const dy = Math.max(f.row - s.row, 0, s.row - (f.row + f.h - 1))
      if (Math.max(dx, dy) <= 2) nearTeacherSeats.add(s.id)
    }
  }

  const accessibleSeats = new Set(seats.filter((s) => s.tags.includes('accessible')).map((s) => s.id))

  const relationsOf = new Map()
  for (const rel of relations) {
    for (const who of [rel.a, rel.b]) {
      if (!relationsOf.has(who)) relationsOf.set(who, [])
      relationsOf.get(who).push(rel)
    }
  }

  return {
    layout, seats, seatById, byGrid, attrs, rowRank,
    adj, adj8, nearTeacherSeats, accessibleSeats,
    students, studentById: new Map(students.map((s) => [s.id, s])),
    relations, relationsOf, prev,
    assign: new Map(), // seatId -> studentId
    seatOf: new Map(), // studentId -> seatId
  }
}

export function setAssign(ctx, seatId, studentId) {
  const old = ctx.assign.get(seatId)
  if (old) ctx.seatOf.delete(old)
  if (studentId) {
    const prevSeat = ctx.seatOf.get(studentId)
    if (prevSeat) ctx.assign.delete(prevSeat)
    ctx.assign.set(seatId, studentId)
    ctx.seatOf.set(studentId, seatId)
  } else {
    ctx.assign.delete(seatId)
  }
}
