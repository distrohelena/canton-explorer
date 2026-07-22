import { createRouter, createWebHistory } from 'vue-router';
import HomeActivityView from './views/HomeActivityView.vue';
import HomeUpdatesView from './views/HomeUpdatesView.vue';
import PartiesView from './views/PartiesView.vue';
import ContractsView from './views/ContractsView.vue';
import TokensView from './views/TokensView.vue';
import TokenDetailView from './views/TokenDetailView.vue';
import TokenTransferDetailView from './views/TokenTransferDetailView.vue';
import NodeDetailView from './views/NodeDetailView.vue';
import UpdateDetailView from './views/UpdateDetailView.vue';
import ContractDetailView from './views/ContractDetailView.vue';
import PackageDetailView from './views/PackageDetailView.vue';
import PackageFamilyView from './views/PackageFamilyView.vue';
import PartyDetailView from './views/PartyDetailView.vue';
import NamespaceDetailView from './views/NamespaceDetailView.vue';
import SearchResultsView from './views/SearchResultsView.vue';
import LegacyTransactionRedirectView from './views/LegacyTransactionRedirectView.vue';
import SettingsView from './views/SettingsView.vue';
import TrafficPurchasesView from './views/TrafficPurchasesView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeUpdatesView },
    { path: '/nodes', component: HomeActivityView },
    { path: '/parties', component: PartiesView },
    { path: '/contracts', component: ContractsView },
    { path: '/tokens', component: TokensView },
    { path: '/settings', component: SettingsView },
    { path: '/traffic', component: TrafficPurchasesView },
    { path: '/debugger', component: () => import('./views/DebuggerView.vue') },
    { path: '/tokens/transfers/:updateId', component: TokenTransferDetailView, props: true },
    { path: '/tokens/:tokenId', component: TokenDetailView, props: true },
    { path: '/tx/:updateId', component: LegacyTransactionRedirectView, props: true },
    { path: '/search', component: SearchResultsView },
    { path: '/nodes/:id/updates/:eventOffset', component: UpdateDetailView, props: true },
    { path: '/nodes/:id/contracts/:contractId', component: ContractDetailView, props: true },
    { path: '/parties/:partyId', component: PartyDetailView, props: true },
    { path: '/namespaces/:namespaceId', component: NamespaceDetailView, props: true },
    { path: '/packages/by-name/:packageName', component: PackageFamilyView, props: true },
    { path: '/packages/:packageId', component: PackageDetailView, props: true },
    { path: '/nodes/:id', component: NodeDetailView, props: true },
  ],
});
