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

describe('男女不同排（gender_alt_columns）', () => {
  // 4 直行 × 4 列的簡單教室
  const layout4 = () => createLayout({
    grid: { cols: 6, rows: 6 },
    seats: Array.from({ length: 16 }, (_, i) =>
      createSeat({ id: 'g' + i, col: 1 + (i % 4), row: 1 + Math.floor(i / 4) })),
    furniture: [],
  })
  const mkStudents = () =>
    Array.from({ length: 16 }, (_, i) =>
      stu('s' + i, { gender: i < 8 ? 'M' : 'F' }))

  it('自動排位後每直行單一性別且左右交錯', () => {
    const r = solve({ layout: layout4(), students: mkStudents(), seed: 2 })
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
    // 驗證實際欄位分佈
    const layout = layout4()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const students = mkStudents()
    const stuById = new Map(students.map((s) => [s.id, s]))
    const colGenders = new Map()
    for (const a of r.assignments) {
      const col = seatById.get(a.seatId).col
      if (!colGenders.has(col)) colGenders.set(col, new Set())
      colGenders.get(col).add(stuById.get(a.studentId).gender)
    }
    for (const [, genders] of colGenders) expect(genders.size).toBe(1)
    const ordered = [...colGenders.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => [...g][0])
    for (let i = 1; i < ordered.length; i++) expect(ordered[i]).not.toBe(ordered[i - 1])
  })

  it('性別未填的學生不計入', () => {
    const students = Array.from({ length: 6 }, (_, i) => stu('s' + i)) // 全部沒性別
    const r = solve({ layout: layout4(), students, seed: 1 })
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
  })

  it('關閉規則時不產生違規', () => {
    const cfg = defaultRulesConfig()
    cfg.gender_alt_columns.enabled = false
    // 把全部男生排同一行也不會被記違規
    const r = solve({ layout: layout4(), students: mkStudents(), rulesConfig: cfg, seed: 1 })
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
  })
})

describe('不可同列 / 不可同行', () => {
  const gridLayout = () => createLayout({
    grid: { cols: 6, rows: 6 },
    seats: Array.from({ length: 16 }, (_, i) =>
      createSeat({ id: 'q' + i, col: 1 + (i % 4), row: 1 + Math.floor(i / 4) })),
    furniture: [],
  })

  it('forbid_same_row：兩人被排到不同橫列', () => {
    const students = Array.from({ length: 10 }, (_, i) => stu('s' + i))
    const r = solve({
      layout: gridLayout(), students,
      relations: [{ id: 'r1', a: 's0', b: 's1', type: 'forbid_same_row' }],
      seed: 1,
    })
    const layout = gridLayout()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const pos = Object.fromEntries(r.assignments.map((a) => [a.studentId, seatById.get(a.seatId)]))
    expect(pos.s0.row).not.toBe(pos.s1.row)
    expect(r.violations.filter((v) => v.ruleId === 'rel_forbid_same_row')).toHaveLength(0)
  })

  it('forbid_same_col：兩人被排到不同直行', () => {
    const students = Array.from({ length: 10 }, (_, i) => stu('s' + i))
    const r = solve({
      layout: gridLayout(), students,
      relations: [{ id: 'r1', a: 's0', b: 's1', type: 'forbid_same_col' }],
      seed: 1,
    })
    const layout = gridLayout()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const pos = Object.fromEntries(r.assignments.map((a) => [a.studentId, seatById.get(a.seatId)]))
    expect(pos.s0.col).not.toBe(pos.s1.col)
    expect(r.violations.filter((v) => v.ruleId === 'rel_forbid_same_col')).toHaveLength(0)
  })

  it('違規時訊息可讀（手動排進同列）', async () => {
    const { evaluatePlan } = await import('../src/core/solver/solve.js')
    const layout = gridLayout()
    const students = [stu('s0', { name: '甲' }), stu('s1', { name: '乙' })]
    const { violations } = evaluatePlan({
      layout, students,
      relations: [{ id: 'r1', a: 's0', b: 's1', type: 'forbid_same_row' }],
      assignments: [
        { seatId: 'q0', studentId: 's0', locked: false }, // (1,1)
        { seatId: 'q1', studentId: 's1', locked: false }, // (2,1) 同列
      ],
    })
    const v = violations.find((x) => x.ruleId === 'rel_forbid_same_row')
    expect(v.message).toContain('甲')
    expect(v.message).toContain('乙')
    expect(v.message).toContain('同一橫列')
  })
})

describe('往前坐不留空（fill_front）', () => {
  // 4 直行 × 5 列 = 20 座，只有 13 人 → 空位應全部在最後
  const bigLayout = () => createLayout({
    grid: { cols: 6, rows: 7 },
    seats: Array.from({ length: 20 }, (_, i) =>
      createSeat({ id: 'w' + i, col: 1 + (i % 4), row: 1 + Math.floor(i / 4) })),
    furniture: [],
  })

  it('自動排位後空位全部沉到最後面', () => {
    const students = Array.from({ length: 13 }, (_, i) => stu('s' + i))
    const r = solve({ layout: bigLayout(), students, seed: 5 })
    expect(r.violations.filter((v) => v.ruleId === 'fill_front')).toHaveLength(0)
    // 依閱讀順序（row, col），前 13 個座位都要有人
    const layout = bigLayout()
    const ordered = layout.seats.slice().sort((a, b) => a.row - b.row || a.col - b.col)
    const occupied = new Set(r.assignments.map((a) => a.seatId))
    for (let i = 0; i < 13; i++) {
      expect(occupied.has(ordered[i].id), `閱讀順序第 ${i + 1} 個座位應有人`).toBe(true)
    }
  })

  it('手動把人排在後面時回報「前面還有空位」', async () => {
    const { evaluatePlan } = await import('../src/core/solver/solve.js')
    const layout = bigLayout()
    const { violations } = evaluatePlan({
      layout,
      students: [stu('s0', { name: '甲' })],
      assignments: [{ seatId: 'w19', studentId: 's0', locked: false }], // 最後一個座位
    })
    const v = violations.find((x) => x.ruleId === 'fill_front')
    expect(v.message).toContain('甲')
    expect(v.message).toContain('空位')
  })
})
