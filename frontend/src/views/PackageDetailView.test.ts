import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PackageDetailView from './PackageDetailView.vue';
import { fetchPackageDetail } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchPackageDetail: vi.fn(),
}));

describe('PackageDetailView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('shows a loading state before the package detail resolves', () => {
    vi.mocked(fetchPackageDetail).mockReturnValue(new Promise(() => undefined));

    render(PackageDetailView, {
      props: {
        packageId: 'splice-amulet',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText('Loading package detail...')).toBeInTheDocument();
  });

  it('renders decoded package metadata, node presence, and decoded structure', async () => {
    vi.mocked(fetchPackageDetail).mockResolvedValue({
      packageId: 'splice-amulet',
      name: 'splice-amulet',
      version: '0.1.24',
      uploadedAt: '2026-07-02T12:00:00.000Z',
      packageSize: 960436,
      status: 'decoded',
      seenOnNodes: [
        {
          nodeId: 'cnqs-sv',
          packageName: 'splice-amulet',
          packageVersion: '0.1.24',
          seenAt: '2026-07-02T12:05:00.000Z',
        },
      ],
      moduleCount: 1,
      templateCount: 1,
      dataTypeCount: 1,
      modules: ['Splice.Amulet'],
      templates: [
        {
          templateId: 'Splice.Amulet:SvRewardCoupon',
          moduleName: 'Splice.Amulet',
          entityName: 'SvRewardCoupon',
          createType: {
            kind: 'record',
            label: 'Splice.Amulet:SvRewardCoupon',
            fields: [
              {
                name: 'dso',
                type: {
                  kind: 'builtin',
                  label: 'Party',
                },
              },
              {
                name: 'round',
                type: {
                  kind: 'type_con',
                  label: 'Splice.Types:Round',
                  typeId: 'Splice.Types:Round',
                  definition: {
                    kind: 'record',
                    label: 'Splice.Types:Round',
                    fields: [
                      {
                        name: 'number',
                        type: {
                          kind: 'builtin',
                          label: 'Int64',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
      dataTypes: [
        {
          typeId: 'Splice.Amulet:AmuletRules',
          moduleName: 'Splice.Amulet',
          entityName: 'AmuletRules',
          definition: {
            kind: 'record',
            label: 'Splice.Amulet:AmuletRules',
            fields: [
              {
                name: 'transferConfigUsd',
                type: {
                  kind: 'builtin',
                  label: 'Text',
                },
              },
            ],
          },
        },
      ],
    } as never);

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 2, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 2, 2026')
      .mockReturnValueOnce('12:05:00 PM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(PackageDetailView, {
      props: {
        packageId: 'splice-amulet',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'splice-amulet Package' })).toBeInTheDocument();
    expect(screen.getByText('Package ID')).toBeInTheDocument();
    expect(screen.getAllByText('splice-amulet')).toHaveLength(3);
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('0.1.24')).toBeInTheDocument();
    expect(screen.getByText('Decode Status')).toBeInTheDocument();
    expect(screen.getByText('Decoded')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seen On Nodes' })).toBeInTheDocument();
    expect(screen.getByText('cnqs-sv')).toBeInTheDocument();
    expect(screen.getAllByText('Jul 2, 2026')).toHaveLength(2);
    expect(screen.getByText('12:05:00 PM')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modules' })).toBeInTheDocument();
    expect(screen.getByText('Splice.Amulet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    expect(screen.getAllByText('Splice.Amulet:SvRewardCoupon').length).toBeGreaterThan(0);
    expect(screen.getByText('dso')).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('round')).toBeInTheDocument();
    expect(screen.getAllByText('Splice.Types:Round').length).toBeGreaterThan(0);
    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.getAllByText('Int64').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Data Types' })).toBeInTheDocument();
    expect(screen.getAllByText('Splice.Amulet:AmuletRules')).toHaveLength(1);
    expect(screen.getByText('transferConfigUsd')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');
    expect(container.querySelector('a[href="/packages/by-name/splice-amulet"]')).not.toBeNull();
    expect(container.querySelector('.package-detail__seen-list')).not.toBeNull();
  });

  it('renders an invalid package state with explicit empty structure messaging', async () => {
    vi.mocked(fetchPackageDetail).mockResolvedValue({
      packageId: 'broken-package',
      name: 'broken-package',
      version: '0.0.0',
      uploadedAt: null,
      packageSize: 4,
      status: 'invalid_package',
      seenOnNodes: [],
      moduleCount: 0,
      templateCount: 0,
      dataTypeCount: 0,
      modules: [],
      templates: [],
      dataTypes: [],
    });

    render(PackageDetailView, {
      props: {
        packageId: 'broken-package',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByText('Invalid Package')).toBeInTheDocument();
    expect(
      screen.getAllByText('Decoded package structure is not available for this package.'),
    ).toHaveLength(3);
    expect(screen.getByText('No node presence recorded for this package.')).toBeInTheDocument();
  });

  it('shows section-specific empty states for decoded packages without templates', async () => {
    vi.mocked(fetchPackageDetail).mockResolvedValue({
      packageId: 'splice-api-token-allocation-v1',
      name: 'splice-api-token-allocation-v1',
      version: '1.0.0',
      uploadedAt: '2026-07-02T12:00:00.000Z',
      packageSize: 64791,
      status: 'decoded',
      seenOnNodes: [],
      moduleCount: 1,
      templateCount: 0,
      dataTypeCount: 1,
      modules: ['Splice.Api.Token.AllocationV1'],
      templates: [],
      dataTypes: [
        {
          typeId: 'Splice.Api.Token.AllocationV1:Allocation',
          moduleName: 'Splice.Api.Token.AllocationV1',
          entityName: 'Allocation',
          definition: {
            kind: 'interface',
            label: 'Splice.Api.Token.AllocationV1:Allocation',
            requires: [
              {
                kind: 'type_con',
                label: 'Splice.Api.Token.AllocationV1:BaseAllocation',
                typeId: 'Splice.Api.Token.AllocationV1:BaseAllocation',
              },
            ],
            view: {
              kind: 'type_con',
              label: 'Splice.Api.Token.AllocationV1:AllocationView',
              typeId: 'Splice.Api.Token.AllocationV1:AllocationView',
              definition: {
                kind: 'record',
                label: 'Splice.Api.Token.AllocationV1:AllocationView',
                fields: [
                  {
                    name: 'allocation',
                    type: {
                      kind: 'type_con',
                      label: 'Splice.Api.Token.AllocationV1:AllocationSpecification',
                      typeId: 'Splice.Api.Token.AllocationV1:AllocationSpecification',
                      definition: {
                        kind: 'record',
                        label: 'Splice.Api.Token.AllocationV1:AllocationSpecification',
                        fields: [
                          {
                            name: 'executor',
                            type: {
                              kind: 'builtin',
                              label: 'Party',
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
            methods: [
              {
                name: 'allocation_cancelImpl',
                type: {
                  kind: 'builtin',
                  label: 'Arrow',
                },
              },
            ],
            choices: [
              {
                name: 'Allocation_Cancel',
                consuming: true,
                argumentType: {
                  kind: 'type_con',
                  label: 'Splice.Api.Token.AllocationV1:Allocation_Cancel',
                  typeId: 'Splice.Api.Token.AllocationV1:Allocation_Cancel',
                },
                resultType: {
                  kind: 'type_con',
                  label: 'Splice.Api.Token.AllocationV1:Allocation_CancelResult',
                  typeId: 'Splice.Api.Token.AllocationV1:Allocation_CancelResult',
                },
              },
            ],
          },
        },
      ],
    } as never);

    render(PackageDetailView, {
      props: {
        packageId: 'splice-api-token-allocation-v1',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(
      await screen.findByText('No template definitions are present in this package.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Decoded package structure is not available for this package.')).toBeNull();
    expect(screen.getAllByText('Splice.Api.Token.AllocationV1:Allocation')).toHaveLength(1);
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getAllByText('Splice.Api.Token.AllocationV1:AllocationView').length).toBeGreaterThan(0);
    expect(screen.getByText('allocation')).toBeInTheDocument();
    expect(screen.queryByText('executor')).toBeNull();
    expect(screen.getByText('Methods')).toBeInTheDocument();
    expect(screen.getByText('allocation_cancelImpl')).toBeInTheDocument();
    expect(screen.getByText('Choices')).toBeInTheDocument();
    expect(screen.getByText('Allocation_Cancel')).toBeInTheDocument();
    expect(screen.getByText('Consuming')).toBeInTheDocument();
    expect(screen.getByText('Requires')).toBeInTheDocument();
    expect(screen.getByText('Splice.Api.Token.AllocationV1:BaseAllocation')).toBeInTheDocument();
  });
});
