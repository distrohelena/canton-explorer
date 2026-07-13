import { render, screen, within } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { expect, it } from 'vitest';
import type { PackageTypeNode } from '../types/packages';
import DebuggerValueTree from './DebuggerValueTree.vue';

const baseDepositSchema: PackageTypeNode = {
  kind: 'record',
  label: 'Oz.Vault.Base.Core:BaseDeposit',
  fields: [
    { name: 'caller', type: { kind: 'builtin', label: 'Party' } },
    { name: 'receiver', type: { kind: 'builtin', label: 'Party' } },
    { name: 'snapshotCid', type: { kind: 'builtin', label: 'ContractId' } },
    { name: 'assetHoldingCids', type: { kind: 'builtin', label: 'List' } },
    { name: 'assets', type: { kind: 'builtin', label: 'Numeric', arguments: [{ kind: 'nat', label: '10' }] } },
  ],
};

it('matches named record fields to their schema even when display keys are sorted', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/contracts', component: { template: '<div>Contracts</div>' } },
      { path: '/parties/:partyId', component: { template: '<div>Party</div>' } },
      { path: '/nodes/:id/contracts/:contractId', component: { template: '<div>Contract</div>' } },
    ],
  });
  router.push('/');
  await router.isReady();

  render(DebuggerValueTree, {
    props: {
      nodeId: 'cnqs-extra-1',
      schemaNode: baseDepositSchema,
      value: {
        caller: { __damlLfParty: 'alice' },
        receiver: { __damlLfParty: 'bob' },
        snapshotCid: { __damlLfContractId: '00snapshot' },
        assetHoldingCids: [{ __damlLfContractId: '00holding' }],
        assets: { __damlLfNumeric: '0.0014075538' },
        __damlLfRecordId: {
          packageId: 'package-id',
          moduleName: 'Oz.Vault.Base.Core',
          entityName: 'BaseDeposit',
        },
      },
    },
    global: { plugins: [router] },
  });

  const caller = screen.getByText('caller').closest('li');
  const assets = screen.getByText('assets').closest('li');
  const holdings = screen.getByText('assetHoldingCids').closest('li');

  expect(caller).not.toBeNull();
  expect(assets).not.toBeNull();
  expect(holdings).not.toBeNull();
  expect(within(caller!).getByRole('link', { name: 'alice' })).toBeInTheDocument();
  expect(within(assets!).getByText('Numeric<10>')).toBeInTheDocument();
  expect(within(assets!).getByText('0.0014075538')).toBeInTheDocument();
  expect(within(holdings!).getAllByText('List')).toHaveLength(2);
  expect(within(holdings!).getByRole('link', { name: '00holding' })).toBeInTheDocument();
});
