import { createRouter, createWebHashHistory } from 'vue-router'
import ClassesView from '@/views/ClassesView.vue'

const router = createRouter({
  // hash 模式：靜態託管不需要 SPA fallback 設定
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'classes', component: ClassesView },
    { path: '/class/:id', name: 'roster', component: () => import('@/views/RosterView.vue') },
    { path: '/layouts', name: 'layouts', component: () => import('@/views/LayoutsView.vue') },
    { path: '/layout/:id', name: 'layout-editor', component: () => import('@/views/LayoutEditorView.vue') },
    { path: '/plans', name: 'plans', component: () => import('@/views/PlansView.vue') },
    { path: '/plan/:id', name: 'seating', component: () => import('@/views/SeatingView.vue') },
    { path: '/help', name: 'help', component: () => import('@/views/HelpView.vue') },
  ],
})

export default router
