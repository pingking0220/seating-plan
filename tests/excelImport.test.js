import { describe, it, expect } from 'vitest'
import { parseClipboard, guessMapping, buildStudents, normalizeGender, splitByClass } from '../src/core/io/excelImport.js'

describe('parseClipboard', () => {
  it('解析 Excel 複製的 TSV', () => {
    const rows = parseClipboard('座號\t姓名\t性別\r\n1\t王小明\t男\r\n2\t李小華\t女\r\n')
    expect(rows).toEqual([
      ['座號', '姓名', '性別'],
      ['1', '王小明', '男'],
      ['2', '李小華', '女'],
    ])
  })
  it('無 tab 時退回 CSV', () => {
    expect(parseClipboard('1,王小明\n2,李小華')).toEqual([
      ['1', '王小明'],
      ['2', '李小華'],
    ])
  })
  it('略過空白列', () => {
    expect(parseClipboard('1\t甲\n\n2\t乙\n  \n')).toHaveLength(2)
  })
})

describe('guessMapping', () => {
  it('有標題列：用關鍵字對應', () => {
    const { mapping, hasHeader } = guessMapping([
      ['座號', '姓名', '性別', '備註'],
      ['1', '王小明', '男', ''],
    ])
    expect(hasHeader).toBe(true)
    expect(mapping).toEqual(['seatNo', 'name', 'gender', 'note'])
  })
  it('無標題列：用資料型態猜', () => {
    const { mapping, hasHeader } = guessMapping([
      ['1', '王小明', '男'],
      ['2', '李小華', '女'],
    ])
    expect(hasHeader).toBe(false)
    expect(mapping).toEqual(['seatNo', 'name', 'gender'])
  })
  it('英文標題也認得', () => {
    const { mapping } = guessMapping([['No.', 'Name', 'Sex']])
    expect(mapping).toEqual(['seatNo', 'name', 'gender'])
  })
})

describe('normalizeGender', () => {
  it.each([
    ['男', 'M'], ['女', 'F'], ['M', 'M'], ['f', 'F'],
    ['男生', 'M'], ['1', 'M'], ['2', 'F'], ['', ''], ['?', ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeGender(input)).toBe(expected)
  })
})

describe('buildStudents', () => {
  const rows = [
    ['座號', '姓名', '性別', '身高'],
    ['1', '王小明', '男', '135'],
    ['2', '李小華', '女', ''],
    ['3', '', '男', ''],
    ['2', '張重複', '女', '140'],
    ['x', '陳壞號', '男', ''],
  ]
  const mapping = ['seatNo', 'name', 'gender', 'height']

  it('產出學生並回報錯誤', () => {
    const { students, errors } = buildStudents(rows, mapping, { hasHeader: true })
    expect(students).toHaveLength(4) // 空姓名被略過
    expect(students[0]).toMatchObject({ seatNo: 1, name: '王小明', gender: 'M', height: 135 })
    expect(students[1]).toMatchObject({ seatNo: 2, name: '李小華', gender: 'F', height: null })
    const messages = errors.map((e) => e.message).join('|')
    expect(messages).toContain('姓名空白')
    expect(messages).toContain('重複')
    expect(messages).toContain('不是有效數字')
    // 錯誤列號對應原始檔案列號（含標題列）
    expect(errors.find((e) => e.message.includes('姓名空白')).row).toBe(4)
  })
  it('無標題列時列號從 1 起算', () => {
    const { students } = buildStudents([['1', '甲'], ['2', '乙']], ['seatNo', 'name'], { hasHeader: false })
    expect(students.map((s) => s.name)).toEqual(['甲', '乙'])
  })
})

describe('班級欄位（三欄名單：班級/座號/姓名）', () => {
  const rows = [
    ['班級', '座號', '姓名'],
    ['五年一班', '1', '王小明'],
    ['五年一班', '2', '李小華'],
    ['五年二班', '1', '張大同'],
    ['五年二班', '2', '陳美美'],
  ]

  it('標題列認得「班級」', () => {
    const { mapping, hasHeader } = guessMapping(rows)
    expect(hasHeader).toBe(true)
    expect(mapping).toEqual(['className', 'seatNo', 'name'])
  })

  it('無標題列時用「班」字猜出班級欄', () => {
    const { mapping } = guessMapping(rows.slice(1))
    expect(mapping).toEqual(['className', 'seatNo', 'name'])
  })

  it('不同班的相同座號不算重複', () => {
    const { students, errors } = buildStudents(rows, ['className', 'seatNo', 'name'], { hasHeader: true })
    expect(students).toHaveLength(4)
    expect(errors).toHaveLength(0)
  })

  it('splitByClass 依班級分組並移除 className', () => {
    const { students } = buildStudents(rows, ['className', 'seatNo', 'name'], { hasHeader: true })
    const groups = splitByClass(students)
    expect(groups.map((g) => g.className)).toEqual(['五年一班', '五年二班'])
    expect(groups[0].students).toHaveLength(2)
    expect(groups[0].students[0]).not.toHaveProperty('className')
    expect(groups[0].students[0]).toMatchObject({ seatNo: 1, name: '王小明' })
  })
})
