import { describe, it, expect } from 'vitest'
import { solve } from '../src/core/solver/solve.js'
import { defaultRulesConfig } from '../src/core/rules/registry.js'
import { createLayout, createSeat, createFurniture } from '../src/core/model/defaults.js'

// 3x3 小教室：黑板在上，(0,1) 是無障礙座、(2,1) 靠窗
function makeLayout() {
  return createLayout({
    grid: { cols: 5, rows: 5 },
    seats: [
      createSeat({ id: 'f1', col: 1, row: 1 }),
      createSeat({ id: 'f2', col: 2, row: 1 }),
      createSeat({ id: 'f3', col: 3, row: 1 }),
      createSeat({ id: 'm1', col: 1, row: 2, tags: ['accessible'] }),
      createSeat({ id: 'm2', col: 2, row: 2 }),
      createSeat({ id: 'm3', col: 3, row: 2 }),
      createSeat({ id: 'b1', col: 1, row: 3 }),
      createSeat({ id: 'b2', col: 2, row: 3 }),
      createSeat({ id: 'b3', col: 3, row: 3 }),
    ],
    furniture: [
      createFurniture('board', { col: 0, row: 0, w: 5, h: 1 }),
      createFurniture('window', { col: 4, row: 2 }),
    ],
  })
}
const stu = (id, extra = {}) => ({ id, seatNo: +id.slice(1) || 1, name: id, gender: '', height: null, traits: [], note: '', active: true, ...extra })

describe('solve', () => {
  it('輪椅生固定到無障礙座', () => {
    const r = solve({
      layout: makeLayout(),
      students: [stu('s1', { traits: ['wheelchair'] }), stu('s2'), stu('s3')],
      seed: 1,
    })
    const a = r.assignments.find((x) => x.studentId === 's1')
    expect(a.seatId).toBe('m1')
    expect(r.infeasible).toHaveLength(0)
  })

  it('需前排的學生排進前兩排', () => {
    const r = solve({
      layout: makeLayout(),
      students: [stu('s1', { traits: ['need_front'] }), stu('s2'), stu('s3'), stu('s4'), stu('s5')],
      seed: 1,
    })
    const seatId = r.assignments.find((x) => x.studentId === 's1').seatId
    expect(['f1', 'f2', 'f3', 'm1', 'm2', 'm3']).toContain(seatId)
  })

  it('不可相鄰的兩人被分開', () => {
    const r = solve({
      layout: makeLayout(),
      students: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'].map((id) => stu(id)),
      relations: [{ id: 'r1', a: 's1', b: 's2', type: 'forbid_adjacent' }],
      seed: 1,
    })
    const pos = Object.fromEntries(r.assignments.map((a) => [a.studentId, a.seatId]))
    const layout = makeLayout()
    const seat = (id) => layout.seats.find((s) => s.id === id)
    const p1 = seat(pos.s1), p2 = seat(pos.s2)
    const cheb = Math.max(Math.abs(p1.col - p2.col), Math.abs(p1.row - p2.row))
    expect(cheb).toBeGreaterThan(1)
    expect(r.violations.filter((v) => v.ruleId === 'rel_forbid_adjacent')).toHaveLength(0)
  })

  it('同 seed 結果可重現、不同 seed 可能不同', () => {
    const students = ['s1', 's2', 's3', 's4', 's5'].map((id) => stu(id))
    const a = solve({ layout: makeLayout(), students, seed: 7 })
    const b = solve({ layout: makeLayout(), students, seed: 7 })
    expect(a.assignments).toEqual(b.assignments)
  })

  it('鎖定座位不被移動', () => {
    const r = solve({
      layout: makeLayout(),
      students: ['s1', 's2', 's3'].map((id) => stu(id)),
      locked: [{ seatId: 'b3', studentId: 's3', locked: true }],
      seed: 1,
    })
    expect(r.assignments.find((a) => a.studentId === 's3')).toBeUndefined() // 鎖定的不在回傳（保留原樣）
    expect(r.assignments.find((a) => a.seatId === 'b3')).toBeUndefined()
  })

  it('座位不足回報 infeasible', () => {
    const r = solve({
      layout: makeLayout(),
      students: Array.from({ length: 12 }, (_, i) => stu('s' + (i + 1))),
      seed: 1,
    })
    expect(r.infeasible.length).toBeGreaterThan(0)
  })

  it('避免同座位（歷史紀錄）', () => {
    const cfg = defaultRulesConfig()
    const r = solve({
      layout: makeLayout(),
      students: [stu('s1'), stu('s2')],
      rulesConfig: cfg,
      prev: { seatOf: { s1: 'f1', s2: 'f2' }, neighborsOf: {} },
      seed: 1,
    })
    const pos = Object.fromEntries(r.assignments.map((a) => [a.studentId, a.seatId]))
    expect(pos.s1).not.toBe('f1')
    expect(pos.s2).not.toBe('f2')
  })

  it('30 人規模在 300ms 內完成', () => {
    const layout = createLayout({
      grid: { cols: 14, rows: 11 },
      seats: Array.from({ length: 32 }, (_, i) =>
        createSeat({ id: 'x' + i, col: 1 + (i % 8), row: 2 + Math.floor(i / 8), groupId: 'g' + Math.floor(i / 4) })),
      furniture: [createFurniture('board', { col: 4, row: 0 })],
    })
    const students = Array.from({ length: 30 }, (_, i) =>
      stu('s' + i, { gender: i % 2 ? 'M' : 'F', traits: i === 0 ? ['need_front'] : i === 1 ? ['easily_distracted'] : [] }))
    const t0 = performance.now()
    const r = solve({ layout, students, seed: 3 })
    const ms = performance.now() - t0
    expect(r.assignments).toHaveLength(30)
    expect(ms).toBeLessThan(300)
  })
})
