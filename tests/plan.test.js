import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPlan, place, assignmentAt, seatOf, toggleLock,
  autoFillBySeatNo, clearPlan, seatsInOrder, flipLayout,
} from '../src/core/seating/plan.js'
import { createLayout, createSeat } from '../src/core/model/defaults.js'

const layout = createLayout({
  grid: { cols: 4, rows: 3 },
  seats: [
    createSeat({ id: 's1', col: 0, row: 0 }),
    createSeat({ id: 's2', col: 1, row: 0 }),
    createSeat({ id: 's3', col: 0, row: 1 }),
    createSeat({ id: 's4', col: 1, row: 1, enabled: false }),
  ],
  furniture: [],
})
const students = [
  { id: 'a', seatNo: 1, name: '甲', active: true },
  { id: 'b', seatNo: 2, name: '乙', active: true },
  { id: 'c', seatNo: 3, name: '丙', active: true },
  { id: 'd', seatNo: 4, name: '丁', active: false },
]

let plan
beforeEach(() => {
  plan = createPlan({ classId: 'x', layoutId: layout.id })
})

describe('place', () => {
  it('放到空位', () => {
    expect(place(plan, { studentId: 'a', fromSeatId: null }, 's1').ok).toBe(true)
    expect(assignmentAt(plan, 's1').studentId).toBe('a')
  })
  it('從名單放到有人座位 → 佔位者退回', () => {
    place(plan, { studentId: 'a', fromSeatId: null }, 's1')
    place(plan, { studentId: 'b', fromSeatId: null }, 's1')
    expect(assignmentAt(plan, 's1').studentId).toBe('b')
    expect(seatOf(plan, 'a')).toBe(null)
  })
  it('兩個已就座學生 → 交換', () => {
    place(plan, { studentId: 'a', fromSeatId: null }, 's1')
    place(plan, { studentId: 'b', fromSeatId: null }, 's2')
    place(plan, { studentId: 'a', fromSeatId: 's1' }, 's2')
    expect(assignmentAt(plan, 's2').studentId).toBe('a')
    expect(assignmentAt(plan, 's1').studentId).toBe('b')
  })
  it('鎖定座位拒絕變更', () => {
    place(plan, { studentId: 'a', fromSeatId: null }, 's1')
    toggleLock(plan, 's1')
    const r = place(plan, { studentId: 'b', fromSeatId: null }, 's1')
    expect(r).toEqual({ ok: false, reason: 'locked-target' })
    expect(assignmentAt(plan, 's1').studentId).toBe('a')
  })
  it('鎖定的學生不能被移走', () => {
    place(plan, { studentId: 'a', fromSeatId: null }, 's1')
    toggleLock(plan, 's1')
    const r = place(plan, { studentId: 'a', fromSeatId: 's1' }, 's2')
    expect(r.reason).toBe('locked-origin')
  })
})

describe('autoFillBySeatNo', () => {
  it('依座號填入閱讀順序座位、略過停用座位與非在籍學生', () => {
    autoFillBySeatNo(plan, layout, students)
    expect(assignmentAt(plan, 's1').studentId).toBe('a')
    expect(assignmentAt(plan, 's2').studentId).toBe('b')
    expect(assignmentAt(plan, 's3').studentId).toBe('c')
    expect(assignmentAt(plan, 's4')).toBe(null) // 停用座位
    expect(seatOf(plan, 'd')).toBe(null) // 轉出學生
  })
  it('鎖定的安排不動', () => {
    place(plan, { studentId: 'c', fromSeatId: null }, 's1')
    toggleLock(plan, 's1')
    autoFillBySeatNo(plan, layout, students)
    expect(assignmentAt(plan, 's1').studentId).toBe('c')
    expect(assignmentAt(plan, 's2').studentId).toBe('a')
  })
})

describe('clearPlan', () => {
  it('清空但保留鎖定', () => {
    autoFillBySeatNo(plan, layout, students)
    toggleLock(plan, 's2')
    clearPlan(plan)
    expect(plan.assignments).toHaveLength(1)
    expect(assignmentAt(plan, 's2').locked).toBe(true)
  })
})

describe('flipLayout', () => {
  it('180 度翻轉座位與家具', () => {
    const f = flipLayout(createLayout({
      grid: { cols: 4, rows: 3 },
      seats: [createSeat({ id: 's', col: 0, row: 0, rotation: 90 })],
      furniture: [{ id: 'f', kind: 'board', col: 0, row: 0, w: 2, h: 1 }],
    }))
    expect(f.seats[0]).toMatchObject({ col: 3, row: 2, rotation: 270 })
    expect(f.furniture[0]).toMatchObject({ col: 2, row: 2 })
  })
  it('seatsInOrder 由前到後由左到右', () => {
    expect(seatsInOrder(layout).map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })
})
