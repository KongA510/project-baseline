// ============================================================
// 路由配置
// ============================================================

import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/snapshots',
      name: 'snapshots',
      component: () => import('@/views/SnapshotListView.vue'),
    },
    {
      path: '/compare',
      name: 'compare',
      component: () => import('@/views/CompareView.vue'),
    },
    {
      path: '/compare/:id1/:id2',
      name: 'compare-result',
      component: () => import('@/views/CompareResultView.vue'),
    },
  ],
})

export default router
