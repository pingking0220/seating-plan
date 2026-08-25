// 排位規則註冊表 — UI 顯示與權重設定用；實際計分在 solver/scoring.js
export const RULES = [
  { id: 'wheelchair', label: '輪椅生無障礙座', desc: '有無障礙座位就固定坐，沒有則安排走道側', weight: 10, group: '個別需求' },
  { id: 'need_front', label: '需前排', desc: '視力/聽力需求的學生排在前兩排', weight: 8, group: '個別需求' },
  { id: 'near_teacher', label: '靠近教師', desc: '安排在講台/黑板附近兩格內', weight: 7, group: '個別需求' },
  { id: 'emotional_buffer', label: '緩衝空間', desc: '情緒需求學生旁邊保留空位', weight: 6, group: '個別需求' },
  { id: 'easily_distracted', label: '易分心遠離門窗', desc: '避開靠窗、靠門的座位', weight: 5, group: '個別需求' },
  { id: 'left_handed', label: '左撇子座位', desc: '左手邊不安排座位，寫字不打架', weight: 3, group: '個別需求' },
  { id: 'rel_forbid_adjacent', label: '不可相鄰', desc: '指定的兩人不坐相鄰（含斜角）', weight: 10, group: '人際關係' },
  { id: 'rel_forbid_same_group', label: '不可同組', desc: '指定的兩人不同組', weight: 8, group: '人際關係' },
  { id: 'rel_forbid_same_row', label: '不可同列', desc: '指定的兩人不坐同一橫列', weight: 8, group: '人際關係' },
  { id: 'rel_forbid_same_col', label: '不可同行', desc: '指定的兩人不坐同一直行', weight: 8, group: '人際關係' },
  { id: 'rel_prefer_adjacent', label: '建議相鄰', desc: '指定的兩人盡量坐在一起（小老師配對）', weight: 4, group: '人際關係' },
  { id: 'rel_prefer_same_group', label: '建議同組', desc: '指定的兩人盡量同組', weight: 4, group: '人際關係' },
  { id: 'group_gender_balance', label: '分組性別平衡', desc: '每組男女人數差不超過 1', weight: 3, group: '分組品質' },
  { id: 'gender_alt_columns', label: '男女不同排', desc: '每一直行同性別，左右交錯排列（男女男女…）', weight: 5, group: '分組品質' },
  { id: 'height_order', label: '身高由前而後', desc: '同一直行後面的人比前面高（需身高資料）', weight: 2, group: '生理' },
  { id: 'avoid_same_seat', label: '避免同座位', desc: '不坐上次紀錄的同一個座位（需先封存歷史）', weight: 4, group: '公平輪替' },
  { id: 'avoid_same_neighbors', label: '避免同鄰居', desc: '盡量換到不同的鄰座同學', weight: 2, group: '公平輪替' },
]

export function defaultRulesConfig() {
  const cfg = {}
  for (const r of RULES) cfg[r.id] = { enabled: true, weight: r.weight }
  return cfg
}

export function ruleLabel(id) {
  return RULES.find((r) => r.id === id)?.label || id
}

export const RELATION_TYPES = [
  { id: 'forbid_adjacent', label: '不可相鄰' },
  { id: 'prefer_adjacent', label: '建議相鄰' },
  { id: 'forbid_same_group', label: '不可同組' },
  { id: 'forbid_same_row', label: '不可同列（橫）' },
  { id: 'forbid_same_col', label: '不可同行（直）' },
  { id: 'prefer_same_group', label: '建議同組' },
]
