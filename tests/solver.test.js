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

  it('30 人規模在 500ms 內完成', () => {
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
    expect(ms).toBeLessThan(500)
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

  it('自動排位後每一直行由前往後坐滿、空位在行尾', () => {
    const students = Array.from({ length: 13 }, (_, i) => stu('s' + i))
    const r = solve({ layout: bigLayout(), students, seed: 5 })
    expect(r.violations.filter((v) => v.ruleId === 'fill_front')).toHaveLength(0)
    const layout = bigLayout()
    const occupied = new Set(r.assignments.map((a) => a.seatId))
    const byCol = {}
    for (const s of layout.seats) (byCol[s.col] = byCol[s.col] || []).push(s)
    for (const col of Object.keys(byCol)) {
      const seats = byCol[col].sort((a, b) => a.row - b.row)
      let seenEmpty = false
      for (const s of seats) {
        if (!occupied.has(s.id)) seenEmpty = true
        else expect(seenEmpty, `第 ${col} 行有人坐在空位後面`).toBe(false)
      }
    }
  })

  it('空位在各行行尾時不算違規（教室前方為基準）', async () => {
    const { evaluatePlan } = await import('../src/core/solver/solve.js')
    const layout = bigLayout()
    // 每一直行取前 3 個座位坐滿、行尾留 2 空 → 應零違規
    const byCol = {}
    for (const s of layout.seats) (byCol[s.col] = byCol[s.col] || []).push(s)
    const assignments = []
    const studentsList = []
    let n = 0
    for (const col of Object.keys(byCol)) {
      const seats = byCol[col].sort((a, b) => a.row - b.row)
      for (let i = 0; i < 3; i++) {
        const st = stu('t' + n++)
        studentsList.push(st)
        assignments.push({ seatId: seats[i].id, studentId: st.id, locked: false })
      }
    }
    const { violations } = evaluatePlan({ layout, students: studentsList, assignments })
    expect(violations.filter((v) => v.ruleId === 'fill_front')).toHaveLength(0)
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
    expect(v.message).toContain('同一直行前面還有')
  })
})

describe('座號順序 / 每排人數平均 / 每排皆要有人', () => {
  const layout45 = () => createLayout({
    grid: { cols: 6, rows: 7 },
    seats: Array.from({ length: 20 }, (_, i) =>
      createSeat({ id: 'z' + i, col: 1 + (i % 4), row: 1 + Math.floor(i / 4) })),
    furniture: [],
  })
  const numbered = (n) => Array.from({ length: n }, (_, i) => stu('s' + (i + 1), { seatNo: i + 1 }))

  function colRowOf(layout, seatId) {
    const s = layout.seats.find((x) => x.id === seatId)
    return { col: s.col, row: s.row }
  }

  it('座號順序（由左至右）：座號沿直行遞增', () => {
    const cfg = defaultRulesConfig()
    cfg.seatno_order_lr.enabled = true
    cfg.gender_alt_columns.enabled = false
    const r = solve({ layout: layout45(), students: numbered(12), rulesConfig: cfg, seed: 3 })
    expect(r.violations.filter((v) => v.ruleId === 'seatno_order_lr')).toHaveLength(0)
    const layout = layout45()
    const seq = r.assignments
      .map((a) => ({ ...colRowOf(layout, a.seatId), no: +a.studentId.slice(1) }))
      .sort((a, b) => a.col - b.col || a.row - b.row)
      .map((x) => x.no)
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1])
  })

  it('座號順序（由右至左）：最右直行是最小座號', () => {
    const cfg = defaultRulesConfig()
    cfg.seatno_order_rl.enabled = true
    cfg.gender_alt_columns.enabled = false
    const r = solve({ layout: layout45(), students: numbered(12), rulesConfig: cfg, seed: 3 })
    expect(r.violations.filter((v) => v.ruleId === 'seatno_order_rl')).toHaveLength(0)
    const layout = layout45()
    const seq = r.assignments
      .map((a) => ({ ...colRowOf(layout, a.seatId), no: +a.studentId.slice(1) }))
      .sort((a, b) => b.col - a.col || a.row - b.row)
      .map((x) => x.no)
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1])
  })

  it('每排人數平均：各直行人數差 <= 2', () => {
    const r = solve({ layout: layout45(), students: numbered(10), seed: 4 })
    expect(r.violations.filter((v) => v.ruleId === 'col_balance')).toHaveLength(0)
    const layout = layout45()
    const counts = {}
    for (const a of r.assignments) {
      const { col } = colRowOf(layout, a.seatId)
      counts[col] = (counts[col] || 0) + 1
    }
    const vals = Object.values(counts)
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(2)
  })

  it('每排皆要有人：手動空出一整行會被回報', async () => {
    const { evaluatePlan } = await import('../src/core/solver/solve.js')
    const layout = layout45()
    // 8 人全部塞在 col1、col2（col3、col4 整行空）
    const students = numbered(8)
    const seats12 = layout.seats.filter((s) => s.col <= 2).slice(0, 8)
    const assignments = seats12.map((s, i) => ({ seatId: s.id, studentId: students[i].id, locked: false }))
    const { violations } = evaluatePlan({ layout, students, assignments })
    const v = violations.filter((x) => x.ruleId === 'every_col')
    expect(v.length).toBe(2)
    expect(v[0].message).toContain('整排沒人')
  })

  it('人數比行數少時不強求每排有人', async () => {
    const { evaluatePlan } = await import('../src/core/solver/solve.js')
    const layout = layout45()
    const students = numbered(2)
    const seats = layout.seats.filter((s) => s.col === 1).slice(0, 2)
    const { violations } = evaluatePlan({
      layout, students,
      assignments: seats.map((s, i) => ({ seatId: s.id, studentId: students[i].id, locked: false })),
    })
    expect(violations.filter((x) => x.ruleId === 'every_col')).toHaveLength(0)
  })
})

describe('座號順序 + 男女不同排 併用', () => {
  // 4 直行 × 4 列，6 男（1-6 號）+ 6 女（21-26 號）→ 男女排交錯、各自座號遞增
  const layoutG = () => createLayout({
    grid: { cols: 6, rows: 6 },
    seats: Array.from({ length: 16 }, (_, i) =>
      createSeat({ id: 'y' + i, col: 1 + (i % 4), row: 1 + Math.floor(i / 4) })),
    furniture: [],
  })
  const mixed = () => [
    ...Array.from({ length: 6 }, (_, i) => stu('m' + (i + 1), { seatNo: i + 1, gender: 'M' })),
    ...Array.from({ length: 6 }, (_, i) => stu('f' + (i + 1), { seatNo: 20 + i + 1, gender: 'F' })),
  ]

  it('男生排與女生排交錯，且各自座號由左至右遞增', () => {
    const cfg = defaultRulesConfig()
    cfg.seatno_order_lr.enabled = true
    const r = solve({ layout: layoutG(), students: mixed(), rulesConfig: cfg, seed: 6 })
    expect(r.violations.filter((v) => v.ruleId === 'seatno_order_lr')).toHaveLength(0)
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)

    const layout = layoutG()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const students = mixed()
    const stuById = new Map(students.map((s) => [s.id, s]))
    const colOf = {}
    for (const a of r.assignments) {
      const seat = seatById.get(a.seatId)
      const st = stuById.get(a.studentId)
      ;(colOf[seat.col] = colOf[seat.col] || []).push({ row: seat.row, no: st.seatNo, g: st.gender })
    }
    const cols = Object.keys(colOf).map(Number).sort((a, b) => a - b)
    // 每直行單一性別、左右交錯
    const genders = cols.map((c) => new Set(colOf[c].map((x) => x.g)))
    for (const g of genders) expect(g.size).toBe(1)
    for (let i = 1; i < genders.length; i++) expect([...genders[i]][0]).not.toBe([...genders[i - 1]][0])
    // 各性別的座號沿（直行由左至右、行內由前到後）遞增
    for (const gender of ['M', 'F']) {
      const seq = []
      for (const c of cols) {
        colOf[c].sort((a, b) => a.row - b.row)
        for (const x of colOf[c]) if (x.g === gender) seq.push(x.no)
      }
      for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1])
    }
  })
})

describe('男女不同排：男生先 / 女生先相位', () => {
  const layoutP = () => createLayout({
    grid: { cols: 6, rows: 6 },
    seats: Array.from({ length: 16 }, (_, i) =>
      createSeat({ id: 'p' + i, col: 1 + (i % 4), row: 1 + Math.floor(i / 4) })),
    furniture: [],
  })
  const balanced = () =>
    Array.from({ length: 16 }, (_, i) => stu('s' + i, { gender: i < 8 ? 'M' : 'F' }))

  function leftmostColGender(r) {
    const layout = layoutP()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const students = balanced()
    const stuById = new Map(students.map((s) => [s.id, s]))
    const minCol = Math.min(...r.assignments.map((a) => seatById.get(a.seatId).col))
    const genders = new Set(
      r.assignments
        .filter((a) => seatById.get(a.seatId).col === minCol)
        .map((a) => stuById.get(a.studentId).gender),
    )
    return [...genders]
  }

  it("phase='M'：最左排全是男生", () => {
    const cfg = defaultRulesConfig()
    cfg.gender_alt_columns.phase = 'M'
    const r = solve({ layout: layoutP(), students: balanced(), rulesConfig: cfg, seed: 9 })
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
    expect(leftmostColGender(r)).toEqual(['M'])
  })

  it("phase='F'：最左排全是女生", () => {
    const cfg = defaultRulesConfig()
    cfg.gender_alt_columns.phase = 'F'
    const r = solve({ layout: layoutP(), students: balanced(), rulesConfig: cfg, seed: 9 })
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
    expect(leftmostColGender(r)).toEqual(['F'])
  })

  it("座號順序併用時 phase='F'：最左排是女生且座號遞增", () => {
    const cfg = defaultRulesConfig()
    cfg.seatno_order_lr.enabled = true
    cfg.gender_alt_columns.phase = 'F'
    const students = [
      ...Array.from({ length: 8 }, (_, i) => stu('m' + (i + 1), { seatNo: i + 1, gender: 'M' })),
      ...Array.from({ length: 8 }, (_, i) => stu('f' + (i + 1), { seatNo: 20 + i + 1, gender: 'F' })),
    ]
    const r = solve({ layout: layoutP(), students, rulesConfig: cfg, seed: 9 })
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
    expect(r.violations.filter((v) => v.ruleId === 'seatno_order_lr')).toHaveLength(0)
    const layout = layoutP()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const stuById = new Map(students.map((s) => [s.id, s]))
    const minCol = Math.min(...r.assignments.map((a) => seatById.get(a.seatId).col))
    const leftGenders = new Set(
      r.assignments.filter((a) => seatById.get(a.seatId).col === minCol).map((a) => stuById.get(a.studentId).gender),
    )
    expect([...leftGenders]).toEqual(['F'])
  })
})

describe('男女各自均分到各排', () => {
  // 6 直行 × 5 列 = 30 座，11 男 + 14 女（模擬使用者實際班級）
  const layoutW = () => createLayout({
    grid: { cols: 8, rows: 7 },
    seats: Array.from({ length: 30 }, (_, i) =>
      createSeat({ id: 'v' + i, col: 1 + (i % 6), row: 1 + Math.floor(i / 6) })),
    furniture: [],
  })
  const realClass = () => [
    ...Array.from({ length: 11 }, (_, i) => stu('m' + (i + 1), { seatNo: i + 1, gender: 'M' })),
    ...Array.from({ length: 14 }, (_, i) => stu('f' + (i + 1), { seatNo: 20 + i + 1, gender: 'F' })),
  ]

  function genderColCounts(r) {
    const layout = layoutW()
    const seatById = new Map(layout.seats.map((s) => [s.id, s]))
    const students = realClass()
    const stuById = new Map(students.map((s) => [s.id, s]))
    const counts = { M: {}, F: {} }
    for (const a of r.assignments) {
      const col = seatById.get(a.seatId).col
      const g = stuById.get(a.studentId).gender
      counts[g][col] = (counts[g][col] || 0) + 1
    }
    return counts
  }

  it('自動排位：男生各排差 <= 1、女生各排差 <= 1', () => {
    const r = solve({ layout: layoutW(), students: realClass(), seed: 11 })
    expect(r.violations.filter((v) => v.ruleId === 'col_balance')).toHaveLength(0)
    const counts = genderColCounts(r)
    for (const g of ['M', 'F']) {
      const vals = Object.values(counts[g])
      expect(Math.max(...vals) - Math.min(...vals), g + ' 各排人數差').toBeLessThanOrEqual(1)
    }
  })

  it('座號順序併用：初始解就男女各自均分且無混排', () => {
    const cfg = defaultRulesConfig()
    cfg.seatno_order_lr.enabled = true
    const r = solve({ layout: layoutW(), students: realClass(), rulesConfig: cfg, seed: 11 })
    expect(r.violations.filter((v) => v.ruleId === 'col_balance')).toHaveLength(0)
    expect(r.violations.filter((v) => v.ruleId === 'gender_alt_columns')).toHaveLength(0)
    expect(r.violations.filter((v) => v.ruleId === 'seatno_order_lr')).toHaveLength(0)
    const counts = genderColCounts(r)
    // 每直行單一性別
    const layout = layoutW()
    const allCols = [...new Set(layout.seats.map((s) => s.col))]
    for (const col of allCols) {
      const m = counts.M[col] || 0
      const f = counts.F[col] || 0
      expect(m === 0 || f === 0, `第 ${col} 行男女混排`).toBe(true)
    }
    for (const g of ['M', 'F']) {
      const vals = Object.values(counts[g])
      expect(Math.max(...vals) - Math.min(...vals), g + ' 各排人數差').toBeLessThanOrEqual(1)
    }
  })
})
