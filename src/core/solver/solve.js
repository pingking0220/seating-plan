// 自動排位：貪婪初始配置 + 兩兩交換局部搜尋（可種子重現）
import { buildContext, setAssign } from './context.js'
import { studentEval, studentScore, totalScore, fullViolations, groupEval, heightEval } from './scoring.js'
import { defaultRulesConfig } from '../rules/registry.js'

/** 可重現的偽隨機數 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @returns { assignments: [{seatId, studentId, locked:false}], score, violations, explains: Map, infeasible: [] }
 */
export function solve({ layout, students, relations = [], rulesConfig, locked = [], prev = null, seed = 1 }) {
  const cfg = rulesConfig || defaultRulesConfig()
  const rng = mulberry32(seed)
  const active = students.filter((s) => s.active)
  const ctx = buildContext({ layout, students: active, relations, prev })

  const infeasible = []
  const lockedSeatIds = new Set()
  const lockedStudentIds = new Set()
  for (const a of locked) {
    if (!ctx.seatById.get(a.seatId)) continue
    setAssign(ctx, a.seatId, a.studentId)
    lockedSeatIds.add(a.seatId)
    lockedStudentIds.add(a.studentId)
  }

  const freeSeats = () => ctx.seats.filter((s) => !lockedSeatIds.has(s.id) && !ctx.assign.get(s.id))
  const pool = active.filter((s) => !lockedStudentIds.has(s.id))

  if (pool.length > ctx.seats.length - lockedSeatIds.size) {
    infeasible.push(`座位不足：${pool.length} 位學生 > ${ctx.seats.length - lockedSeatIds.size} 個可用座位`)
  }
  const wheelchairCount = pool.filter((s) => s.traits?.includes('wheelchair')).length
  if (ctx.accessibleSeats.size > 0 && wheelchairCount > ctx.accessibleSeats.size) {
    infeasible.push(`無障礙座位不足：${wheelchairCount} 位輪椅生 > ${ctx.accessibleSeats.size} 個無障礙座`)
  }

  // 貪婪：受限越多的學生越先安置
  const tightness = (s) =>
    (s.traits?.includes('wheelchair') ? 100 : 0) +
    (s.traits?.length || 0) * 10 +
    (ctx.relationsOf.get(s.id)?.length || 0) * 5
  const order = pool.slice().sort((a, b) => tightness(b) - tightness(a) || (a.seatNo ?? 999) - (b.seatNo ?? 999))

  for (const stu of order) {
    let best = null
    let bestScore = Infinity
    for (const seat of freeSeats()) {
      setAssign(ctx, seat.id, stu.id)
      const sc = studentScore(ctx, cfg, stu, seat.id) + rng() * 0.01 // 微噪聲讓同分洗牌
      setAssign(ctx, seat.id, null)
      if (sc < bestScore) { bestScore = sc; best = seat }
    }
    if (best) setAssign(ctx, best.id, stu.id)
  }

  // 局部搜尋：兩兩交換 + 移到空位，改善就接受，直到一輪無改善
  const swappable = ctx.seats.filter((s) => !lockedSeatIds.has(s.id))
  let improved = true
  let guard = 0
  while (improved && guard++ < 60) {
    improved = false
    const idx = swappable.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    for (let ii = 0; ii < idx.length; ii++) {
      for (let jj = ii + 1; jj < idx.length; jj++) {
        const s1 = swappable[idx[ii]]
        const s2 = swappable[idx[jj]]
        const a = ctx.assign.get(s1.id) || null
        const b = ctx.assign.get(s2.id) || null
        if (!a && !b) continue
        const delta = swapDelta(ctx, cfg, s1, s2, a, b)
        if (delta < -1e-9) {
          setAssign(ctx, s1.id, null)
          setAssign(ctx, s2.id, null)
          if (b) setAssign(ctx, s1.id, b)
          if (a) setAssign(ctx, s2.id, a)
          improved = true
        }
      }
    }
  }

  const score = totalScore(ctx, cfg)
  const violations = fullViolations(ctx, cfg)
  const explains = new Map()
  for (const [seatId, stuId] of ctx.assign) {
    explains.set(stuId, studentEval(ctx, ctx.studentById.get(stuId), seatId))
  }
  const assignments = [...ctx.assign.entries()]
    .filter(([seatId]) => !lockedSeatIds.has(seatId))
    .map(([seatId, studentId]) => ({ seatId, studentId, locked: false }))
  return { assignments, score, violations, explains, infeasible }
}

/** 交換 s1/s2 上的 a/b 之後的分數變化（只重算受影響部分） */
function swapDelta(ctx, cfg, s1, s2, a, b) {
  const affectedGroups = new Set([s1.groupId, s2.groupId].filter(Boolean))
  const affectedCols = new Set([s1.col, s2.col])
  const localScore = () => {
    let sc = 0
    // 兩位學生本身 + 其相鄰者（emotional_buffer / avoid_same_neighbors 受鄰居影響）
    const touched = new Set()
    for (const sid of [s1.id, s2.id]) {
      const occ = ctx.assign.get(sid)
      if (occ) touched.add(occ)
      for (const n of ctx.adj8.get(sid) || []) {
        const on = ctx.assign.get(n)
        if (on) touched.add(on)
      }
    }
    for (const stuId of touched) {
      sc += studentScore(ctx, cfg, ctx.studentById.get(stuId), ctx.seatOf.get(stuId))
    }
    for (const e of groupEval(ctx, affectedGroups)) sc += e.penalty * (cfg[e.ruleId]?.enabled ? cfg[e.ruleId].weight : 0)
    for (const e of heightEval(ctx, affectedCols)) sc += e.penalty * (cfg[e.ruleId]?.enabled ? cfg[e.ruleId].weight : 0)
    return sc
  }
  const before = localScore()
  setAssign(ctx, s1.id, null)
  setAssign(ctx, s2.id, null)
  if (b) setAssign(ctx, s1.id, b)
  if (a) setAssign(ctx, s2.id, a)
  const after = localScore()
  // 還原
  setAssign(ctx, s1.id, null)
  setAssign(ctx, s2.id, null)
  if (a) setAssign(ctx, s1.id, a)
  if (b) setAssign(ctx, s2.id, b)
  return after - before
}

/** 對現有安排做即時評估（手動移動後衝突面板同步更新用） */
export function evaluatePlan({ layout, students, relations = [], prev = null, assignments, rulesConfig }) {
  const cfg = rulesConfig || defaultRulesConfig()
  const ctx = buildContext({ layout, students: students.filter((s) => s.active), relations, prev })
  for (const a of assignments) {
    if (ctx.seatById.get(a.seatId) && ctx.studentById.get(a.studentId)) setAssign(ctx, a.seatId, a.studentId)
  }
  return { score: totalScore(ctx, cfg), violations: fullViolations(ctx, cfg) }
}

/** 解釋某位學生現在的座位（點座位看「為什麼」） */
export function explainStudent({ layout, students, relations = [], prev = null, assignments, studentId }) {
  const ctx = buildContext({ layout, students: students.filter((s) => s.active), relations, prev })
  for (const a of assignments) {
    if (ctx.seatById.get(a.seatId) && ctx.studentById.get(a.studentId)) setAssign(ctx, a.seatId, a.studentId)
  }
  const seatId = ctx.seatOf.get(studentId)
  if (!seatId) return []
  return studentEval(ctx, ctx.studentById.get(studentId), seatId)
}
