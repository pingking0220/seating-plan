// 座位排列產生器 — 純函式
import { createSeat } from '../model/defaults.js'

/** 各排列模式的「一組」形狀（相對格座標） */
export const PATTERNS = {
  single: { label: '單人獨立', cells: [[0, 0]], w: 1, h: 1, grouped: false },
  pair: { label: '雙人併桌', cells: [[0, 0], [1, 0]], w: 2, h: 1, grouped: true },
  island4: { label: '四人島', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 2, h: 2, grouped: true },
  island6: { label: '六人島', cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], w: 2, h: 3, grouped: true },
}

/**
 * 產生規則排列的座位
 * @param {object} p
 *  pattern: PATTERNS key
 *  groupsPerRow: 每排幾組
 *  rows: 幾排
 *  hGap: 組與組的水平走道格數
 *  vGap: 排與排的垂直間隔格數
 *  startCol/startRow: 起始格
 */
export function generateSeats(p = {}) {
  const {
    pattern = 'single', groupsPerRow = 3, rows = 3,
    hGap = 1, vGap = 1, startCol = 1, startRow = 2,
  } = p
  const shape = PATTERNS[pattern]
  if (!shape) throw new Error(`未知的排列模式：${pattern}`)
  const seats = []
  let groupIndex = 0
  for (let r = 0; r < rows; r++) {
    for (let g = 0; g < groupsPerRow; g++) {
      groupIndex++
      const baseX = startCol + g * (shape.w + hGap)
      const baseY = startRow + r * (shape.h + vGap)
      for (const [dx, dy] of shape.cells) {
        seats.push(createSeat({
          col: baseX + dx,
          row: baseY + dy,
          groupId: shape.grouped ? `g${groupIndex}` : null,
        }))
      }
    }
  }
  return seats
}

/** 排列所需的最小格子空間 */
export function requiredGrid(p = {}) {
  const { pattern = 'single', groupsPerRow = 3, rows = 3, hGap = 1, vGap = 1, startCol = 1, startRow = 2 } = p
  const shape = PATTERNS[pattern]
  return {
    cols: startCol + groupsPerRow * shape.w + (groupsPerRow - 1) * hGap + 1,
    rows: startRow + rows * shape.h + (rows - 1) * vGap + 1,
  }
}
