import { createRouter, createWebHistory } from 'vue-router';
import HomeActivityView from './views/HomeActivityView.vue';
import NodesView from './views/NodesView.vue';
import NodeUpdatesView from './views/NodeUpdatesView.vue';
import NodeDetailView from './views/NodeDetailView.vue';
import UpdateDetailView from './views/UpdateDetailView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeActivityView },
    { path: '/nodes', component: NodesView },
    { path: '/nodes/:id/updates', component: NodeUpdatesView, props: true },
    { path: '/nodes/:id/updates/:updateId', component: UpdateDetailView, props: true },
    { path: '/nodes/:id', component: NodeDetailView, props: true },
  ],
});
