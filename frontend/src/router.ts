import { createRouter, createWebHistory } from 'vue-router';
import HomeActivityView from './views/HomeActivityView.vue';
import NodesView from './views/NodesView.vue';
import PartiesView from './views/PartiesView.vue';
import ContractsView from './views/ContractsView.vue';
import NodeUpdatesView from './views/NodeUpdatesView.vue';
import NodeDetailView from './views/NodeDetailView.vue';
import UpdateDetailView from './views/UpdateDetailView.vue';
import ContractDetailView from './views/ContractDetailView.vue';
import PackageDetailView from './views/PackageDetailView.vue';
import PackageFamilyView from './views/PackageFamilyView.vue';
import PartyDetailView from './views/PartyDetailView.vue';
import SearchResultsView from './views/SearchResultsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeActivityView },
    { path: '/nodes', component: NodesView },
    { path: '/parties', component: PartiesView },
    { path: '/contracts', component: ContractsView },
    { path: '/search', component: SearchResultsView },
    { path: '/nodes/:id/updates', component: NodeUpdatesView, props: true },
    { path: '/nodes/:id/updates/:eventOffset', component: UpdateDetailView, props: true },
    { path: '/nodes/:id/contracts/:contractId', component: ContractDetailView, props: true },
    { path: '/parties/:partyId', component: PartyDetailView, props: true },
    { path: '/packages/by-name/:packageName', component: PackageFamilyView, props: true },
    { path: '/packages/:packageId', component: PackageDetailView, props: true },
    { path: '/nodes/:id', component: NodeDetailView, props: true },
  ],
});
