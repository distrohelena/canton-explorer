import { createRouter, createWebHistory } from 'vue-router';
import OperationsDashboardView from './views/OperationsDashboardView.vue';
import NodeDetailView from './views/NodeDetailView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: OperationsDashboardView },
    { path: '/nodes/:id', component: NodeDetailView, props: true },
  ],
});
