import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('../lib/api', async () => ({
  fetchPackageDetail: vi.fn(async (packageId: string) => {
    if (packageId !== '5498e10ecf8a0ab37087e255ef6f74af45d09b981a55119cfb0c750b6638c969') {
      throw new Error(`Unknown package ${packageId}`);
    }

    return {
      packageId,
      name: 'oz-vault-base',
      version: '1.0.0',
      uploadedAt: null,
      packageSize: null,
      status: 'decoded',
      seenOnNodes: [],
      moduleCount: 1,
      templateCount: 1,
      dataTypeCount: 1,
      modules: ['Oz.Vault.Base.Core'],
      templates: [],
      dataTypes: [
        {
          typeId: 'Oz.Vault.Base.Core:BaseVault',
          moduleName: 'Oz.Vault.Base.Core',
          entityName: 'BaseVault',
          definition: {
            kind: 'record',
            label: 'Oz.Vault.Base.Core:BaseVault',
            packageId,
            typeId: 'Oz.Vault.Base.Core:BaseVault',
            fields: [
              {
                name: 'vaultIdentity',
                type: {
                  kind: 'type_con',
                  label: 'Oz.Vault.Base.Core:VaultIdentity',
                  packageId,
                  typeId: 'Oz.Vault.Base.Core:VaultIdentity',
                  definition: {
                    kind: 'record',
                    label: 'Oz.Vault.Base.Core:VaultIdentity',
                    packageId,
                    typeId: 'Oz.Vault.Base.Core:VaultIdentity',
                    fields: [
                      {
                        name: 'owner',
                        type: {
                          kind: 'builtin',
                          label: 'Party',
                        },
                      },
                      {
                        name: 'name',
                        type: {
                          kind: 'builtin',
                          label: 'Text',
                        },
                      },
                    ],
                  },
                },
              },
              {
                name: 'vaultParty',
                type: {
                  kind: 'builtin',
                  label: 'Party',
                },
              },
              {
                name: 'assetInstrumentId',
                type: {
                  kind: 'type_con',
                  label: 'HoldingV2.InstrumentId',
                },
              },
              {
                name: 'shareTokenCid',
                type: {
                  kind: 'builtin',
                  label: 'ContractId',
                  arguments: [
                    {
                      kind: 'type_con',
                      label: 'Oz.Vault.Base.ShareToken.CIP112:ReferenceShareToken',
                    },
                  ],
                },
              },
              {
                name: 'virtualAssets',
                type: {
                  kind: 'builtin',
                  label: 'Decimal',
                },
              },
              {
                name: 'virtualShares',
                type: {
                  kind: 'builtin',
                  label: 'Decimal',
                },
              },
              {
                name: 'maxInstructionLifetime',
                type: {
                  kind: 'struct',
                  label: 'Struct',
                  fields: [
                    {
                      name: 'microseconds',
                      type: {
                        kind: 'builtin',
                        label: 'Int64',
                      },
                    },
                  ],
                },
              },
              {
                name: 'name',
                type: {
                  kind: 'builtin',
                  label: 'Text',
                },
              },
              {
                name: 'symbol',
                type: {
                  kind: 'builtin',
                  label: 'Text',
                },
              },
            ],
          },
        },
      ],
    };
  }),
}));

import DebuggerScopePanel from './DebuggerScopePanel.vue';

describe('DebuggerScopePanel', () => {
  afterEach(() => {
    cleanup();
  });

  async function renderScopePanel(props: {
    scopes: Array<{
      frameId: string | null;
      name: string | null;
      variables: Array<{
        name: string | null;
        kind: string | null;
        value: string | null;
        contractType: string | null;
      }>;
    }>;
    nodeId?: string | null;
  }) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/contracts', component: { template: '<div>Contracts</div>' } },
        { path: '/nodes/:id/contracts/:contractId', component: { template: '<div>Contract</div>' } },
        { path: '/parties/:partyId', component: { template: '<div>Party</div>' } },
      ],
    });

    router.push('/');
    await router.isReady();

    return render(DebuggerScopePanel, {
      props,
      global: {
        plugins: [router],
      },
    });
  }

  it('renders grouped scope variables by frame', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
                contractType: null,
              },
            ],
          },
        ],
    });

    expect(screen.getByText('In-Scope Variables')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archive/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders selfContractId as self while preserving the contractId kind', async () => {
    await renderScopePanel({
        nodeId: 'cnqs-sv',
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Choice',
            variables: [
              {
                name: 'selfContractId',
                kind: 'contractId',
                value: '00abc',
                contractType: 'Oz.Vault.Base.Core:BaseVault',
              },
            ],
          },
        ],
    });

    expect(screen.getByText('self')).toBeInTheDocument();
    expect(screen.getByText('contractId')).toBeInTheDocument();
    expect(screen.queryByText('selfContractId')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '00abc' })).toHaveAttribute('href', '/nodes/cnqs-sv/contracts/00abc');
    expect(screen.getByRole('link', { name: '00abc' })).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Oz.Vault.Base.Core:BaseVault')).toBeInTheDocument();
  });

  it('renders contract types for contractId arrays', async () => {
    await renderScopePanel({
        nodeId: 'cnqs-extra-1',
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Choice',
            variables: [
              {
                name: 'assetHoldingCids',
                kind: 'contractId[]',
                value: '["00holding"]',
                contractType: 'Oz.Vault.Base.Core:TestUnderlyingHolding',
              },
            ],
          },
        ],
    });

    expect(screen.getByText('assetHoldingCids')).toBeInTheDocument();
    expect(screen.getByText('contractId[]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '00holding' })).toHaveAttribute(
      'href',
      '/nodes/cnqs-extra-1/contracts/00holding',
    );
    expect(screen.getByRole('link', { name: '00holding' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Oz.Vault.Base.Core:TestUnderlyingHolding' })).toHaveAttribute(
      'href',
      '/contracts?template=Oz.Vault.Base.Core%3ATestUnderlyingHolding',
    );
    expect(screen.getByRole('link', { name: 'Oz.Vault.Base.Core:TestUnderlyingHolding' })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('allows each scope frame to be collapsed and expanded', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
                contractType: null,
              },
            ],
          },
        ],
    });

    const toggle = screen.getByRole('button', { name: /Archive/ });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('owner')).toBeInTheDocument();

    await fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('owner')).not.toBeInTheDocument();

    await fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('owner')).toBeInTheDocument();
  });

  it('renders party-typed values as party detail links', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Choice',
            variables: [
              {
                name: 'ds10',
                kind: 'party',
                value: 'vault-integration-alice-simulation-user-17::12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
                contractType: null,
              },
            ],
          },
        ],
    });

    expect(screen.getByText('party')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'vault-integration-alice-simulation-user-17::12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
      }),
    ).toHaveAttribute(
      'href',
      '/parties/vault-integration-alice-simulation-user-17%3A%3A12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
    );
    expect(
      screen.getByRole('link', {
        name: 'vault-integration-alice-simulation-user-17::12205af0d2665949f3e6ddc38133b790acf63907a1d49fdf41c43a4649b5aa2050fb',
      }),
    ).toHaveAttribute('target', '_blank');
  });

  it('renders numeric replay values as decimal labels', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Choice',
            variables: [
              {
                name: 'ds13',
                kind: 'numeric',
                value: '0.0014075538',
                contractType: null,
              },
            ],
          },
        ],
    });

    expect(screen.getByText('ds13')).toBeInTheDocument();
    expect(screen.getByText('decimal')).toBeInTheDocument();
    expect(screen.queryByText('numeric')).not.toBeInTheDocument();
    expect(screen.getByText('0.0014075538')).toBeInTheDocument();
  });

  it('renders ledger values as structured readable trees', async () => {
    await renderScopePanel({
      nodeId: 'cnqs-extra-1',
      scopes: [
        {
          frameId: 'frame-1',
          name: 'Choice',
          variables: [
            {
              name: 'this',
              kind: 'ledgerValue',
              value: '{"0":{"0":{"__damlLfParty":"vault-integration-vault-simulation-vault::122017b5facdfe0ca5bb71b7962436f9f3ea60f2c1c22508c79820e4b82d9a1c307c"},"1":"usdcx-test-vault-simulation"},"1":{"__damlLfParty":"vault-integration-vault-simulation-vault::122017b5facdfe0ca5bb71b7962436f9f3ea60f2c1c22508c79820e4b82d9a1c307c"},"2":{"0":{"__damlLfParty":"vault-integration-usdcx-issuer-simulation-issuer::122041004c9c5ac94ff9a6f1bb5f7e5a57d03cb1e77d98f12d802a6b26a343006a91"},"1":"USDCx"},"3":{"__damlLfContractId":"009536d35cda058b625970b787e2d3c59b93f69f8e3e6958c7c1801f2949cd72f7ca1212209199087576293535dceb585ccf9de2355ec8e1e71dca639787d9be772959ef30"},"4":{"__damlLfNumeric":"1.0000000000"},"5":{"__damlLfNumeric":"1.0000000000"},"6":{"0":"60000000"},"7":"USDCx Test Vault Simulation","8":"vUSDCx","__damlLfRecordId":{"packageId":"5498e10ecf8a0ab37087e255ef6f74af45d09b981a55119cfb0c750b6638c969","moduleName":"Oz.Vault.Base.Core","entityName":"BaseVault"}}',
              contractType: null,
            },
          ],
        },
      ],
    });

    expect(screen.getByText('this')).toBeInTheDocument();
    expect(screen.getByText('ledgerValue')).toBeInTheDocument();
    expect(screen.queryByText('{"0":{"0"')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('vaultIdentity')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Oz.Vault.Base.Core:BaseVault' })).toHaveAttribute(
      'href',
      '/contracts?template=Oz.Vault.Base.Core%3ABaseVault',
    );
    expect(screen.getByText('vaultParty')).toBeInTheDocument();
    expect(screen.getByText('shareTokenCid')).toBeInTheDocument();
    expect(screen.getByText('virtualAssets')).toBeInTheDocument();
    expect(screen.getByText('virtualShares')).toBeInTheDocument();
    expect(screen.getByText('maxInstructionLifetime')).toBeInTheDocument();
    expect(screen.getByText('symbol')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('microseconds')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '009536d35cda058b625970b787e2d3c59b93f69f8e3e6958c7c1801f2949cd72f7ca1212209199087576293535dceb585ccf9de2355ec8e1e71dca639787d9be772959ef30' })).toHaveAttribute(
      'href',
      '/nodes/cnqs-extra-1/contracts/009536d35cda058b625970b787e2d3c59b93f69f8e3e6958c7c1801f2949cd72f7ca1212209199087576293535dceb585ccf9de2355ec8e1e71dca639787d9be772959ef30',
    );
    expect(screen.getAllByText('Decimal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Party').length).toBeGreaterThan(0);
    expect(screen.getByText('ContractId<Oz.Vault.Base.ShareToken.CIP112:ReferenceShareToken>')).toBeInTheDocument();
    expect(screen.getAllByText('1.0000000000')).toHaveLength(2);
    expect(screen.getByText('USDCx Test Vault Simulation')).toBeInTheDocument();
  });

  it('formats generated lf helper frame names for display', async () => {
    await renderScopePanel({
        scopes: [
          {
            frameId: 'frame-1',
            name: '$$$$sc_BaseVault_8',
            variables: [],
          },
        ],
    });

    expect(screen.getByText('generated helper from BaseVault')).toBeInTheDocument();
    expect(screen.queryByText('$$$$sc_BaseVault_8')).not.toBeInTheDocument();
  });
});
