// Excel / 剪貼簿名單匯入 — 純函式，可單元測試
// 流程：原始資料 → rows(二維陣列) → guessMapping 猜欄位 → buildStudents 產出學生
// 支援「班級」欄位：一份名單含多個班級時可用 splitByClass 分組
import * as XLSX from 'xlsx'
import { createStudent } from '../model/defaults.js'

export const FIELDS = [
  { key: 'className', label: '班級' },
  { key: 'seatNo', label: '座號' },
  { key: 'name', label: '姓名' },
  { key: 'gender', label: '性別' },
  { key: 'height', label: '身高' },
  { key: 'note', label: '備註' },
  { key: 'ignore', label: '（略過）' },
]

const HEADER_KEYWORDS = {
  className: ['班級', '年班', '班別', 'class'],
  seatNo: ['座號', '學號', '號碼', '編號', 'no', 'no.', 'number', 'seat'],
  name: ['姓名', '名字', '學生', 'name'],
  gender: ['性別', 'gender', 'sex'],
  height: ['身高', 'height'],
  note: ['備註', '註記', '說明', 'note', 'remark', 'memo'],
}

/** 貼上的剪貼簿文字 → 二維陣列（Excel 複製為 TSV；也容忍 CSV） */
export function parseClipboard(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')
  if (!lines.length) return []
  const hasTab = lines.some((l) => l.includes('\t'))
  const sep = hasTab ? '\t' : ','
  return lines.map((l) => l.split(sep).map((c) => c.trim()))
}

/** .xlsx / .csv 檔 → 二維陣列（取第一個工作表） */
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  return rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''))
}

function matchKeyword(cell, keywords) {
  const s = String(cell).trim().toLowerCase()
  return keywords.some((k) => s === k || s.includes(k))
}

/** 猜測每一欄對應哪個欄位，並判斷第一列是否為標題列 */
export function guessMapping(rows) {
  const colCount = Math.max(0, ...rows.map((r) => r.length))
  const mapping = new Array(colCount).fill('ignore')
  if (!rows.length) return { mapping, hasHeader: false }

  const header = rows[0]
  let headerHits = 0
  header.forEach((cell, i) => {
    for (const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
      if (matchKeyword(cell, keywords) && !mapping.includes(field)) {
        mapping[i] = field
        headerHits++
        return
      }
    }
  })
  const hasHeader = headerHits > 0
  if (hasHeader) return { mapping, hasHeader }

  // 沒有標題列 → 用資料內容猜：
  // 含「班」字=班級、整欄數字=座號、男/女=性別、其餘第一個文字欄=姓名
  const body = rows.slice(0, 10)
  for (let i = 0; i < colCount; i++) {
    const cells = body.map((r) => r[i] ?? '').filter((c) => c !== '')
    if (!cells.length) continue
    if (cells.every((c) => /班/.test(c) || /^\d{3}$/.test(c)) && cells.some((c) => /班/.test(c)) && !mapping.includes('className')) {
      mapping[i] = 'className'
    } else if (cells.every((c) => /^\d{1,3}$/.test(c)) && !mapping.includes('seatNo')) {
      mapping[i] = 'seatNo'
    } else if (cells.every((c) => /^(男|女|M|F|m|f)$/.test(c)) && !mapping.includes('gender')) {
      mapping[i] = 'gender'
    } else if (!mapping.includes('name')) {
      mapping[i] = 'name'
    }
  }
  return { mapping, hasHeader: false }
}

export function normalizeGender(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (['男', '男生', 'm', 'male', '1'].includes(s)) return 'M'
  if (['女', '女生', 'f', 'female', '2'].includes(s)) return 'F'
  return ''
}

/**
 * rows + mapping → { students, errors }
 * 學生若有班級欄位，會多帶 className 屬性（入庫前用 splitByClass / stripClassName 處理）
 * errors: { row(1-based 原始列號), message }
 */
export function buildStudents(rows, mapping, { hasHeader } = {}) {
  const body = hasHeader ? rows.slice(1) : rows
  const offset = hasHeader ? 2 : 1
  const students = []
  const errors = []
  const hasClassCol = mapping.includes('className')
  // 座號重複檢查：有班級欄時以「班級+座號」為鍵（不同班座號本來就會重複）
  const seenSeatNo = new Map()

  body.forEach((row, idx) => {
    const rowNo = idx + offset
    const rec = {}
    mapping.forEach((field, i) => {
      if (field !== 'ignore') rec[field] = row[i] ?? ''
    })
    const name = String(rec.name || '').trim()
    if (!name) {
      errors.push({ row: rowNo, message: '姓名空白，已略過' })
      return
    }
    const className = String(rec.className || '').trim()
    let seatNo = null
    if (rec.seatNo !== undefined && String(rec.seatNo).trim() !== '') {
      const n = Number(String(rec.seatNo).trim())
      if (Number.isInteger(n) && n > 0) {
        seatNo = n
        const key = hasClassCol ? `${className}#${n}` : String(n)
        if (seenSeatNo.has(key)) {
          errors.push({ row: rowNo, message: `座號 ${n} 與第 ${seenSeatNo.get(key)} 列重複` })
        } else {
          seenSeatNo.set(key, rowNo)
        }
      } else {
        errors.push({ row: rowNo, message: `座號「${rec.seatNo}」不是有效數字` })
      }
    }
    let height = null
    if (rec.height !== undefined && String(rec.height).trim() !== '') {
      const h = Number(String(rec.height).trim())
      if (Number.isFinite(h) && h > 50 && h < 250) height = h
    }
    const stu = createStudent({
      seatNo,
      name,
      gender: normalizeGender(rec.gender),
      height,
      note: String(rec.note || '').trim(),
    })
    if (hasClassCol) stu.className = className
    students.push(stu)
  })
  return { students, errors }
}

/** 依 className 分組 → [{ className, students }]（保持原始出現順序，並移除 className 屬性） */
export function splitByClass(students) {
  const groups = new Map()
  for (const stu of students) {
    const key = stu.className || '（未填班級）'
    if (!groups.has(key)) groups.set(key, [])
    const { className, ...rest } = stu
    groups.get(key).push(rest)
  }
  return [...groups.entries()].map(([className, list]) => ({ className, students: list }))
}

export function stripClassName(students) {
  return students.map(({ className, ...rest }) => rest)
}
