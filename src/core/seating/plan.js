// 座位表（SeatingPlan）操作 — 純函式，可單元測試
// assignments: [{ seatId, studentId, locked }]
import { uid } from '../model/defaults.js'

export function createPlan(partial = {}) {
  return {
    id: uid(),
    classId: null,
    layoutId: null,
    name: '',
    assignments: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  }
}

export function assignmentAt(plan, seatId) {
  return plan.assignments.find((a) => a.seatId === seatId) || null
}

export function seatOf(plan, studentId) {
  return plan.assignments.find((a) => a.studentId === studentId)?.seatId ?? null
}

export function unassign(plan, studentId) {
  plan.assignments = plan.assignments.filter((a) => a.studentId !== studentId)
}

export function toggleLock(plan, seatId) {
  const a = assignmentAt(plan, seatId)
  if (a) a.locked = !a.locked
}

/**
 * 把學生放到目標座位（點選式移動/交換的核心）
 * selection: { studentId, fromSeatId|null }
 * 回傳 { ok, reason? }：
 *  - 目標座位鎖定 → locked-target
 *  - 學生原座位鎖定 → locked-origin
 *  - 目標有人：學生原本有座位 → 兩人交換；原本沒座位 → 佔位者退回未安排
 */
export function place(plan, selection, targetSeatId) {
  const { studentId, fromSeatId } = selection
  const target = assignmentAt(plan, targetSeatId)
  if (target && target.studentId === studentId) return { ok: true }
  if (target?.locked) return { ok: false, reason: 'locked-target' }
  if (fromSeatId) {
    const origin = assignmentAt(plan, fromSeatId)
    if (origin?.locked) return { ok: false, reason: 'locked-origin' }
  }
  // 移除學生現有的安排
  plan.assignments = plan.assignments.filter((a) => a.studentId !== studentId)
  if (target) {
    if (fromSeatId) {
      target.seatId = fromSeatId // 交換：佔位者移到學生原座位
    } else {
      plan.assignments = plan.assignments.filter((a) => a.seatId !== targetSeatId) // 退回未安排
    }
  }
  plan.assignments.push({ seatId: targetSeatId, studentId, locked: false })
  return { ok: true }
}

/** 依「閱讀順序」排序座位：由前到後、由左到右（front=top 時 row 優先） */
export function seatsInOrder(layout) {
  return layout.seats
    .filter((s) => s.enabled)
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
}

/**
 * 依座號順序快速填入：保留鎖定的安排，其餘清空後
 * 未安排學生依座號序 → 依閱讀順序填進空位
 */
export function autoFillBySeatNo(plan, layout, students) {
  const lockedAssignments = plan.assignments.filter((a) => a.locked)
  const lockedSeatIds = new Set(lockedAssignments.map((a) => a.seatId))
  const lockedStudentIds = new Set(lockedAssignments.map((a) => a.studentId))
  const seats = seatsInOrder(layout).filter((s) => !lockedSeatIds.has(s.id))
  const pool = students
    .filter((s) => s.active && !lockedStudentIds.has(s.id))
    .slice()
    .sort((a, b) => (a.seatNo ?? 999) - (b.seatNo ?? 999))
  plan.assignments = [
    ...lockedAssignments,
    ...seats.slice(0, pool.length).map((seat, i) => ({ seatId: seat.id, studentId: pool[i].id, locked: false })),
  ]
}

/** 清空（保留鎖定） */
export function clearPlan(plan) {
  plan.assignments = plan.assignments.filter((a) => a.locked)
}

/** 老師視角：整間教室 180 度翻轉（文字仍正向） */
export function flipLayout(layout) {
  const { cols, rows } = layout.grid
  return {
    ...layout,
    seats: layout.seats.map((s) => ({
      ...s,
      col: cols - 1 - s.col,
      row: rows - 1 - s.row,
      rotation: ((s.rotation || 0) + 180) % 360,
    })),
    furniture: layout.furniture.map((f) => ({
      ...f,
      col: cols - f.col - f.w,
      row: rows - f.row - f.h,
    })),
  }
}
