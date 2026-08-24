// 教室佈局範本庫 — 每個範本回傳完整 layout 物件
import { createLayout, createSeat, createFurniture } from '../model/defaults.js'
import { generateSeats } from './generator.js'

/** 標準教室外框家具：黑板+講台在前（上）、右牆前後門、左牆窗戶 */
function standardRoom(cols, rows) {
  const furniture = [
    createFurniture('board', { col: Math.floor((cols - 5) / 2), row: 0 }),
    createFurniture('podium', { col: Math.floor(cols / 2) - 1, row: 1 }),
    createFurniture('door', { col: cols - 1, row: 1 }),
    createFurniture('door', { col: cols - 1, row: rows - 2 }),
  ]
  for (let r = 2; r < rows - 1; r += 2) {
    furniture.push(createFurniture('window', { col: 0, row: r }))
  }
  return furniture
}

function makePreset({ id, name, description, grid, seats, furniture, extra = {} }) {
  return {
    id, name, description,
    build: () =>
      createLayout({
        name, kind: id,
        grid, seats: seats(), furniture: furniture ? furniture() : standardRoom(grid.cols, grid.rows),
        ...extra,
      }),
  }
}

export const PRESETS = [
  makePreset({
    id: 'rows', name: '傳統排排坐', description: '6 直行 × 5 排，兩行一走道（30 座）',
    grid: { cols: 12, rows: 10 },
    seats: () => generateSeats({ pattern: 'pair', groupsPerRow: 3, rows: 5, hGap: 1, vGap: 0, startCol: 2, startRow: 3 })
      .map((s) => ({ ...s, groupId: null })), // 座位相併但不分組
  }),
  makePreset({
    id: 'pairs', name: '雙人併桌', description: '兩人一組共 15 組（30 座），同組相鄰',
    grid: { cols: 12, rows: 10 },
    seats: () => generateSeats({ pattern: 'pair', groupsPerRow: 3, rows: 5, hGap: 1, vGap: 0, startCol: 2, startRow: 3 }),
  }),
  makePreset({
    id: 'island4', name: '四人島', description: '2×2 分組島 × 8 組（32 座），適合分組討論',
    grid: { cols: 14, rows: 11 },
    seats: () => generateSeats({ pattern: 'island4', groupsPerRow: 4, rows: 2, hGap: 1, vGap: 1, startCol: 2, startRow: 3 }),
  }),
  makePreset({
    id: 'island6', name: '六人島', description: '2×3 分組島 × 5 組（30 座）',
    grid: { cols: 17, rows: 10 },
    seats: () => generateSeats({ pattern: 'island6', groupsPerRow: 5, rows: 1, hGap: 1, vGap: 1, startCol: 1, startRow: 3 }),
  }),
  makePreset({
    id: 'ushape', name: 'ㄇ字型', description: '沿三面牆圍坐、面向中央，適合發表與討論',
    grid: { cols: 14, rows: 10 },
    seats: () => {
      const seats = []
      for (let r = 3; r <= 7; r++) {
        seats.push(createSeat({ col: 2, row: r, rotation: 90 }))
        seats.push(createSeat({ col: 11, row: r, rotation: 270 }))
      }
      for (let c = 3; c <= 10; c++) {
        seats.push(createSeat({ col: c, row: 8, rotation: 0 }))
      }
      return seats
    },
  }),
  makePreset({
    id: 'circle', name: '圓圈圍坐', description: '全班圍成一圈，班會、綜合活動',
    grid: { cols: 14, rows: 11 },
    seats: () => {
      const cx = 6.5, cy = 6, rx = 5, ry = 3.5, n = 24
      const used = new Set()
      const seats = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const col = Math.round(cx + rx * Math.sin(a))
        const row = Math.round(cy - ry * Math.cos(a))
        const key = `${col},${row}`
        if (used.has(key)) continue
        used.add(key)
        const deg = Math.round((a * 180) / Math.PI / 90) * 90 % 360
        seats.push(createSeat({ col, row, rotation: (deg + 180) % 360 })) // 面向圓心（近似）
      }
      return seats
    },
  }),
  makePreset({
    id: 'computer', name: '電腦教室', description: '沿三面牆面壁機位（固定電腦座）',
    grid: { cols: 14, rows: 10 },
    seats: () => {
      const seats = []
      for (let r = 2; r <= 8; r++) {
        seats.push(createSeat({ col: 1, row: r, rotation: 270, tags: ['fixed_pc'] }))
        seats.push(createSeat({ col: 12, row: r, rotation: 90, tags: ['fixed_pc'] }))
      }
      for (let c = 3; c <= 10; c++) {
        seats.push(createSeat({ col: c, row: 8, rotation: 180, tags: ['fixed_pc'] }))
      }
      return seats
    },
    furniture: () => [
      createFurniture('board', { col: 4, row: 0 }),
      createFurniture('screen', { col: 10, row: 0 }),
      createFurniture('door', { col: 13, row: 1 }),
    ],
  }),
  makePreset({
    id: 'lab', name: '自然實驗室', description: '六張實驗桌各 4 人，含洗手台',
    grid: { cols: 14, rows: 11 },
    seats: () =>
      generateSeats({ pattern: 'island4', groupsPerRow: 3, rows: 2, hGap: 2, vGap: 2, startCol: 2, startRow: 3 })
        .map((s) => ({ ...s, tags: ['lab_bench'] })),
    furniture: () => [
      createFurniture('board', { col: 4, row: 0 }),
      createFurniture('podium', { col: 6, row: 1 }),
      createFurniture('door', { col: 13, row: 1 }),
      createFurniture('sink', { col: 0, row: 4 }),
      createFurniture('sink', { col: 0, row: 8 }),
      createFurniture('sink', { col: 13, row: 8 }),
    ],
  }),
  makePreset({
    id: 'exam', name: '考試模式', description: '單人單桌、間隔最大化（30 座）',
    grid: { cols: 13, rows: 12 },
    seats: () => generateSeats({ pattern: 'single', groupsPerRow: 6, rows: 5, hGap: 1, vGap: 1, startCol: 1, startRow: 2 }),
  }),
]

export function buildPreset(id) {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`未知的範本：${id}`)
  return preset.build()
}
