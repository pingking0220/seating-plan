// 計分：每條規則對「某學生坐某座位」的懲罰值與說明
// penalty 0 = 滿足；>0 依權重加總成總分（越低越好）

/** 單一學生在 seatId 的所有規則評估（個別需求 + 人際 + 輪替） */
export function studentEval(ctx, stu, seatId) {
  const out = []
  const seat = ctx.seatById.get(seatId)
  const attrs = ctx.attrs.get(seatId) || []
  const t = (id) => stu.traits?.includes(id)

  if (t('wheelchair')) {
    if (ctx.accessibleSeats.size > 0) {
      const ok = seat.tags.includes('accessible')
      out.push({ ruleId: 'wheelchair', penalty: ok ? 0 : 3, message: ok ? '無障礙座 ✓' : '不是無障礙座位' })
    } else {
      const ok = attrs.includes('aisle')
      out.push({ ruleId: 'wheelchair', penalty: ok ? 0 : 2, message: ok ? '走道側 ✓（教室無無障礙座）' : '輪椅生未在走道側' })
    }
  }
  if (t('need_front')) {
    const rank = ctx.rowRank.get(seatId) ?? 9
    const ok = rank <= 1
    out.push({ ruleId: 'need_front', penalty: ok ? 0 : Math.min(rank - 1, 3), message: ok ? '前排 ✓' : `需前排，目前在第 ${rank + 1} 排` })
  }
  if (t('near_teacher')) {
    const ok = ctx.nearTeacherSeats.has(seatId)
    out.push({ ruleId: 'near_teacher', penalty: ok ? 0 : 1, message: ok ? '靠近教師 ✓' : '離講台太遠' })
  }
  if (t('easily_distracted')) {
    const bad = attrs.includes('window') || attrs.includes('door')
    out.push({ ruleId: 'easily_distracted', penalty: bad ? 1 : 0, message: bad ? '易分心但靠窗/門' : '遠離門窗 ✓' })
  }
  if (t('left_handed')) {
    const leftSeat = ctx.byGrid.get(`${seat.col - 1},${seat.row}`)
    const bad = leftSeat && leftSeat.enabled
    out.push({ ruleId: 'left_handed', penalty: bad ? 1 : 0, message: bad ? '左手邊有座位（寫字會打架）' : '左手邊淨空 ✓' })
  }
  if (t('emotional_buffer')) {
    const occ = [...(ctx.adj.get(seatId) || [])].filter((n) => ctx.assign.get(n)).length
    out.push({ ruleId: 'emotional_buffer', penalty: occ, message: occ ? `旁邊有 ${occ} 個相鄰同學` : '保有緩衝空間 ✓' })
  }

  // 人際關係（雙向都算，總分一致倍增不影響最佳化；回報時由 a 方去重）
  for (const rel of ctx.relationsOf.get(stu.id) || []) {
    const otherId = rel.a === stu.id ? rel.b : rel.a
    const otherSeat = ctx.seatOf.get(otherId)
    if (!otherSeat) continue
    const otherName = ctx.studentById.get(otherId)?.name || '?'
    const adjacent = ctx.adj8.get(seatId)?.has(otherSeat)
    const sameGroup = !!seat.groupId && seat.groupId === ctx.seatById.get(otherSeat)?.groupId
    if (rel.type === 'forbid_adjacent') {
      out.push({ ruleId: 'rel_forbid_adjacent', penalty: adjacent ? 2 : 0, message: adjacent ? `與 ${otherName} 相鄰（設定為不可相鄰）` : `與 ${otherName} 分開 ✓`, relId: rel.id, isA: rel.a === stu.id })
    } else if (rel.type === 'prefer_adjacent') {
      out.push({ ruleId: 'rel_prefer_adjacent', penalty: adjacent ? 0 : 1, message: adjacent ? `與 ${otherName} 相鄰 ✓` : `未與 ${otherName} 相鄰`, relId: rel.id, isA: rel.a === stu.id })
    } else if (rel.type === 'forbid_same_group') {
      out.push({ ruleId: 'rel_forbid_same_group', penalty: sameGroup ? 2 : 0, message: sameGroup ? `與 ${otherName} 同組（設定為不可同組）` : `與 ${otherName} 不同組 ✓`, relId: rel.id, isA: rel.a === stu.id })
    } else if (rel.type === 'forbid_same_row') {
      const sameRow = seat.row === ctx.seatById.get(otherSeat)?.row
      out.push({ ruleId: 'rel_forbid_same_row', penalty: sameRow ? 2 : 0, message: sameRow ? `與 ${otherName} 同一橫列（設定為不可同列）` : `與 ${otherName} 不同列 ✓`, relId: rel.id, isA: rel.a === stu.id })
    } else if (rel.type === 'forbid_same_col') {
      const sameCol = seat.col === ctx.seatById.get(otherSeat)?.col
      out.push({ ruleId: 'rel_forbid_same_col', penalty: sameCol ? 2 : 0, message: sameCol ? `與 ${otherName} 同一直行（設定為不可同行）` : `與 ${otherName} 不同行 ✓`, relId: rel.id, isA: rel.a === stu.id })
    } else if (rel.type === 'prefer_same_group') {
      out.push({ ruleId: 'rel_prefer_same_group', penalty: sameGroup ? 0 : 1, message: sameGroup ? `與 ${otherName} 同組 ✓` : `未與 ${otherName} 同組`, relId: rel.id, isA: rel.a === stu.id })
    }
  }

  // 公平輪替
  if (ctx.prev) {
    if (ctx.prev.seatOf?.[stu.id] === seatId) {
      out.push({ ruleId: 'avoid_same_seat', penalty: 1, message: '和上次坐同一個座位' })
    }
    const prevN = ctx.prev.neighborsOf?.[stu.id]
    if (prevN?.length) {
      const cur = [...(ctx.adj.get(seatId) || [])].map((n) => ctx.assign.get(n)).filter(Boolean)
      const repeat = cur.filter((id) => prevN.includes(id)).length
      if (repeat) out.push({ ruleId: 'avoid_same_neighbors', penalty: repeat, message: `有 ${repeat} 位鄰座和上次相同` })
    }
  }
  return out
}

/** 組層級：性別平衡 */
export function groupEval(ctx, onlyGroupIds = null) {
  const out = []
  const groups = new Map()
  for (const [seatId, stuId] of ctx.assign) {
    const g = ctx.seatById.get(seatId)?.groupId
    if (!g) continue
    if (onlyGroupIds && !onlyGroupIds.has(g)) continue
    if (!groups.has(g)) groups.set(g, { M: 0, F: 0 })
    const gender = ctx.studentById.get(stuId)?.gender
    if (gender === 'M') groups.get(g).M++
    else if (gender === 'F') groups.get(g).F++
  }
  for (const [g, { M, F }] of groups) {
    const diff = Math.abs(M - F)
    if (diff > 1) out.push({ ruleId: 'group_gender_balance', penalty: diff - 1, message: `${g} 組性別失衡（男 ${M}・女 ${F}）`, groupId: g })
  }
  return out
}

/** 直行身高排序：同行後排比前排矮超過 10cm 記一筆 */
export function heightEval(ctx, onlyCols = null) {
  const out = []
  const cols = new Map()
  for (const [seatId, stuId] of ctx.assign) {
    const seat = ctx.seatById.get(seatId)
    const h = ctx.studentById.get(stuId)?.height
    if (h == null) continue
    if (onlyCols && !onlyCols.has(seat.col)) continue
    if (!cols.has(seat.col)) cols.set(seat.col, [])
    cols.get(seat.col).push({ row: seat.row, h, stuId })
  }
  for (const [col, list] of cols) {
    list.sort((a, b) => a.row - b.row)
    for (let i = 1; i < list.length; i++) {
      if (list[i].h < list[i - 1].h - 10) {
        const front = ctx.studentById.get(list[i - 1].stuId)?.name
        const back = ctx.studentById.get(list[i].stuId)?.name
        out.push({ ruleId: 'height_order', penalty: 1, message: `第 ${col + 1} 行：${back} 坐在較高的 ${front} 後面`, col })
      }
    }
  }
  return out
}

function weightOf(cfg, ruleId) {
  const c = cfg[ruleId]
  if (!c || !c.enabled) return 0
  return c.weight
}

/** 學生視角的加權分（局部搜尋用） */
export function studentScore(ctx, cfg, stu, seatId) {
  let s = 0
  for (const e of studentEval(ctx, stu, seatId)) s += e.penalty * weightOf(cfg, e.ruleId)
  return s
}

/** 全域總分 */
export function totalScore(ctx, cfg) {
  let s = 0
  for (const [seatId, stuId] of ctx.assign) {
    s += studentScore(ctx, cfg, ctx.studentById.get(stuId), seatId)
  }
  for (const e of groupEval(ctx)) s += e.penalty * weightOf(cfg, e.ruleId)
  for (const e of heightEval(ctx)) s += e.penalty * weightOf(cfg, e.ruleId)
  for (const e of genderColumnsEval(ctx)) s += e.penalty * weightOf(cfg, e.ruleId)
  for (const e of fillFrontEval(ctx)) s += e.penalty * weightOf(cfg, e.ruleId)
  return s
}

/** 完整違規清單（去重人際關係、附學生名） */
export function fullViolations(ctx, cfg) {
  const out = []
  for (const [seatId, stuId] of ctx.assign) {
    const stu = ctx.studentById.get(stuId)
    for (const e of studentEval(ctx, stu, seatId)) {
      if (e.penalty <= 0 || weightOf(cfg, e.ruleId) <= 0) continue
      if (e.relId && !e.isA) continue // 人際關係只回報 a 方
      out.push({ ruleId: e.ruleId, seatId, studentId: stuId, message: `${stu.name}：${e.message}` })
    }
  }
  for (const e of groupEval(ctx)) if (weightOf(cfg, e.ruleId) > 0) out.push({ ruleId: e.ruleId, message: e.message })
  for (const e of heightEval(ctx)) if (weightOf(cfg, e.ruleId) > 0) out.push({ ruleId: e.ruleId, message: e.message })
  for (const e of genderColumnsEval(ctx)) if (weightOf(cfg, e.ruleId) > 0) out.push({ ruleId: e.ruleId, seatId: e.seatId, studentId: e.studentId, message: e.message })
  for (const e of fillFrontEval(ctx)) if (weightOf(cfg, e.ruleId) > 0) out.push({ ruleId: e.ruleId, seatId: e.seatId, studentId: e.studentId, message: e.message })
  return out
}

/** 男女不同排：每一直行同性別、左右交錯（男女男女…）。
 *  兩種起始相位（最左排男生起 / 女生起）取違規較少者。 */
export function genderColumnsEval(ctx) {
  const cols = [...new Set(ctx.seats.map((s) => s.col))].sort((a, b) => a - b)
  const colIndex = new Map(cols.map((c, i) => [c, i]))
  const entries = [] // { seatId, stuId, name, colIdx, gender }
  for (const [seatId, stuId] of ctx.assign) {
    const g = ctx.studentById.get(stuId)?.gender
    if (g !== 'M' && g !== 'F') continue
    const seat = ctx.seatById.get(seatId)
    entries.push({ seatId, stuId, colIdx: colIndex.get(seat.col), gender: g })
  }
  if (!entries.length) return []
  const mismatches = (phase) =>
    entries.filter((e) => ((e.colIdx + phase) % 2 === 0 ? 'M' : 'F') !== e.gender)
  const m0 = mismatches(0)
  const m1 = mismatches(1)
  const best = m0.length <= m1.length ? m0 : m1
  return best.map((e) => ({
    ruleId: 'gender_alt_columns',
    seatId: e.seatId,
    studentId: e.stuId,
    penalty: 1,
    message: `${ctx.studentById.get(e.stuId).name} 在${e.gender === 'M' ? '女' : '男'}生排（第 ${e.colIdx + 1} 直行）`,
  }))
}

/** 往前坐：以教室前方（黑板）為基準，每一直行各自由前往後坐滿。
 *  每位學生的懲罰 = 同一直行、排在他前面（更靠黑板）的空位數；
 *  空位留在各行最後面是正常的，不算違規。 */
export function fillFrontEval(ctx) {
  const byCol = new Map()
  for (const seat of ctx.seats) {
    if (!byCol.has(seat.col)) byCol.set(seat.col, [])
    byCol.get(seat.col).push(seat)
  }
  const out = []
  for (const [, seats] of byCol) {
    seats.sort((a, b) => (ctx.rowRank.get(a.id) ?? 0) - (ctx.rowRank.get(b.id) ?? 0))
    let emptiesBefore = 0
    for (const seat of seats) {
      const stuId = ctx.assign.get(seat.id)
      if (!stuId) {
        emptiesBefore++
        continue
      }
      if (emptiesBefore > 0) {
        out.push({
          ruleId: 'fill_front',
          seatId: seat.id,
          studentId: stuId,
          penalty: Math.min(emptiesBefore, 5),
          message: `${ctx.studentById.get(stuId).name} 同一直行前面還有 ${emptiesBefore} 個空位`,
        })
      }
    }
  }
  return out
}
