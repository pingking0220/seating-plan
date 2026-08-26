import { defineStore } from 'pinia'
import { loadWorkspace, saveWorkspace } from '@/persistence/db.js'
import { createClass, createStudent, createWorkspace } from '@/core/model/defaults.js'

let saveTimer = null

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    loaded: false,
    ws: createWorkspace(),
  }),
  getters: {
    classes: (s) => s.ws.classes,
    classById: (s) => (id) => s.ws.classes.find((c) => c.id === id),
    layouts: (s) => s.ws.layouts,
    plans: (s) => s.ws.plans,
    planById: (s) => (id) => s.ws.plans.find((p) => p.id === id),
    layoutById: (s) => (id) => s.ws.layouts.find((l) => l.id === id),
  },
  actions: {
    async init() {
      if (this.loaded) return
      this.ws = await loadWorkspace()
      this.loaded = true
    },
    persist() {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => saveWorkspace(this.ws), 400)
    },
    touch(cls) {
      cls.updatedAt = Date.now()
      this.persist()
    },

    addClass(name, year = '') {
      const cls = createClass({ name, year })
      this.ws.classes.push(cls)
      this.persist()
      return cls
    },
    removeClass(id) {
      this.ws.classes = this.ws.classes.filter((c) => c.id !== id)
      this.persist()
    },
    renameClass(id, name) {
      const cls = this.classById(id)
      if (cls) { cls.name = name; this.touch(cls) }
    },

    /** 全域匯入：依班級名稱建立或更新多個班級，回傳統計 */
    importClassGroups(groups) {
      let created = 0, updated = 0, firstId = null
      for (const g of groups) {
        const name = g.className || '未命名班級'
        let cls = this.ws.classes.find((c) => c.name === name)
        if (cls) { cls.students = g.students; updated++ }
        else { cls = createClass({ name, students: g.students }); this.ws.classes.push(cls); created++ }
        this.sortStudents(cls)
        cls.updatedAt = Date.now()
        if (!firstId) firstId = cls.id
      }
      this.persist()
      return { created, updated, firstId }
    },

    /** 匯入學生：mode = 'replace' 全部取代 | 'append' 附加 */
    importStudents(classId, students, mode = 'replace') {
      const cls = this.classById(classId)
      if (!cls) return
      if (mode === 'replace') cls.students = students
      else cls.students.push(...students)
      this.sortStudents(cls)
      this.touch(cls)
    },
    addStudent(classId) {
      const cls = this.classById(classId)
      if (!cls) return null
      const maxNo = Math.max(0, ...cls.students.map((s) => s.seatNo || 0))
      const stu = createStudent({ seatNo: maxNo + 1 })
      cls.students.push(stu)
      this.touch(cls)
      return stu
    },
    removeStudent(classId, studentId) {
      const cls = this.classById(classId)
      if (!cls) return
      cls.students = cls.students.filter((s) => s.id !== studentId)
      this.touch(cls)
    },
    toggleTrait(classId, studentId, traitId) {
      const cls = this.classById(classId)
      const stu = cls?.students.find((s) => s.id === studentId)
      if (!stu) return
      const i = stu.traits.indexOf(traitId)
      if (i >= 0) stu.traits.splice(i, 1)
      else stu.traits.push(traitId)
      this.touch(cls)
    },
    addPoints(classId, studentId, delta) {
      const cls = this.classById(classId)
      const stu = cls?.students.find((s) => s.id === studentId)
      if (!stu) return
      stu.points = (stu.points || 0) + delta
      this.touch(cls)
    },
    resetPoints(classId) {
      const cls = this.classById(classId)
      if (!cls) return
      for (const s of cls.students) s.points = 0
      this.touch(cls)
    },
    addCustomTrait(classId, label) {
      const cls = this.classById(classId)
      if (!cls || !label.trim()) return null
      const trait = { id: 'c_' + Math.random().toString(36).slice(2, 8), label: label.trim() }
      cls.customTraits.push(trait)
      this.touch(cls)
      return trait
    },
    sortStudents(cls) {
      cls.students.sort((a, b) => (a.seatNo ?? 999) - (b.seatNo ?? 999))
    },
    /* ---------- 教室佈局 ---------- */
    addLayout(layout) {
      this.ws.layouts.push(layout)
      this.persist()
      return layout
    },
    removeLayout(id) {
      this.ws.layouts = this.ws.layouts.filter((l) => l.id !== id)
      this.persist()
    },
    duplicateLayout(id) {
      const src = this.layoutById(id)
      if (!src) return
      const copy = JSON.parse(JSON.stringify(src))
      copy.id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
      copy.name = src.name + '（複製）'
      copy.createdAt = copy.updatedAt = Date.now()
      this.ws.layouts.push(copy)
      this.persist()
    },
    touchLayout(layout) {
      layout.updatedAt = Date.now()
      this.persist()
    },

    /* ---------- 座位表 ---------- */
    addPlan(plan) {
      this.ws.plans.push(plan)
      this.persist()
      return plan
    },
    removePlan(id) {
      this.ws.plans = this.ws.plans.filter((p) => p.id !== id)
      this.persist()
    },
    touchPlan(plan) {
      plan.updatedAt = Date.now()
      this.persist()
    },

    /* ---------- 人際關係 ---------- */
    addRelation(classId, a, b, type) {
      const cls = this.classById(classId)
      if (!cls || !a || !b || a === b) return
      const dup = cls.relations.find((r) => r.type === type && ((r.a === a && r.b === b) || (r.a === b && r.b === a)))
      if (dup) return
      cls.relations.push({ id: Math.random().toString(36).slice(2, 8), a, b, type })
      this.touch(cls)
    },
    removeRelation(classId, relId) {
      const cls = this.classById(classId)
      if (!cls) return
      cls.relations = cls.relations.filter((r) => r.id !== relId)
      this.touch(cls)
    },

    /* ---------- 輪替歷史 ---------- */
    archivePlan(plan, layout) {
      const seatOf = {}
      const byGrid = new Map(layout.seats.map((st) => [st.col + ',' + st.row, st]))
      const neighborsOf = {}
      const occupant = new Map(plan.assignments.map((a) => [a.seatId, a.studentId]))
      const seatById = new Map(layout.seats.map((st) => [st.id, st]))
      for (const a of plan.assignments) {
        seatOf[a.studentId] = a.seatId
        const seat = seatById.get(a.seatId)
        if (!seat) continue
        const ns = []
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = byGrid.get(seat.col + dc + ',' + (seat.row + dr))
          if (n && occupant.get(n.id)) ns.push(occupant.get(n.id))
        }
        neighborsOf[a.studentId] = ns
      }
      if (!this.ws.history[plan.classId]) this.ws.history[plan.classId] = []
      this.ws.history[plan.classId].push({
        date: Date.now(), planId: plan.id, layoutId: plan.layoutId, seatOf, neighborsOf,
      })
      // 只留最近 12 筆
      this.ws.history[plan.classId] = this.ws.history[plan.classId].slice(-12)
      this.persist()
    },
    lastRecordOf(classId) {
      const list = this.ws.history[classId]
      return list?.length ? list[list.length - 1] : null
    },

    /* ---------- 備份還原 ---------- */
    markBackedUp() {
      this.ws.settings.lastBackupAt = Date.now()
      this.persist()
    },
    replaceWorkspace(ws) {
      this.ws = ws
      this.persist()
    },
  },
})
