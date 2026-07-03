import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { resolve } from 'node:path';
import type {
  NodeContractDetailResponse,
  NodePackagesResponse,
  PackageDetailResponse,
  PackageFamilyResponse,
  NodeUpdateDetailResponse,
} from '../../src/domain/node.types';
import { PackageCacheService } from '../../src/packages/package-cache.service';
import { DamlValueDecoderService } from '../../src/packages/daml-value-decoder.service';
import { PackageRegistryService } from '../../src/packages/package-registry.service';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value >>> 0;

  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }

  bytes.push(remaining);
  return Buffer.from(bytes);
}

function encodeLengthDelimited(fieldNumber: number, payload: Buffer | string): Buffer {
  const bytes = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  return Buffer.concat([encodeVarint((fieldNumber << 3) | 2), encodeVarint(bytes.length), bytes]);
}

function encodeVarintField(fieldNumber: number, value: number): Buffer {
  return Buffer.concat([encodeVarint(fieldNumber << 3), encodeVarint(value)]);
}

function buildRewardCouponInstance(rewardRound: number, rewardAmount: number): Buffer {
  const rewardRoundValue = encodeLengthDelimited(
    1,
    encodeLengthDelimited(
      13,
      encodeLengthDelimited(1, encodeLengthDelimited(1, encodeVarintField(3, rewardRound))),
    ),
  );
  const rewardAmountValue = encodeLengthDelimited(1, encodeVarintField(3, rewardAmount));
  const record = encodeLengthDelimited(
    13,
    Buffer.concat([
      encodeLengthDelimited(1, encodeLengthDelimited(1, ':IDSO::example')),
      encodeLengthDelimited(1, encodeLengthDelimited(1, ':Hsv::example')),
      encodeLengthDelimited(1, encodeLengthDelimited(1, ':Hsv::example')),
      rewardRoundValue,
      rewardAmountValue,
    ]),
  );
  const contractInstance = encodeLengthDelimited(4, record);

  return Buffer.concat([
    encodeLengthDelimited(1, '2.1'),
    encodeLengthDelimited(2, contractInstance),
  ]);
}

const SUBMIT_STATUS_REPORT_ARGUMENT = Buffer.from(
  'CgMyLjES3AFq2QEKTApKOkhzdjo6MTIyMGI0ZWU3NDY4YTUwMjViOTk5Y2YxNGExMjU2OWVhYWYxZGU3ZjE0NDFkMGNjNmM1NGY3NTk1NzQ4MjVlNTUyYjkKSQpHSkUAitxOACLEYUZlOS8rXPUzIC8sVd4EnvV3vFvuAwt6FYXKEhIgcPzr3hxdZYt+khRhQDUyfkA1j5HPHxG2tc9AGhwSEtAKPgo8ajoKCwoJKSL13TWnVQYACgQKAhgBCgsKCSmupFowp1UGAAoLCgkpHSOINKdVBgAKCwoJagcKBQoDGLgC',
  'base64',
);
const SUBMIT_STATUS_REPORT_RESULT = Buffer.from(
  'CgMyLjESTWpLCkkKR0pFAJmNjAGRoFWnKObeynVSgE1FFZHpl4rQzUcXOqMNE6eDyhISIM1Rl8yjqb++FAsyL4l0hdVusi2kzsVDFEE017di0/L4',
  'base64',
);
const WALLET_APP_INSTALL_INSTANCE = Buffer.from(
  'CgMyLjESkQUKRQDgctGvM9jp7t+Fza/juxIs90vq93rtYtndPpBgJ4p958oSEiDyt3/xjcDGkjpqz1t+2QyEbgjgosV+39V+U2VkwvdAxxINc3BsaWNlLXdhbGxldBptCkAxZDgzMTdiMWU0NzZjMDNlYTJhODViZWQ4NDM1ZTVjMTgyYWJlNTAxZGI1ODM1MDAwOTE4N2ZhODM5YWIyY2NhEgZTcGxpY2USBldhbGxldBIHSW5zdGFsbBoQV2FsbGV0QXBwSW5zdGFsbCKwAmqtAgpNCks6SURTTzo6MTIyMDg5NWM0NTllM2FlNmQ3NjhlOWRlODYxNzI5OTM5NDA1MWFiNzc0OGExZTVmODU4ZWMwMWFkNGU1OTQ3MDc2ZGYKZgpkOmJhcHBfdXNlcl9xdWlja3N0YXJ0LWhlbGVuYS0xOjoxMjIwMzk2MjNkNTEwMGQ5ZDNlNzU3MDYxMjc1MmJjMDM0MjBhYmYxNTgzNjFkNjZjNTY5NGYyMmVlMGY3MjI2MDMzOQoMCgpCCGFwcC11c2VyCmYKZDpiYXBwX3VzZXJfcXVpY2tzdGFydC1oZWxlbmEtMTo6MTIyMDM5NjIzZDUxMDBkOWQzZTc1NzA2MTI3NTJiYzAzNDIwYWJmMTU4MzYxZDY2YzU2OTRmMjJlZTBmNzIyNjAzMzkqYmFwcF91c2VyX3F1aWNrc3RhcnQtaGVsZW5hLTE6OjEyMjAzOTYyM2Q1MTAwZDlkM2U3NTcwNjEyNzUyYmMwMzQyMGFiZjE1ODM2MWQ2NmM1Njk0ZjIyZWUwZjcyMjYwMzM5OdQsOOKQVQYAQioKJgokCAESIGwxC2o0JiA01qDpy33GD+166EhR+W7eIwLAbhK6Mhc/EB4=',
  'base64',
);

const typedUpdateDetailFixture = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  eventOffset: '0000000000000001',
  updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
  recordTime: '2026-07-01T12:00:00.000Z',
  parties: ['Alice'],
  events: [
    {
      eventKind: 'create',
      eventId: '#0:0',
      contractId: '00abc',
      templateId: 'Main:Asset',
      choice: null,
      witnesses: ['Alice'],
      createData: {
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [{ label: 'owner', value: 'Alice' }],
        },
      },
      exerciseData: {
        argument: { status: 'not_available' },
        result: { status: 'not_available' },
      },
      raw: {},
    },
  ],
  meta: {
    update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
    record_time: 1782907200000000,
  },
} satisfies NodeUpdateDetailResponse;

const typedContractDetailFixture = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  contractId: '00abc',
  templateId: 'Main:Asset',
  packageId: 'main-package',
  packageName: 'main-package-name',
  packageVersion: '1.2.3',
  createdUpdateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
  createdEventOffset: '0000000000000001',
  createdRecordTime: '2026-07-01T12:00:00.000Z',
  archivedUpdateId: null,
  archivedEventOffset: null,
  archivedRecordTime: null,
  contractData: {
    status: 'decoded',
    value: {
      kind: 'record',
      fields: [{ label: 'owner', value: 'Alice' }],
    },
  },
} satisfies NodeContractDetailResponse;

const typedPackageDetailFixture = {
  packageId: 'splice-amulet',
  name: 'splice-amulet',
  version: '0.1.24',
  uploadedAt: '1782930571952849',
  packageSize: 960436,
  status: 'decoded',
  seenOnNodes: [
    {
      nodeId: 'cnqs-sv',
      packageName: 'splice-amulet',
      packageVersion: '0.1.24',
      seenAt: '2026-07-02T12:00:00.000Z',
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
    },
  ],
  dataTypes: [
    {
      typeId: 'Splice.Amulet:AmuletRules',
      moduleName: 'Splice.Amulet',
      entityName: 'AmuletRules',
    },
  ],
} satisfies PackageDetailResponse;

const typedPackageFamilyFixture = {
  name: 'splice-amulet',
  packages: [
    {
      packageId: 'splice-amulet-v2',
      name: 'splice-amulet',
      version: '0.1.24',
      uploadedAt: '2026-07-02T12:00:00.000Z',
      packageSize: 960436,
    },
    {
      packageId: 'splice-amulet-v1',
      name: 'splice-amulet',
      version: '0.1.14',
      uploadedAt: '2026-07-01T12:00:00.000Z',
      packageSize: 950000,
    },
  ],
} satisfies PackageFamilyResponse;

const typedNodePackagesFixture = {
  nodeId: 'cnqs-sv',
  label: 'CNQS Super Validator',
  packagesByName: [
    {
      packageName: 'daml-prim',
      packages: [
        {
          packageId: 'daml-prim-package',
          version: '0.0.0',
          uploadedAt: '2026-07-02T12:00:00.000Z',
          seenAt: '2026-07-02T12:05:00.000Z',
        },
      ],
    },
    {
      packageName: 'splice-amulet',
      packages: [
        {
          packageId: 'splice-amulet-v2',
          version: '0.1.24',
          uploadedAt: '2026-07-02T13:00:00.000Z',
          seenAt: '2026-07-02T13:05:00.000Z',
        },
        {
          packageId: 'splice-amulet-v1',
          version: '0.1.14',
          uploadedAt: '2026-07-01T12:00:00.000Z',
          seenAt: '2026-07-02T12:05:00.000Z',
        },
      ],
    },
  ],
} satisfies NodePackagesResponse;

describe('PqsSummaryService', () => {
  const originalPackageCachePath = process.env.PACKAGE_CACHE_DB_PATH;

  afterEach(() => {
    if (originalPackageCachePath === undefined) {
      delete process.env.PACKAGE_CACHE_DB_PATH;
    } else {
      process.env.PACKAGE_CACHE_DB_PATH = originalPackageCachePath;
    }
  });

  it('keeps typed decode-state fixtures in sync with update and contract detail responses', () => {
    expect(typedUpdateDetailFixture.events[0].createData).toBeDefined();
    expect(typedContractDetailFixture.contractData).toBeDefined();
    expect(typedPackageDetailFixture.templates[0].templateId).toBe('Splice.Amulet:SvRewardCoupon');
    expect(typedPackageFamilyFixture.packages[0].packageId).toBe('splice-amulet-v2');
    expect(typedNodePackagesFixture.packagesByName[0].packageName).toBe('daml-prim');
  });

  it('returns all cached packages for a package name', async () => {
    const service = new (PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService)(
      { getClient: () => ({ query: jest.fn() }) } as never,
      undefined,
      {
        listPackagesByName: jest.fn().mockReturnValue(typedPackageFamilyFixture.packages),
      } as never,
      undefined,
    ) as PqsSummaryService & {
      fetchPackagesByName?: (packageName: string) => Promise<PackageFamilyResponse>;
    };

    expect(typeof service.fetchPackagesByName).toBe('function');

    await expect(service.fetchPackagesByName?.('splice-amulet')).resolves.toEqual(
      typedPackageFamilyFixture,
    );
  });

  it('returns cached installed packages for a node grouped by package name', async () => {
    const service = new (PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService)(
      { getClient: () => ({ query: jest.fn() }) } as never,
      undefined,
      {
        listPackagesForNode: jest.fn().mockReturnValue([
          {
            nodeId: 'cnqs-sv',
            packageId: 'daml-prim-package',
            mainPackageId: 'daml-prim-package',
            packageName: 'daml-prim',
            packageVersion: '0.0.0',
            uploadedAt: '2026-07-02T12:00:00.000Z',
            packageSize: 455515,
            seenAt: '2026-07-02T12:05:00.000Z',
          },
          {
            nodeId: 'cnqs-sv',
            packageId: 'splice-amulet-v2',
            mainPackageId: 'splice-amulet-v1',
            packageName: 'splice-amulet',
            packageVersion: '0.1.24',
            uploadedAt: '2026-07-02T13:00:00.000Z',
            packageSize: 960436,
            seenAt: '2026-07-02T13:05:00.000Z',
          },
          {
            nodeId: 'cnqs-sv',
            packageId: 'splice-amulet-v1',
            mainPackageId: 'splice-amulet-v1',
            packageName: 'splice-amulet',
            packageVersion: '0.1.14',
            uploadedAt: '2026-07-01T12:00:00.000Z',
            packageSize: 950000,
            seenAt: '2026-07-02T12:05:00.000Z',
          },
        ]),
      } as never,
      undefined,
    ) as PqsSummaryService & {
      fetchNodePackages?: (node: { id: string; label: string }) => Promise<NodePackagesResponse>;
    };

    expect(typeof service.fetchNodePackages).toBe('function');

    await expect(
      service.fetchNodePackages?.({ id: 'cnqs-sv', label: 'CNQS Super Validator' }),
    ).resolves.toEqual(typedNodePackagesFixture);
  });

  it('returns decoded package detail with metadata, node presence, and decoded structure', async () => {
    const service = new (PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService)(
      { getClient: () => ({ query: jest.fn() }) } as never,
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue({
          packageId: 'splice-amulet',
          name: 'splice-amulet',
          version: '0.1.24',
          uploadedAt: '1782930571952849',
          packageSize: 960436,
        }),
        listNodesForPackage: jest.fn().mockReturnValue([
          {
            nodeId: 'cnqs-sv',
            packageId: 'splice-amulet',
            mainPackageId: 'splice-amulet',
            packageName: 'splice-amulet',
            packageVersion: '0.1.24',
            uploadedAt: '1782930571952849',
            packageSize: 960436,
            seenAt: '2026-07-02T12:00:00.000Z',
          },
        ]),
      } as never,
      {
        inspectPackage: jest.fn().mockResolvedValue({
          ok: true,
          definition: {
            packageId: 'splice-amulet',
            packageName: 'splice-amulet',
            packageVersion: '0.1.24',
            modules: ['Splice.Amulet'],
            templates: [
              {
                templateId: 'Splice.Amulet:SvRewardCoupon',
                moduleName: 'Splice.Amulet',
                entityName: 'SvRewardCoupon',
              },
            ],
            dataTypes: [
              {
                typeId: 'Splice.Amulet:AmuletRules',
                moduleName: 'Splice.Amulet',
                entityName: 'AmuletRules',
              },
            ],
            moduleCount: 1,
            templateCount: 1,
            dataTypeCount: 1,
          },
        }),
      } as never,
    ) as PqsSummaryService & {
      fetchPackageDetail?: (packageId: string) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(service.fetchPackageDetail?.('splice-amulet')).resolves.toEqual(
      typedPackageDetailFixture,
    );
  });

  it('returns invalid package detail with metadata but empty decoded lists', async () => {
    const service = new (PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService)(
      { getClient: () => ({ query: jest.fn() }) } as never,
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue({
          packageId: 'broken-package',
          name: 'broken-package',
          version: '0.0.0',
          uploadedAt: '1782930571952849',
          packageSize: 4,
        }),
        listNodesForPackage: jest.fn().mockReturnValue([]),
      } as never,
      {
        inspectPackage: jest.fn().mockResolvedValue({
          ok: false,
          reason: 'invalid_package',
        }),
      } as never,
    ) as PqsSummaryService & {
      fetchPackageDetail?: (packageId: string) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(service.fetchPackageDetail?.('broken-package')).resolves.toEqual({
      packageId: 'broken-package',
      name: 'broken-package',
      version: '0.0.0',
      uploadedAt: '1782930571952849',
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
  });

  it('throws Package not found for unknown package ids', async () => {
    const service = new (PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService)(
      { getClient: () => ({ query: jest.fn() }) } as never,
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue(null),
        listNodesForPackage: jest.fn(),
      } as never,
      {
        inspectPackage: jest.fn(),
      } as never,
    ) as PqsSummaryService & {
      fetchPackageDetail?: (packageId: string) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(service.fetchPackageDetail?.('missing-package')).rejects.toThrow(
      'Package not found',
    );
  });

  it('returns a normalized ledger summary from the active() query', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          pqs_database: 'participant1_pqs',
          active_contract_count: '12',
          latest_offset: '000000000000123456',
          latest_event_at: '2026-07-01T12:00:00.000Z',
          total_update_count: '1442',
        },
      ],
    });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    const summary = await service.fetchSummary({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('from active()'));
    expect(summary.activeContractCount).toBe(12);
    expect(summary.totalUpdateCount).toBe(1442);
    expect(summary.ledgerLabel).toBe('Retail Ledger');
  });

  it('falls back to participant tables when active() is unavailable', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('function active() does not exist'), { code: '42883' }),
      )
      .mockResolvedValueOnce({
        rows: [
          {
            pqs_database: 'participant-app-user',
            active_contract_count: '11',
            latest_offset: '42',
            latest_event_at: '2026-07-01T22:51:02.433Z',
            total_update_count: '912',
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    const summary = await service.fetchSummary({
      id: 'participant-2',
      label: 'Participant 2',
      role: 'participant',
      ledgerLabel: 'Quickstart App User',
      pqs: { connectionUriEnv: 'PARTICIPANT_2_PQS_URL' },
    });

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('from active()'));
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('participant.par_active_contracts'),
    );
    expect(summary).toEqual({
      ledgerLabel: 'Quickstart App User',
      pqsDatabase: 'participant-app-user',
      activeContractCount: 11,
      latestOffset: '42',
      latestEventAt: '2026-07-01T22:51:02.433Z',
      totalUpdateCount: 912,
    });
  });

  it('returns normalized recent updates with default limit and best-effort parties', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\x00000000000000000000000000000001',
            event_offset: '000000000000000101',
            record_time: '2026-07-01T12:00:00.000Z',
          },
          {
            update_id: '\\x00000000000000000000000000000000',
            event_offset: '000000000000000100',
            record_time: '2026-07-01T11:59:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\x00000000000000000000000000000001',
            parties: [
              'p|DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
              'p|app_provider_quickstart-helena-1::122083ea37f868bc1df967ab64179ba230e243296096d6333d3063f2f0de05d278bf',
            ],
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    const updates = await service.fetchRecentUpdates({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from participant.lapi_update_meta'),
    );
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('limit 25'));
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('participant.lapi_events_create'),
    );
    expect(updates).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 25,
      updates: [
        {
          eventOffset: '000000000000000101',
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: [
            'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
            'app_provider_quickstart-helena-1::122083ea37f868bc1df967ab64179ba230e243296096d6333d3063f2f0de05d278bf',
          ],
        },
        {
          eventOffset: '000000000000000100',
          updateId: '00000000000000000000000000000000',
          recordTime: '2026-07-01T11:59:00.000Z',
          parties: [],
        },
      ],
    });
  });

  it('returns normalized historical activity buckets from update metadata', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          bucket_timestamp: '2026-07-01T10:00:00.000Z',
          activity_value: '12',
          latest_offset: '101',
        },
        {
          bucket_timestamp: '2026-07-01T10:15:00.000Z',
          activity_value: '7',
          latest_offset: '108',
        },
      ],
    });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);
    const serviceWithBuckets = service as unknown as {
      fetchActivityBuckets?: (
        node: object,
        days: number,
        bucketMinutes: number,
      ) => Promise<unknown>;
    };

    expect(serviceWithBuckets.fetchActivityBuckets).toBeDefined();

    await expect(
      serviceWithBuckets.fetchActivityBuckets?.call(
        service,
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        30,
        15,
      ),
    ).resolves.toEqual([
      {
        timestamp: '2026-07-01T10:00:00.000Z',
        activityValue: 12,
        latestOffset: '101',
      },
      {
        timestamp: '2026-07-01T10:15:00.000Z',
        activityValue: 7,
        latestOffset: '108',
      },
    ]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('from participant.lapi_update_meta'),
    );
  });

  it('returns a single update detail for canonical, raw, and display-normalized ids', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '0000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '0000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '0000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant' as const,
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    };

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        node,
        '0000000000000001',
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '0000000000000001',
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      events: [],
      meta: {
        update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        record_time: '2026-07-01T12:00:00.000Z',
        event_offset: '0000000000000001',
      },
    });

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        node,
        '0000000000000001',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventOffset: '0000000000000001',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        node,
        '0000000000000001',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventOffset: '0000000000000001',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from participant.lapi_update_meta'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('participant.lapi_events_create'),
    );
  });

  it('rejects when a single update detail is missing', async () => {
    const service = new PqsSummaryService({
      getClient: () =>
        ({
          query: jest.fn().mockResolvedValue({
            rows: [],
          }),
        }) as never,
    } as never);
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        'missing-update-id',
      ),
    ).rejects.toThrow('Update not found');
  });

  it('returns a single update detail with empty parties when witness lookup fails', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '0000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('events lookup failed'))
      .mockResolvedValueOnce({
        rows: [],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    await expect(
      serviceWithDetail.fetchUpdateDetail?.call(
        service,
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '0000000000000001',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventOffset: '0000000000000001',
        parties: [],
        events: [],
      }),
    );
  });

  it('returns mixed normalized event rows on a single update detail', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '0000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'create',
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: 'Main:Asset',
            choice: null,
            witnesses: ['Alice', 'Bob'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              tree_event_witnesses: ['Alice', 'Bob'],
            },
          },
          {
            event_kind: 'consuming_exercise',
            event_id: '#0:1',
            contract_id: '00abc',
            template_id: 'Main:Asset',
            choice: 'Archive',
            witnesses: ['Alice'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:1',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              choice: 'Archive',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '0000000000000001',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventOffset: '0000000000000001',
        events: [
          {
            eventKind: 'create',
            eventId: '#0:0',
            contractId: '00abc',
            packageId: null,
            templateId: 'Main:Asset',
            choice: null,
            witnesses: ['Alice', 'Bob'],
            createData: null,
            exerciseData: null,
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              tree_event_witnesses: ['Alice', 'Bob'],
            },
          },
          {
            eventKind: 'consuming_exercise',
            eventId: '#0:1',
            contractId: '00abc',
            packageId: null,
            templateId: 'Main:Asset',
            choice: 'Archive',
            witnesses: ['Alice'],
            createData: null,
            exerciseData: null,
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:1',
              contract_id: '00abc',
              template_id: 'Main:Asset',
              choice: 'Archive',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
      }),
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from participant.lapi_update_meta'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('participant.lapi_events_create'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('participant.lapi_events_consuming_exercise'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('participant.lapi_events_non_consuming_exercise'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        "\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1",
      ),
    );
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('order by event_id asc'));
  });

  it('falls back to normalized participant event tables when legacy event tables are unavailable', async () => {
    const missingLegacyRelation = Object.assign(
      new Error('relation "participant.lapi_events_create" does not exist'),
      { code: '42P01' },
    );
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3',
            record_time_iso: '2026-07-02T10:55:21.000Z',
            meta: {
              update_id:
                '\\x12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3',
              event_offset: '39',
              record_time: 1782989721000000,
            },
          },
        ],
      })
      .mockRejectedValueOnce(missingLegacyRelation)
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
      .mockRejectedValueOnce(missingLegacyRelation)
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'create',
            event_id: '#0:14',
            contract_id:
              '00e97ddfb040d930b6b26ebe56af0c7581fce71bb0966f38554edfe69c0cb0509bca121220d0af5cf951a32951213142b6235f5a55a541de6b7746feb95c7709af92f20f60',
            template_id: 'Splice.Wallet.TopUpState:ValidatorTopUpState',
            choice: null,
            witnesses: ['Alice', 'Bob'],
            raw: {
              source_table: 'participant.lapi_events_activate_contract',
              event_sequential_id: '14',
              node_id: 14,
            },
          },
          {
            event_kind: 'non_consuming_exercise',
            event_id: '#0:12',
            contract_id:
              '00e072d1af33d8e9eedf85cdafe3bb122cf74beaf77aed62d9dd3e9060278a7de7ca121220f2b77ff18dc0c6923a6acf5b7ed90c846e08e0a2c57edfd57e536564c2f740c7',
            template_id: 't|#splice-wallet:Splice.Wallet.Install:WalletAppInstall',
            choice: 'c|WalletAppInstall_ExecuteBatch',
            witnesses: ['Alice'],
            raw: {
              source_table: 'participant.lapi_events_various_witnessed',
              event_sequential_id: '12',
              node_id: 12,
            },
          },
          {
            event_kind: 'consuming_exercise',
            event_id: '#0:22',
            contract_id:
              '009f02b979bd057c22f65ec559b59157da1e1ccd4d4279fd2f544c4fa3f435f126ca121220549dc40cb4a85c7f2761fba4a0c7a0b4ca653476c4b481fbefdf5247ed86ce36',
            template_id: 't|#splice-amulet:Splice.Amulet:Amulet',
            choice: 'c|Archive',
            witnesses: ['Bob'],
            raw: {
              source_table: 'participant.lapi_events_various_witnessed',
              event_sequential_id: '22',
              node_id: 22,
            },
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '39',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventOffset: '39',
        parties: ['Alice', 'Bob'],
        events: [
          expect.objectContaining({
            eventKind: 'create',
            eventId: '#0:14',
            templateId: 'Splice.Wallet.TopUpState:ValidatorTopUpState',
            choice: null,
            witnesses: ['Alice', 'Bob'],
          }),
          expect.objectContaining({
            eventKind: 'non_consuming_exercise',
            eventId: '#0:12',
            templateId: 'Splice.Wallet.Install:WalletAppInstall',
            choice: 'ExecuteBatch',
            witnesses: ['Alice'],
          }),
          expect.objectContaining({
            eventKind: 'consuming_exercise',
            eventId: '#0:22',
            templateId: 'Splice.Amulet:Amulet',
            choice: 'Archive',
            witnesses: ['Bob'],
          }),
        ],
      }),
    );

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('participant.lapi_events_create'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('participant.lapi_events_activate_contract'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('participant.lapi_filter_activate_witness'),
    );
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('participant.lapi_events_create'),
    );
    expect(query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('participant.lapi_events_various_witnessed'),
    );
    expect(query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("encode(activate_event.update_id, 'hex')"),
    );
  });

  it('preserves raw event rows when a normalized field cannot be derived', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '0000000000000001',
            record_time: '2026-07-01T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'create',
            event_id: '#0:0',
            contract_id: '00abc',
            template_id: null,
            choice: null,
            witnesses: ['Alice'],
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              tree_event_witnesses: ['Alice'],
            },
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '0000000000000001',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventOffset: '0000000000000001',
        events: [
          expect.objectContaining({
            eventKind: 'create',
            templateId: null,
            raw: {
              update_id:
                '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_id: '#0:0',
              contract_id: '00abc',
              tree_event_witnesses: ['Alice'],
            },
          }),
        ],
      }),
    );
  });

  it('attaches reward coupon details to ReceiveSvRewardCoupon exercise events', async () => {
    const missingLegacyRelation = Object.assign(new Error('relation does not exist'), { code: '42P01' });
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
            event_offset: '9130',
            record_time: '2026-07-02T03:50:00.000Z',
          },
        ],
      })
      .mockRejectedValueOnce(missingLegacyRelation)
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
            parties: ['sv::party'],
          },
        ],
      })
      .mockRejectedValueOnce(missingLegacyRelation)
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'non_consuming_exercise',
            event_id: '#0:0',
            contract_id: '00966590c35cea9eb8357db014e64b1197499f2a58320f1eaff6a25719aa78ddb4',
            template_id: 't|#splice-dso-governance:Splice.DsoRules:DsoRules',
            choice: 'c|DsoRules_ReceiveSvRewardCoupon',
            witnesses: ['sv::party'],
            raw: {
              source_table: 'participant.lapi_events_various_witnessed',
            },
          },
          {
            event_kind: 'create',
            event_id: '#0:5',
            contract_id: '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
            template_id: 'Splice.Amulet:SvRewardCoupon',
            choice: null,
            witnesses: ['sv::party'],
            contract_instance: buildRewardCouponInstance(258, 20000),
            raw: {
              source_table: 'participant.lapi_events_activate_contract',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            coupon_contract_id: '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
            contract_instance: buildRewardCouponInstance(258, 20000),
          },
        ],
      });

    const service = new PqsSummaryService({
      getClient: () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'cnqs-sv',
          label: 'CNQS Super Validator',
          role: 'participant',
          ledgerLabel: 'Quickstart Super Validator',
          pqs: { connectionUriEnv: 'CNQS_PQS_SV_URL' },
        },
        '9130',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            eventKind: 'non_consuming_exercise',
            choice: 'ReceiveSvRewardCoupon',
            exerciseData: {
              argument: { status: 'not_available' },
              result: {
                status: 'decoded',
                value: {
                  kind: 'record',
                  fields: [
                    { label: 'rewardRound', value: 258 },
                    { label: 'rewardAmount', value: 20000 },
                    {
                      label: 'couponContractId',
                      value: {
                        kind: 'contract_id',
                        value: '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
                      },
                    },
                  ],
                },
              },
            },
          }),
          expect.objectContaining({
            eventKind: 'create',
            templateId: 'Splice.Amulet:SvRewardCoupon',
            createData: {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  { label: 'rewardRound', value: 258 },
                  { label: 'rewardAmount', value: 20000 },
                ],
              },
            },
          }),
        ],
      }),
    );
  });

  it('decodes generic exercise argument and result payloads from normalized participant event tables', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const decoder = new DamlValueDecoderService(
      new PackageRegistryService(new PackageCacheService()),
    );
    const missingLegacyRelation = Object.assign(new Error('relation does not exist'), {
      code: '42P01',
    });
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8',
            event_offset: '11327',
            record_time: '2026-07-02T17:20:00.000Z',
          },
        ],
      })
      .mockRejectedValueOnce(missingLegacyRelation)
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8',
            parties: ['sv::1220b4ee7468a5025b999cf14a12569eaaf1de7f1441d0cc6c54f759574825e552b9'],
          },
        ],
      })
      .mockRejectedValueOnce(missingLegacyRelation)
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'non_consuming_exercise',
            event_id: '#0:0',
            contract_id:
              '00966590c35cea9eb8357db014e64b1197499f2a58320f1eaff6a25719aa78ddb4ca1212201db4c45f5974070e20c390d2bf5eebc07635beb7af47b8f203f4839829120488',
            template_id: 't|#splice-dso-governance:Splice.DsoRules:DsoRules',
            package_id: 'i|4974c654485d4ecaa6b5caf8ef3c2679efa8195c4b50d4965a8fff1b72e8efa4',
            choice: 'c|DsoRules_SubmitStatusReport',
            witnesses: ['sv::1220b4ee7468a5025b999cf14a12569eaaf1de7f1441d0cc6c54f759574825e552b9'],
            exercise_argument: SUBMIT_STATUS_REPORT_ARGUMENT,
            exercise_result: SUBMIT_STATUS_REPORT_RESULT,
            raw: {
              source_table: 'participant.lapi_events_various_witnessed',
            },
          },
        ],
      });

    const service = new PqsSummaryService(
      {
        getClient: () => ({ query }),
      } as never,
      decoder,
    );

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'cnqs-sv',
          label: 'CNQS Super Validator',
          role: 'participant',
          ledgerLabel: 'Quickstart Super Validator',
          pqs: { connectionUriEnv: 'CNQS_PQS_SV_URL' },
        },
        '11327',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            eventKind: 'non_consuming_exercise',
            choice: 'SubmitStatusReport',
            exerciseData: {
              argument: {
                status: 'decoded',
                value: {
                  kind: 'record',
                  fields: expect.arrayContaining([
                    expect.objectContaining({
                      label: 'sv',
                      value: expect.stringContaining('sv::'),
                    }),
                    expect.objectContaining({
                      label: 'previousReportCid',
                      value: expect.objectContaining({
                        kind: 'contract_id',
                      }),
                    }),
                    expect.objectContaining({
                      label: 'status',
                      value: expect.objectContaining({
                        kind: 'record',
                        fields: expect.arrayContaining([
                          expect.objectContaining({
                            label: 'createdAt',
                            value: expect.stringContaining('2026-07-02T'),
                          }),
                          expect.objectContaining({
                            label: 'cometBftHeight',
                            value: -1,
                          }),
                        ]),
                      }),
                    }),
                  ]),
                },
              },
              result: {
                status: 'decoded',
                value: {
                  kind: 'record',
                  fields: [
                    expect.objectContaining({
                      label: 'newReport',
                      value: expect.objectContaining({
                        kind: 'contract_id',
                      }),
                    }),
                  ],
                },
              },
            },
          }),
        ],
      }),
    );
  });

  it('returns contract detail with created update metadata and decoded contract data', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          contract_id: '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
          template_id: 'Splice.Amulet:SvRewardCoupon',
          package_id: 'splice-amulet',
          contract_instance: buildRewardCouponInstance(258, 20000),
          created_update_id: '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
          created_event_offset: '9130',
          created_record_time: '2026-07-02T03:50:00.000Z',
          archived_update_id: null,
          archived_event_offset: null,
          archived_record_time: null,
        },
      ],
    });

    const service = new PqsSummaryService(
      {
        getClient: () => ({ query }),
      } as never,
      undefined,
      {
        getPackage: () => ({
          packageId: 'splice-amulet',
          name: 'splice-amulet',
          version: '0.1.24',
          uploadedAt: '1782930571952849',
          packageSize: 960436,
          data: Buffer.from('package'),
        }),
      } as never,
    );

    await expect(
      service.fetchContractDetail(
        {
          id: 'cnqs-sv',
          label: 'CNQS Super Validator',
          role: 'participant',
          ledgerLabel: 'Quickstart Super Validator',
          pqs: { connectionUriEnv: 'CNQS_PQS_SV_URL' },
        },
        '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
      ),
    ).resolves.toEqual({
      nodeId: 'cnqs-sv',
      label: 'CNQS Super Validator',
      contractId: '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
      templateId: 'Splice.Amulet:SvRewardCoupon',
      packageId: 'splice-amulet',
      packageName: 'splice-amulet',
      packageVersion: '0.1.24',
      createdUpdateId: '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
      createdEventOffset: '9130',
      createdRecordTime: '2026-07-02T03:50:00.000Z',
      archivedUpdateId: null,
      archivedEventOffset: null,
      archivedRecordTime: null,
      contractData: {
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'rewardRound', value: 258 },
            { label: 'rewardAmount', value: 20000 },
          ],
        },
      },
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('from participant.par_contracts'));
  });

  it('decodes WalletAppInstall contract detail from a stored contract instance payload', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const decoder = new DamlValueDecoderService(
      new PackageRegistryService(new PackageCacheService()),
    );
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          contract_id:
            '00e072d1af33d8e9eedf85cdafe3bb122cf74beaf77aed62d9dd3e9060278a7de7ca121220f2b77ff18dc0c6923a6acf5b7ed90c846e08e0a2c57edfd57e536564c2f740c7',
          template_id: 'Splice.Wallet.Install:WalletAppInstall',
          package_id: '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
          contract_instance: WALLET_APP_INSTALL_INSTANCE,
          created_update_id: '12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3',
          created_event_offset: '39',
          created_record_time: '2026-07-02T10:55:21.000Z',
          archived_update_id: null,
          archived_event_offset: null,
          archived_record_time: null,
        },
      ],
    });

    const service = new PqsSummaryService(
      {
        getClient: () => ({ query }),
      } as never,
      decoder,
      {
        getPackage: () => ({
          packageId: '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
          name: 'splice-wallet',
          version: '0.1.19',
          uploadedAt: '1782930612094920',
          packageSize: 472790,
          data: Buffer.from('package'),
        }),
      } as never,
    );

    await expect(
      service.fetchContractDetail(
        {
          id: 'cnqs-app-user',
          label: 'CNQS App User',
          role: 'participant',
          ledgerLabel: 'Quickstart App User',
          pqs: { connectionUriEnv: 'CNQS_PQS_APP_USER_URL' },
        },
        '00e072d1af33d8e9eedf85cdafe3bb122cf74beaf77aed62d9dd3e9060278a7de7ca121220f2b77ff18dc0c6923a6acf5b7ed90c846e08e0a2c57edfd57e536564c2f740c7',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        templateId: 'Splice.Wallet.Install:WalletAppInstall',
        packageId: '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
        packageName: 'splice-wallet',
        packageVersion: '0.1.19',
        contractData: {
          status: 'decoded',
          value: {
            kind: 'record',
            fields: expect.arrayContaining([
              expect.objectContaining({
                label: 'dsoParty',
                value: expect.stringContaining('DSO::'),
              }),
              expect.objectContaining({
                label: 'validatorParty',
                value: expect.stringContaining('app_user_quickstart'),
              }),
              expect.objectContaining({
                label: 'endUserName',
                value: 'app-user',
              }),
              expect.objectContaining({
                label: 'endUserParty',
                value: expect.stringContaining('app_user_quickstart'),
              }),
            ]),
          },
        },
      }),
    );
  });
});
