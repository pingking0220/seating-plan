// 座位表 → Excel（格狀排版，可直接列印或再加工）
import * as XLSX from 'xlsx'

/**
 * 依佈局格子輸出座位表
 * viewLayout: 已依視角翻轉過的 layout
 * nameOf: seatId → 顯示文字（座號 姓名）
 */
export function exportSeatGridXlsx({ viewLayout, nameOf, title, filename }) {
  const { cols, rows } = viewLayout.grid
  const grid = Array.from({ length: rows }, () => Array(cols).fill(''))
  for (const s of viewLayout.seats) {
    if (!s.enabled) continue
    grid[s.row][s.col] = nameOf(s.id) || '（空）'
  }
  for (const f of viewLayout.furniture) {
    const label = { board: '【黑板】', podium: '講台', door: '門', window: '窗', cabinet: '櫃', sink: '洗手台', screen: '螢幕' }[f.kind] || f.kind
    for (let c = f.col; c < f.col + f.w; c++)
      for (let r = f.row; r < f.row + f.h; r++)
        if (grid[r] && grid[r][c] === '') grid[r][c] = label
  }
  const aoa = [[title], [], ...grid]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = Array(cols).fill({ wch: 10 })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '座位表')
  XLSX.writeFile(wb, filename)
}
