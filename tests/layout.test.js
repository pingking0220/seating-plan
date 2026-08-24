import { describe, it, expect } from 'vitest'
import { generateSeats, requiredGrid, PATTERNS } from '../src/core/layout/generator.js'
import { PRESETS, buildPreset } from '../src/core/layout/presets.js'
import { computeSeatAttributes } from '../src/core/layout/seatAttributes.js'
import { createLayout, createSeat, createFurniture } from '../src/core/model/defaults.js'

describe('generateSeats', () => {
  it('single 3 組 × 2 排 = 6 座、無分組', () => {
    const seats = generateSeats({ pattern: 'single', groupsPerRow: 3, rows: 2 })
    expect(seats).toHaveLength(6)
    expect(seats.every((s) => s.groupId === null)).toBe(true)
  })
  it('island4 2 組 = 8 座、分 2 組', () => {
    const seats = generateSeats({ pattern: 'island4', groupsPerRow: 2, rows: 1 })
    expect(seats).toHaveLength(8)
    expect(new Set(seats.map((s) => s.groupId)).size).toBe(2)
  })
  it('座位不重疊', () => {
    for (const pattern of Object.keys(PATTERNS)) {
      const seats = generateSeats({ pattern, groupsPerRow: 3, rows: 3 })
      const keys = seats.map((s) => `${s.col},${s.row}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
  it('requiredGrid 容得下所有座位', () => {
    const p = { pattern: 'island6', groupsPerRow: 4, rows: 2 }
    const grid = requiredGrid(p)
    const seats = generateSeats(p)
    expect(Math.max(...seats.map((s) => s.col))).toBeLessThan(grid.cols)
    expect(Math.max(...seats.map((s) => s.row))).toBeLessThan(grid.rows)
  })
})

describe('PRESETS', () => {
  it.each(PRESETS.map((p) => [p.id, p]))('%s：座位在格內且不重疊、不壓到家具', (id) => {
    const layout = buildPreset(id)
    expect(layout.seats.length).toBeGreaterThan(15)
    const occupied = new Set()
    for (const f of layout.furniture) {
      for (let c = f.col; c < f.col + f.w; c++)
        for (let r = f.row; r < f.row + f.h; r++) occupied.add(`${c},${r}`)
    }
    for (const s of layout.seats) {
      expect(s.col).toBeGreaterThanOrEqual(0)
      expect(s.row).toBeGreaterThanOrEqual(0)
      expect(s.col, `${id} seat col`).toBeLessThan(layout.grid.cols)
      expect(s.row, `${id} seat row`).toBeLessThan(layout.grid.rows)
      const key = `${s.col},${s.row}`
      expect(occupied.has(key), `${id} 座位 ${key} 重疊`).toBe(false)
      occupied.add(key)
    }
  })
})

describe('computeSeatAttributes', () => {
  it('前排 / 靠窗 / 靠門 / 走道側', () => {
    const layout = createLayout({
      grid: { cols: 8, rows: 6 },
      front: 'top',
      seats: [
        createSeat({ id: 'a', col: 1, row: 2 }), // 前排、靠窗(0,2)、走道側
        createSeat({ id: 'b', col: 2, row: 2 }), // 前排
        createSeat({ id: 'c', col: 1, row: 3 }), // 非前排
        createSeat({ id: 'd', col: 6, row: 3 }), // 靠門(7,3)、走道側
      ],
      furniture: [
        createFurniture('window', { col: 0, row: 2 }),
        createFurniture('door', { col: 7, row: 3 }),
      ],
    })
    const attrs = computeSeatAttributes(layout)
    expect(attrs.get('a')).toContain('front_row')
    expect(attrs.get('a')).toContain('window')
    expect(attrs.get('b')).toContain('front_row')
    expect(attrs.get('b')).not.toContain('window')
    expect(attrs.get('c')).not.toContain('front_row')
    expect(attrs.get('d')).toContain('door')
    expect(attrs.get('d')).toContain('aisle')
  })
  it('停用座位不列入前排計算', () => {
    const layout = createLayout({
      grid: { cols: 5, rows: 5 },
      seats: [
        createSeat({ id: 'x', col: 1, row: 1, enabled: false }),
        createSeat({ id: 'y', col: 1, row: 2 }),
      ],
      furniture: [],
    })
    const attrs = computeSeatAttributes(layout)
    expect(attrs.get('y')).toContain('front_row')
  })
})
