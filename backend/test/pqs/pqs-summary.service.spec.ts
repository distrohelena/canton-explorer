import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { resolve } from 'node:path';
import type {
  ActivePartiesResponse,
  NamespaceDetailResponse,
  NamespaceNodesResponse,
  NamespaceSummaryResponse,
  NamespacePartiesResponse,
  NamespaceUpdatesResponse,
  NamespaceContractsResponse,
  NodeContractsResponse,
  NodeContractDetailResponse,
  NodePackagesResponse,
  PartyDetailResponse,
  PartyNodesResponse,
  PartySummaryResponse,
  PackageDetailResponse,
  PackageFamilyResponse,
  SearchResultsResponse,
  TokenTransfersResponse,
  TokensResponse,
  NodeUpdateDetailResponse,
  PackageDetailDataTypesResponse,
  PackageDetailModulesResponse,
  PackageDetailNodesResponse,
  PackageModuleDetailResponse,
  PackageTemplateDetailResponse,
  PackageDetailSummaryResponse,
  PackageDetailTemplatesResponse,
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

function encodeLengthDelimited(
  fieldNumber: number,
  payload: Buffer | string,
): Buffer {
  const bytes =
    typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  return Buffer.concat([
    encodeVarint((fieldNumber << 3) | 2),
    encodeVarint(bytes.length),
    bytes,
  ]);
}

function encodeVarintField(fieldNumber: number, value: number): Buffer {
  return Buffer.concat([encodeVarint(fieldNumber << 3), encodeVarint(value)]);
}

function buildRewardCouponInstance(
  rewardRound: number,
  rewardAmount: number,
): Buffer {
  const rewardRoundValue = encodeLengthDelimited(
    1,
    encodeLengthDelimited(
      13,
      encodeLengthDelimited(
        1,
        encodeLengthDelimited(1, encodeVarintField(3, rewardRound)),
      ),
    ),
  );
  const rewardAmountValue = encodeLengthDelimited(
    1,
    encodeVarintField(3, rewardAmount),
  );
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
  updateId:
    '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
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
    update_id:
      '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
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
  createdUpdateId:
    '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
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

const representativeTemplateChoices = [
  {
    name: 'Archive',
    consuming: true,
    argumentType: {
      kind: 'record',
      label: 'Main.Module:ArchiveArgs',
      fields: [
        {
          name: 'reason',
          type: {
            kind: 'builtin',
            label: 'Text',
          },
        },
      ],
    },
    resultType: {
      kind: 'builtin',
      label: 'Unit',
    },
  },
];

const typedNodeContractsFixture = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  limit: 2,
  nextBefore: '102',
  nextAfter: null,
  contracts: [
    {
      contractId: '00c',
      templateId: 'Main:C',
      createdRecordTime: '2026-07-01T12:02:00.000Z',
    },
    {
      contractId: '00b',
      templateId: 'Main:B',
      createdRecordTime: '2026-07-01T12:01:00.000Z',
    },
  ],
} satisfies NodeContractsResponse;

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
        ],
      },
      choices: representativeTemplateChoices,
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

const typedPartyDetailFixture = {
  partyId: 'Alice',
  nodeCount: 2,
  recentUpdateCount: 2,
  recentContractCount: 2,
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      recentUpdateCount: 1,
      recentContractCount: 1,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      recentUpdateCount: 1,
      recentContractCount: 1,
    },
  ],
  recentUpdates: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '0000000000000001',
      updateId:
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      estimatedTrafficUsd: null,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      eventOffset: '0000000000000002',
      updateId:
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e2',
      recordTime: '2026-07-01T11:00:00.000Z',
      parties: ['Alice'],
      estimatedTrafficUsd: null,
    },
  ],
  recentContracts: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      contractId: '00abc',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      recordTime: '2026-07-01T12:00:00.000Z',
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      contractId: '00def',
      templateId: 'Main:Asset',
      packageId: 'main-package',
      packageName: 'Main Package',
      packageVersion: '1.2.3',
      recordTime: '2026-07-01T11:00:00.000Z',
    },
  ],
  partyTopologyByNode: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'ok',
      errorMessage: null,
      isLocalParty: false,
      partyToParticipants: [
        {
          participantId: 'participant-1',
          participantUid: 'participant-1::1220abc',
          permission: 'submission',
          synchronizerIds: [],
        },
      ],
      partyToKeyMappings: [
        {
          keyFingerprint: 'fingerprint-1',
          publicKey: null,
          purpose: 'namespace',
          keyType: 'ed25519',
          keyFormat: null,
          keySpec: null,
          threshold: null,
          synchronizerIds: [],
        },
      ],
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      status: 'ok',
      errorMessage: null,
      isLocalParty: false,
      partyToParticipants: [],
      partyToKeyMappings: [],
    },
  ],
} satisfies PartyDetailResponse;

const typedNamespaceDetailFixture = {
  namespaceId: '1220abcd',
  partyCount: 2,
  nodeCount: 2,
  recentUpdateCount: 2,
  recentContractCount: 1,
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      recentUpdateCount: 1,
      recentContractCount: 0,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      recentUpdateCount: 1,
      recentContractCount: 1,
    },
  ],
  recentUpdates: [
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      eventOffset: '42',
      updateId:
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-09T12:00:00.000Z',
      parties: ['Alice::1220abcd', 'Bob::1220abcd'],
    },
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      eventOffset: '41',
      updateId:
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e2',
      recordTime: '2026-07-09T11:00:00.000Z',
      parties: ['Alice::1220abcd'],
    },
  ],
  recentContracts: [
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      contractId: '00abc',
      templateId: 'Main:Asset',
      packageId: null,
      packageName: null,
      packageVersion: null,
      recordTime: '2026-07-09T12:00:00.000Z',
    },
  ],
  topologyByNode: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      status: 'ok',
      errorMessage: null,
      partyToParticipants: [
        {
          participantId: null,
          participantUid: 'participant-1::1220aaa',
          permission: 'confirmation',
          threshold: 1,
          synchronizerIds: ['global-domain::1220aa'],
        },
      ],
      partyToKeyMappings: [
        {
          keyFingerprint: '1220abcd',
          publicKey: null,
          purpose: 'namespace',
          keyType: 'ed25519',
          keyFormat: 'derX509SubjectPublicKeyInfo',
          keySpec: 'ecCurve25519',
          threshold: 1,
          synchronizerIds: ['global-domain::1220aa'],
        },
      ],
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      status: 'grpc_not_configured',
      errorMessage: null,
      partyToParticipants: [],
      partyToKeyMappings: [],
    },
  ],
} satisfies NamespaceDetailResponse;

const typedNamespacePartiesFixture = {
  namespaceId: '1220abcd',
  partyCount: 2,
  limit: 15,
  nextBefore: null,
  nextAfter: null,
  parties: [
    {
      partyId: 'Alice::1220abcd',
    },
    {
      partyId: 'Bob::1220abcd',
    },
  ],
} satisfies NamespacePartiesResponse;

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
    expect(typedPackageDetailFixture.templates[0].templateId).toBe(
      'Splice.Amulet:SvRewardCoupon',
    );
    expect(typedPackageFamilyFixture.packages[0].packageId).toBe(
      'splice-amulet-v2',
    );
    expect(typedNodePackagesFixture.packagesByName[0].packageName).toBe(
      'daml-prim',
    );
    expect(typedPartyDetailFixture.recentContracts[0].contractId).toBe('00abc');
    expect(typedPartyDetailFixture.partyTopologyByNode[0].status).toBe('ok');
  });

  it('preserves package identity when building node template options', async () => {
    const packageCache = {
      listPackages: jest.fn().mockReturnValue([
        { packageId: 'pkg-a', name: 'demo-package', version: '1.0.0' },
        { packageId: 'pkg-b', name: 'demo-package', version: '2.0.0' },
      ]),
      listPackagesForNode: jest.fn().mockReturnValue([
        {
          packageId: 'pkg-b',
          packageName: 'demo-package',
          packageVersion: '2.0.0',
        },
        {
          packageId: 'pkg-a',
          packageName: 'demo-package',
          packageVersion: '1.0.0',
        },
      ]),
    };
    const packageRegistry = {
      inspectPackage: jest.fn(async (packageId: string) => ({
        ok: true as const,
        definition: {
          templates: [
            {
              templateId: 'Main:Asset',
              packageId,
            },
          ],
        },
      })),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      packageCache as never,
      packageRegistry as never,
    );

    await expect(
      service.fetchNodeTemplates({ id: 'participant-1' } as never),
    ).resolves.toEqual({
      templates: [
        {
          templateId: 'Main:Asset',
          packageId: 'pkg-a',
          packageName: 'demo-package',
          packageVersion: '1.0.0',
        },
        {
          templateId: 'Main:Asset',
          packageId: 'pkg-b',
          packageName: 'demo-package',
          packageVersion: '2.0.0',
        },
      ],
    });
  });

  it('preserves DAR type metadata for JSON exercise payloads', async () => {
    const argumentRawType = {};
    const resultRawType = {};
    const argumentSchema = {
      kind: 'record',
      label: 'Main:Argument',
      fields: [
        {
          name: 'context',
          type: {
            kind: 'record',
            label: 'Main:Context',
            fields: [
              {
                name: 'validatorRights',
                type: {
                  kind: 'builtin',
                  label: 'Optional',
                  arguments: [
                    { kind: 'builtin', label: 'Text', arguments: [] },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const packageRegistry = {
      resolveChoice: jest
        .fn()
        .mockImplementation(({ choice }: { choice: string }) =>
          choice === 'AppPaymentRequest_Accept'
            ? {
                ok: true as const,
                definition: {
                  template: { packageRef: {} },
                  templateChoice: {
                    argBinder: { type: argumentRawType },
                    retType: resultRawType,
                  },
                },
              }
            : { ok: false as const, reason: 'unknown_choice' as const },
        ),
      buildTypeNodeForType: jest.fn((_packageRef: unknown, rawType: unknown) =>
        rawType === argumentRawType ? argumentSchema : null,
      ),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      undefined,
      packageRegistry as never,
    );

    const decoded = await (
      service as PqsSummaryService & {
        decodeExerciseData: (...args: any[]) => Promise<unknown>;
      }
    ).decodeExerciseData(null, {
      packageId: 'package-id',
      templateId: 'Main:AppPaymentRequest',
      rawChoice: 'Accept',
      exerciseArgument: {
        context: { validatorRights: null },
      },
      exerciseResult: null,
    });

    expect(decoded).toEqual(
      expect.objectContaining({
        argument: expect.objectContaining({
          status: 'decoded',
          type: argumentSchema,
        }),
      }),
    );
    expect(packageRegistry.resolveChoice).toHaveBeenCalledWith({
      packageId: 'package-id',
      templateId: 'Main:AppPaymentRequest',
      choice: 'AppPaymentRequest_Accept',
    });
  });

  it('returns empty successful search groups without querying nodes for a blank query', async () => {
    const query = jest.fn();
    const list = jest
      .fn()
      .mockReturnValue([
        { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
      ]);
    const packageCache = {
      listPackages: jest.fn(),
    };
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({ query }),
      },
      undefined,
      packageCache,
      undefined,
      { list },
    ) as PqsSummaryService & {
      search?: (query: string) => Promise<SearchResultsResponse>;
    };

    await expect(service.search?.('   ')).resolves.toEqual({
      query: '',
      updates: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      contracts: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      parties: {
        items: [],
        displayedCount: 0,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      packages: {
        packageIds: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
        packageNames: {
          items: [],
          displayedCount: 0,
          truncated: false,
          status: 'ok',
          warnings: [],
        },
      },
    });

    expect(list).not.toHaveBeenCalled();
    expect(packageCache.listPackages).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('searches updates by event offset exact and prefix match, deduping duplicate rows', async () => {
    const participantQuery = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\xabc123',
            event_offset: '39',
            record_time: '2026-07-02T12:00:00.000Z',
          },
          {
            update_id: '\\xabc123',
            event_offset: '39',
            record_time: '2026-07-02T12:00:00.000Z',
          },
          {
            update_id: '\\xdef456',
            event_offset: '390',
            record_time: '2026-07-02T11:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { update_id: '\\xabc123', parties: ['p|Alice', 'Bob'] },
          { update_id: '\\xdef456', parties: ['Alice'] },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ parties: [] }] });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({ query: participantQuery }),
      },
      undefined,
      {
        listPackages: jest.fn().mockReturnValue([]),
      },
      undefined,
      {
        list: jest
          .fn()
          .mockReturnValue([
            { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
          ]),
      },
    ) as PqsSummaryService & {
      search?: (query: string) => Promise<SearchResultsResponse>;
    };

    const response = await service.search?.('39');

    expect(response?.updates).toEqual({
      items: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '39',
          updateId: 'abc123',
          recordTime: '2026-07-02T12:00:00.000Z',
          parties: ['Alice', 'Bob'],
        },
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '390',
          updateId: 'def456',
          recordTime: '2026-07-02T11:00:00.000Z',
          parties: ['Alice'],
        },
      ],
      displayedCount: 2,
      truncated: false,
      status: 'ok',
      warnings: [],
    });
  });

  it('normalizes prefixed party queries and merges matching nodes into one party result', async () => {
    const participant1Query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ parties: ['p|Alice', 'Bob'] }] });
    const participant2Query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ parties: ['Alice'] }] });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      {
        listPackages: jest.fn().mockReturnValue([]),
      },
      undefined,
      {
        list: jest.fn().mockReturnValue([
          { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
          { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
        ]),
      },
    ) as PqsSummaryService & {
      search?: (query: string) => Promise<SearchResultsResponse>;
    };

    const response = await service.search?.('p|Alice');

    expect(response?.parties).toEqual({
      items: [
        {
          partyId: 'Alice',
          nodeIds: ['participant-1', 'participant-2'],
        },
      ],
      displayedCount: 1,
      truncated: false,
      status: 'ok',
      warnings: [],
    });
  });

  it('orders exact contract-id matches before prefix matches', async () => {
    const participantQuery = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: '00ab',
            template_id: 'Main:Asset',
            created_record_time: '2026-07-02T12:00:00.000Z',
          },
          {
            contract_id: '00a',
            template_id: 'Main:Asset',
            created_record_time: '2026-07-02T11:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ parties: [] }] });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({ query: participantQuery }),
      },
      undefined,
      {
        listPackages: jest.fn().mockReturnValue([]),
      },
      undefined,
      {
        list: jest
          .fn()
          .mockReturnValue([
            { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
          ]),
      },
    ) as PqsSummaryService & {
      search?: (query: string) => Promise<SearchResultsResponse>;
    };

    const response = await service.search?.('00a');

    expect(response?.contracts).toEqual({
      items: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00a',
          templateId: 'Main:Asset',
          createdRecordTime: '2026-07-02T11:00:00.000Z',
        },
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00ab',
          templateId: 'Main:Asset',
          createdRecordTime: '2026-07-02T12:00:00.000Z',
        },
      ],
      displayedCount: 2,
      truncated: false,
      status: 'ok',
      warnings: [],
    });
  });

  it('searches package ids and package names from the cache only', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        listPackages: jest.fn().mockReturnValue([
          {
            packageId: 'splice-amulet-v2',
            name: 'splice-amulet',
            version: '0.1.24',
            uploadedAt: '2026-07-02T12:00:00.000Z',
            packageSize: 960436,
          },
          {
            packageId: 'splice-wallet-v1',
            name: 'splice-wallet',
            version: '0.1.10',
            uploadedAt: '2026-07-01T12:00:00.000Z',
            packageSize: 950000,
          },
          {
            packageId: 'orphan-package',
            name: null,
            version: '1.0.0',
            uploadedAt: '2026-07-01T12:00:00.000Z',
            packageSize: 123,
          },
        ]),
      },
      undefined,
      {
        list: jest.fn().mockReturnValue([]),
      },
    ) as PqsSummaryService & {
      search?: (query: string) => Promise<SearchResultsResponse>;
    };

    const response = await service.search?.('splice');

    expect(response?.packages).toEqual({
      packageIds: {
        items: [
          {
            packageId: 'splice-amulet-v2',
            name: 'splice-amulet',
            version: '0.1.24',
          },
          {
            packageId: 'splice-wallet-v1',
            name: 'splice-wallet',
            version: '0.1.10',
          },
        ],
        displayedCount: 2,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
      packageNames: {
        items: [
          {
            name: 'splice-amulet',
            packages: [{ packageId: 'splice-amulet-v2', version: '0.1.24' }],
          },
          {
            name: 'splice-wallet',
            packages: [{ packageId: 'splice-wallet-v1', version: '0.1.10' }],
          },
        ],
        displayedCount: 2,
        truncated: false,
        status: 'ok',
        warnings: [],
      },
    });
  });

  it('marks updates as partial when one node search fails and another succeeds', async () => {
    const participant1Query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\xabc123',
            event_offset: '39',
            record_time: '2026-07-02T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ update_id: '\\xabc123', parties: ['Alice'] }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ parties: [] }] });
    const participant2Query = jest
      .fn()
      .mockRejectedValueOnce(new Error('participant-2 update query failed'))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ parties: [] }] });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      {
        listPackages: jest.fn().mockReturnValue([]),
      },
      undefined,
      {
        list: jest.fn().mockReturnValue([
          { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
          { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
        ]),
      },
    ) as PqsSummaryService & {
      search?: (query: string) => Promise<SearchResultsResponse>;
    };

    const response = await service.search?.('39');

    expect(response?.updates.status).toBe('partial');
    expect(response?.updates.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Participant 2')]),
    );
    expect(response?.updates.items).toEqual([
      {
        nodeId: 'participant-1',
        label: 'Participant 1',
        eventOffset: '39',
        updateId: 'abc123',
        recordTime: '2026-07-02T12:00:00.000Z',
        parties: ['Alice'],
      },
    ]);
  });

  it('returns all cached packages for a package name', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        listPackagesByName: jest
          .fn()
          .mockReturnValue(typedPackageFamilyFixture.packages),
      },
      undefined,
    ) as PqsSummaryService & {
      fetchPackagesByName?: (
        packageName: string,
      ) => Promise<PackageFamilyResponse>;
    };

    expect(typeof service.fetchPackagesByName).toBe('function');

    await expect(
      service.fetchPackagesByName?.('splice-amulet'),
    ).resolves.toEqual(typedPackageFamilyFixture);
  });

  it('returns cached installed packages for a node grouped by package name', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
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
      },
      undefined,
    ) as PqsSummaryService & {
      fetchNodePackages?: (node: {
        id: string;
        label: string;
      }) => Promise<NodePackagesResponse>;
    };

    expect(typeof service.fetchNodePackages).toBe('function');

    await expect(
      service.fetchNodePackages?.({
        id: 'cnqs-sv',
        label: 'CNQS Super Validator',
      }),
    ).resolves.toEqual(typedNodePackagesFixture);
  });

  it('returns active parties grouped by node and keeps empty nodes', async () => {
    const participant1Query = jest.fn(async (sql: string) => {
      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              parties: ['p|Alice', 'Bob'],
            },
          ],
        };
      }

      return { rows: [] };
    });
    const participant2Query = jest.fn(async () => ({ rows: [] }));

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      undefined,
      undefined,
    ) as PqsSummaryService & {
      fetchActiveParties?: (
        nodes: Array<{
          id: string;
          label: string;
          mode: 'pqs_only' | 'pqs_with_grpc';
        }>,
      ) => Promise<ActivePartiesResponse>;
    };

    await expect(
      service.fetchActiveParties?.([
        { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
        { id: 'participant-2', label: 'Participant 2', mode: 'pqs_with_grpc' },
      ]),
    ).resolves.toEqual({
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          mode: 'pqs_only',
          parties: ['Alice', 'Bob'],
          activePartiesStatus: 'ok',
          activePartiesError: null,
        },
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          mode: 'pqs_with_grpc',
          parties: [],
          activePartiesStatus: 'ok',
          activePartiesError: null,
        },
      ],
    });
  });

  it('returns a node-level PQS error entry when active party lookup fails', async () => {
    const participant1Query = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5542');
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: participant1Query,
        }),
      },
      undefined,
      undefined,
      undefined,
    ) as PqsSummaryService & {
      fetchActiveParties?: (
        nodes: Array<{
          id: string;
          label: string;
          mode: 'pqs_only' | 'pqs_with_grpc';
        }>,
      ) => Promise<ActivePartiesResponse>;
    };

    await expect(
      service.fetchActiveParties?.([
        { id: 'participant-1', label: 'Participant 1', mode: 'pqs_with_grpc' },
      ]),
    ).resolves.toEqual({
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          mode: 'pqs_with_grpc',
          parties: [],
          activePartiesStatus: 'pqs_error',
          activePartiesError: 'connect ECONNREFUSED 127.0.0.1:5542',
        },
      ],
    });
  });

  it('aggregates distinct parties observed during the requested rolling window', async () => {
    const participant1Query = jest.fn(async (sql: string) => {
      expect(sql).toContain('tx.effective_at');
      return { rows: [{ parties: ['p|Alice', 'Bob'] }] };
    });
    const participant2Query = jest.fn(async (sql: string) => {
      expect(sql).toContain('tx.effective_at');
      return { rows: [{ parties: ['Bob', 'Charlie'] }] };
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      undefined,
      undefined,
    ) as PqsSummaryService & {
      fetchRecentActiveParties?: (
        nodes: Array<{
          id: string;
          label: string;
          mode: 'pqs_only' | 'pqs_with_grpc';
        }>,
        hours?: number,
        now?: Date,
      ) => Promise<{
        count: number;
        windowStart: string;
        windowEnd: string;
        status: 'ok' | 'partial' | 'error';
        error: string | null;
      }>;
    };

    await expect(
      service.fetchRecentActiveParties?.(
        [
          { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
          {
            id: 'participant-2',
            label: 'Participant 2',
            mode: 'pqs_with_grpc',
          },
        ],
        24,
        new Date('2026-08-12T12:00:00.000Z'),
      ),
    ).resolves.toEqual({
      count: 3,
      windowStart: '2026-08-11T12:00:00.000Z',
      windowEnd: '2026-08-12T12:00:00.000Z',
      status: 'ok',
      error: null,
    });
  });

  it('reports a partial result when an empty successful node is mixed with a failed node', async () => {
    const participant1Query = jest.fn(async () => ({ rows: [] }));
    const participant2Query = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5542');
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      undefined,
      undefined,
    ) as PqsSummaryService & {
      fetchRecentActiveParties?: (
        nodes: Array<{
          id: string;
          label: string;
          mode: 'pqs_only' | 'pqs_with_grpc';
        }>,
      ) => Promise<{
        count: number;
        windowStart: string;
        windowEnd: string;
        status: 'ok' | 'partial' | 'error';
        error: string | null;
      }>;
    };

    await expect(
      service.fetchRecentActiveParties?.([
        { id: 'participant-1', label: 'Participant 1', mode: 'pqs_only' },
        { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
      ]),
    ).resolves.toMatchObject({
      count: 0,
      status: 'partial',
      error: 'connect ECONNREFUSED 127.0.0.1:5542',
    });
  });

  it('returns a party summary aggregated across nodes', async () => {
    const participant1Query = jest.fn(async (sql: string) => {
      if (
        sql.includes('from party_update_ix') &&
        sql.includes('event_offset') &&
        sql.includes("'Alice'") &&
        sql.includes("'p|Alice'")
      ) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_offset: '0000000000000001',
              record_time: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              parties: ['Alice', 'Bob'],
            },
          ],
        };
      }

      if (sql.includes('contract_row.contract_id::text as contract_id')) {
        return {
          rows: [
            {
              contract_id: '00abc',
              template_id: 'Main:Asset',
              package_id: 'main-package',
              record_time: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    });

    const participant2Query = jest.fn(async (sql: string) => {
      if (
        sql.includes('from party_update_ix') &&
        sql.includes('event_offset') &&
        sql.includes("'Alice'") &&
        sql.includes("'p|Alice'")
      ) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e2',
              event_offset: '0000000000000002',
              record_time: '2026-07-01T11:00:00.000Z',
            },
          ],
        };
      }

      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e2',
              parties: ['Alice'],
            },
          ],
        };
      }

      if (sql.includes('contract_row.contract_id::text as contract_id')) {
        return {
          rows: [
            {
              contract_id: '00def',
              template_id: 'Main:Asset',
              package_id: 'main-package',
              record_time: '2026-07-01T11:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      {
        getPackage: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-01T10:00:00.000Z',
          packageSize: 1024,
          data: Buffer.from('package'),
        }),
      },
      undefined,
      undefined,
      {
        fetchPartyTopology: jest
          .fn()
          .mockResolvedValueOnce(typedPartyDetailFixture.partyTopologyByNode[0])
          .mockResolvedValueOnce(
            typedPartyDetailFixture.partyTopologyByNode[1],
          ),
      },
    ) as PqsSummaryService & {
      fetchPartyDetail?: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartyDetailResponse>;
    };

    await expect(
      service.fetchPartyDetail?.(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ],
        'Alice',
      ),
    ).resolves.toEqual(typedPartyDetailFixture);
  });

  it('resolves party summary and nodes without waiting for topology', async () => {
    const deferredTopology = new Promise<never>(() => undefined);
    const grpcOperationsService = {
      listLocalParties: jest.fn().mockResolvedValue([]),
      fetchPartyTopology: jest.fn().mockReturnValue(deferredTopology),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );
    const privateService = service as unknown as {
      fetchActivePartiesForNode: jest.Mock;
      fetchPartyRecentUpdatesForNode: jest.Mock;
      fetchPartyRecentContractsForNode: jest.Mock;
    };
    privateService.fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValue(['Alice']);
    privateService.fetchPartyRecentUpdatesForNode = jest
      .fn()
      .mockResolvedValue(typedPartyDetailFixture.recentUpdates.slice(0, 1));
    privateService.fetchPartyRecentContractsForNode = jest
      .fn()
      .mockResolvedValue(typedPartyDetailFixture.recentContracts.slice(0, 1));
    const sections = service as unknown as {
      fetchPartySummary: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartySummaryResponse>;
      fetchPartyNodes: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartyNodesResponse>;
    };

    const result = await Promise.race([
      Promise.all([
        sections.fetchPartySummary(
          [{ id: 'participant-1', label: 'Participant 1' }],
          'Alice',
        ),
        sections.fetchPartyNodes(
          [{ id: 'participant-1', label: 'Participant 1' }],
          'Alice',
        ),
      ]).then((responses) => ({ kind: 'sections' as const, responses })),
      new Promise<{ kind: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ kind: 'timeout' }), 100),
      ),
    ]);

    expect(result).toEqual({
      kind: 'sections',
      responses: [
        {
          partyId: 'Alice',
          nodeCount: 1,
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
        {
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              recentUpdateCount: 1,
              recentContractCount: 1,
            },
          ],
        },
      ],
    });
    expect(grpcOperationsService.fetchPartyTopology).not.toHaveBeenCalled();
  });

  it('resolves namespace summary and nodes without waiting for topology', async () => {
    const deferredTopology = new Promise<never>(() => undefined);
    const grpcOperationsService = {
      listLocalParties: jest.fn().mockResolvedValue([]),
      fetchPartyTopology: jest.fn().mockReturnValue(deferredTopology),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );
    const privateService = service as unknown as {
      fetchActivePartiesForNode: jest.Mock;
      fetchGlobalRecentUpdates: jest.Mock;
      fetchGlobalContracts: jest.Mock;
    };
    privateService.fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValue(['Alice::1220abcd']);
    privateService.fetchGlobalRecentUpdates = jest.fn().mockResolvedValue({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      updates: typedNamespaceDetailFixture.recentUpdates,
    });
    privateService.fetchGlobalContracts = jest.fn().mockResolvedValue({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      contracts: typedNamespaceDetailFixture.recentContracts,
    });
    const sections = service as unknown as {
      fetchNamespaceSummary: (
        nodes: Array<{ id: string; label: string }>,
        namespaceId: string,
      ) => Promise<NamespaceSummaryResponse>;
      fetchNamespaceNodes: (
        nodes: Array<{ id: string; label: string }>,
        namespaceId: string,
      ) => Promise<NamespaceNodesResponse>;
    };

    const result = await Promise.race([
      Promise.all([
        sections.fetchNamespaceSummary(
          [{ id: 'participant-1', label: 'Participant 1' }],
          '1220abcd',
        ),
        sections.fetchNamespaceNodes(
          [{ id: 'participant-1', label: 'Participant 1' }],
          '1220abcd',
        ),
      ]).then((responses) => ({ kind: 'sections' as const, responses })),
      new Promise<{ kind: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ kind: 'timeout' }), 100),
      ),
    ]);

    expect(result).toEqual({
      kind: 'sections',
      responses: [
        {
          namespaceId: '1220abcd',
          partyCount: 1,
          nodeCount: 2,
          recentUpdateCount: 2,
          recentContractCount: 1,
        },
        {
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              recentUpdateCount: 1,
              recentContractCount: 0,
            },
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              recentUpdateCount: 1,
              recentContractCount: 1,
            },
          ],
        },
      ],
    });
    expect(grpcOperationsService.fetchPartyTopology).not.toHaveBeenCalled();
  });

  it('fetches paginated namespace updates and contracts for the namespace parties', async () => {
    const service = new PqsSummaryService({} as never);
    const privateService = service as unknown as {
      fetchActivePartiesForNode: jest.Mock;
      fetchGlobalRecentUpdates: jest.Mock;
      fetchGlobalContracts: jest.Mock;
    };
    privateService.fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValue(['Alice::1220abcd', 'Bob::1220abcd']);
    privateService.fetchGlobalRecentUpdates = jest.fn().mockResolvedValue({
      limit: 25,
      nextBefore: 'update-cursor-1',
      nextAfter: null,
      updates: typedNamespaceDetailFixture.recentUpdates,
    });
    privateService.fetchGlobalContracts = jest.fn().mockResolvedValue({
      limit: 20,
      nextBefore: null,
      nextAfter: 'contract-cursor-0',
      contracts: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          contractId: '00abc',
          templateId: 'Main:Asset',
          recordTime: '2026-07-09T12:00:00.000Z',
        },
      ],
    });
    const sections = service as unknown as {
      fetchNamespaceUpdates: (
        nodes: Array<{ id: string; label: string }>,
        namespaceId: string,
        options?: { limit?: number; before?: string; after?: string },
      ) => Promise<NamespaceUpdatesResponse>;
      fetchNamespaceContracts: (
        nodes: Array<{ id: string; label: string }>,
        namespaceId: string,
        options?: { limit?: number; before?: string; after?: string },
      ) => Promise<NamespaceContractsResponse>;
    };
    const nodes = [{ id: 'participant-2', label: 'Participant 2' }];

    await expect(
      sections.fetchNamespaceUpdates(nodes, '1220abcd', {
        limit: 25,
        before: 'update-cursor-0',
      }),
    ).resolves.toEqual({
      limit: 25,
      nextBefore: 'update-cursor-1',
      nextAfter: null,
      updates: typedNamespaceDetailFixture.recentUpdates,
    });
    expect(privateService.fetchGlobalRecentUpdates).toHaveBeenCalledWith(
      nodes,
      25,
      {
        before: 'update-cursor-0',
        after: undefined,
        parties: ['Alice::1220abcd', 'Bob::1220abcd'],
        partyMode: 'or',
      },
    );

    await expect(
      sections.fetchNamespaceContracts(nodes, '1220abcd', {
        limit: 20,
        after: 'contract-cursor-1',
      }),
    ).resolves.toEqual({
      limit: 20,
      nextBefore: null,
      nextAfter: 'contract-cursor-0',
      contracts: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: null,
          packageName: null,
          packageVersion: null,
          recordTime: '2026-07-09T12:00:00.000Z',
        },
      ],
    });
    expect(privateService.fetchGlobalContracts).toHaveBeenCalledWith(
      nodes,
      20,
      {
        before: undefined,
        after: 'contract-cursor-1',
        parties: ['Alice::1220abcd', 'Bob::1220abcd'],
        partyMode: 'or',
      },
    );
  });

  it('matches both stripped and prefixed party identifiers for party detail lookups', async () => {
    const strippedPartyId =
      'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df';
    const prefixedPartyId = `p|${strippedPartyId}`;
    const participantQuery = jest.fn(async (sql: string) => {
      if (
        sql.includes('from party_update_ix') &&
        sql.includes(
          "'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df'",
        ) &&
        sql.includes(
          "'p|DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df'",
        ) &&
        sql.includes('event_offset')
      ) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_offset: '39',
              record_time: '2026-07-02T12:00:00.000Z',
            },
          ],
        };
      }

      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              parties: [prefixedPartyId],
            },
          ],
        };
      }

      if (
        sql.includes('contract_row.contract_id::text as contract_id') &&
        sql.includes(
          "'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df'",
        ) &&
        sql.includes(
          "'p|DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df'",
        )
      ) {
        return {
          rows: [
            {
              contract_id: '00abc',
              template_id: 'Main:Asset',
              package_id: 'main-package',
              record_time: '2026-07-02T12:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: participantQuery,
        }),
      },
      undefined,
      {
        getPackage: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-01T10:00:00.000Z',
          packageSize: 1024,
          data: Buffer.from('package'),
        }),
      },
      undefined,
    ) as PqsSummaryService & {
      fetchPartyDetail?: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartyDetailResponse>;
    };

    await expect(
      service.fetchPartyDetail?.(
        [{ id: 'participant-1', label: 'Participant 1' }],
        strippedPartyId,
      ),
    ).resolves.toEqual({
      partyId: strippedPartyId,
      nodeCount: 1,
      recentUpdateCount: 1,
      recentContractCount: 1,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '39',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-02T12:00:00.000Z',
          parties: [strippedPartyId],
          estimatedTrafficUsd: null,
          estimatedTrafficUsd: null,
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: 'main-package',
          packageName: 'Main Package',
          packageVersion: '1.2.3',
          recordTime: '2026-07-02T12:00:00.000Z',
        },
      ],
      partyTopologyByNode: [],
    });
  });

  it('returns party detail for an active party even when it has no recent updates or contracts', async () => {
    const activeOnlyPartyId =
      'ed25519_party::1220715ab025d3477024c0cf1fa9cb90b9cfdeddd249578ef2de2f9fc4cf8eb19289';
    const participantQuery = jest.fn(async (sql: string) => {
      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              parties: [activeOnlyPartyId],
            },
          ],
        };
      }

      return { rows: [] };
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: participantQuery,
        }),
      },
      undefined,
      {
        getPackage: jest.fn(),
      },
      undefined,
    ) as PqsSummaryService & {
      fetchPartyDetail?: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartyDetailResponse>;
    };

    await expect(
      service.fetchPartyDetail?.(
        [{ id: 'participant-1', label: 'Participant 1' }],
        activeOnlyPartyId,
      ),
    ).resolves.toEqual({
      partyId: activeOnlyPartyId,
      nodeCount: 1,
      recentUpdateCount: 0,
      recentContractCount: 0,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 0,
          recentContractCount: 0,
        },
      ],
      recentUpdates: [],
      recentContracts: [],
      partyTopologyByNode: [],
    });
  });

  it('returns party detail for a local gRPC-only party even when PQS has no recent observations', async () => {
    const localOnlyPartyId =
      'ed25519_party::1220715ab025d3477024c0cf1fa9cb90b9cfdeddd249578ef2de2f9fc4cf8eb19289';
    const participantQuery = jest.fn(async (sql: string) => {
      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              parties: [],
            },
          ],
        };
      }

      return { rows: [] };
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: participantQuery,
        }),
      },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        listLocalParties: jest.fn(async () => [localOnlyPartyId]),
        fetchPartyTopology: jest.fn(async () => ({
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          isLocalParty: null,
          partyToParticipants: [],
          partyToKeyMappings: [],
        })),
      },
    ) as PqsSummaryService & {
      fetchPartyDetail?: (
        nodes: Array<{
          id: string;
          label: string;
          mode?: 'pqs_only' | 'pqs_with_grpc';
        }>,
        partyId: string,
      ) => Promise<PartyDetailResponse>;
    };

    await expect(
      service.fetchPartyDetail?.(
        [
          {
            id: 'participant-1',
            label: 'Participant 1',
            mode: 'pqs_with_grpc',
          },
        ],
        localOnlyPartyId,
      ),
    ).resolves.toEqual({
      partyId: localOnlyPartyId,
      nodeCount: 1,
      recentUpdateCount: 0,
      recentContractCount: 0,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 0,
          recentContractCount: 0,
        },
      ],
      recentUpdates: [],
      recentContracts: [],
      partyTopologyByNode: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          isLocalParty: true,
          partyToParticipants: [],
          partyToKeyMappings: [],
        },
      ],
    });
  });

  it('returns namespace detail aggregated across all matching parties by exact namespace suffix', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: jest.fn().mockResolvedValue({ rows: [] }),
        }),
      },
      undefined,
      {
        getPackage: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-01T10:00:00.000Z',
          packageSize: 1024,
          data: Buffer.from('package'),
        }),
      },
      undefined,
      undefined,
      {
        fetchPartyTopology: jest
          .fn()
          .mockResolvedValueOnce({
            nodeId: 'participant-1',
            label: 'Participant 1',
            status: 'ok',
            errorMessage: null,
            isLocalParty: true,
            partyToParticipants: [
              {
                participantId: null,
                participantUid: 'participant-1::1220aaa',
                permission: 'confirmation',
                threshold: 1,
                synchronizerIds: ['global-domain::1220aa'],
              },
            ],
            partyToKeyMappings: [
              {
                keyFingerprint: '1220abcd',
                publicKey: null,
                purpose: 'namespace',
                keyType: 'ed25519',
                keyFormat: 'derX509SubjectPublicKeyInfo',
                keySpec: 'ecCurve25519',
                threshold: 1,
                synchronizerIds: ['global-domain::1220aa'],
              },
            ],
          })
          .mockResolvedValueOnce({
            nodeId: 'participant-1',
            label: 'Participant 1',
            status: 'ok',
            errorMessage: null,
            isLocalParty: true,
            partyToParticipants: [
              {
                participantId: null,
                participantUid: 'participant-1::1220aaa',
                permission: 'confirmation',
                threshold: 1,
                synchronizerIds: ['global-domain::1220aa'],
              },
            ],
            partyToKeyMappings: [
              {
                keyFingerprint: '1220abcd',
                publicKey: null,
                purpose: 'namespace',
                keyType: 'ed25519',
                keyFormat: 'derX509SubjectPublicKeyInfo',
                keySpec: 'ecCurve25519',
                threshold: 1,
                synchronizerIds: ['global-domain::1220aa'],
              },
            ],
          })
          .mockResolvedValueOnce({
            nodeId: 'participant-2',
            label: 'Participant 2',
            status: 'grpc_not_configured',
            errorMessage: null,
            isLocalParty: null,
            partyToParticipants: [],
            partyToKeyMappings: [],
          }),
      },
    ) as PqsSummaryService & {
      fetchNamespaceDetail?: (
        nodes: Array<{
          id: string;
          label: string;
          mode?: 'pqs_only' | 'pqs_with_grpc';
        }>,
        namespaceId: string,
      ) => Promise<NamespaceDetailResponse>;
    };

    (service as any).fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValueOnce(['Alice::1220abcd'])
      .mockResolvedValueOnce([
        'Alice::1220abcd',
        'Bob::1220abcd',
        'Carol::1220eeee',
      ]);
    (service as any).fetchGlobalRecentUpdates = jest.fn().mockResolvedValue({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      updates: typedNamespaceDetailFixture.recentUpdates,
    });
    (service as any).fetchGlobalContracts = jest.fn().mockResolvedValue({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      contracts: typedNamespaceDetailFixture.recentContracts,
    });

    await expect(
      service.fetchNamespaceDetail?.(
        [
          {
            id: 'participant-1',
            label: 'Participant 1',
            mode: 'pqs_with_grpc',
          },
          { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
        ],
        '1220abcd',
      ),
    ).resolves.toEqual(typedNamespaceDetailFixture);
  });

  it('keeps namespace detail available when PQS fails for one node', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: jest.fn().mockResolvedValue({ rows: [] }),
        }),
      },
      undefined,
      {
        getPackage: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-01T10:00:00.000Z',
          packageSize: 1024,
          data: Buffer.from('package'),
        }),
      },
      undefined,
      undefined,
      {
        fetchPartyTopology: jest.fn().mockResolvedValueOnce({
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          isLocalParty: true,
          partyToParticipants: [
            {
              participantId: null,
              participantUid: 'participant-1::1220aaa',
              permission: 'confirmation',
              threshold: 1,
              synchronizerIds: ['global-domain::1220aa'],
            },
          ],
          partyToKeyMappings: [
            {
              keyFingerprint: '1220abcd',
              publicKey: null,
              purpose: 'namespace',
              keyType: 'ed25519',
              keyFormat: 'derX509SubjectPublicKeyInfo',
              keySpec: 'ecCurve25519',
              threshold: 1,
              synchronizerIds: ['global-domain::1220aa'],
            },
          ],
        }),
      },
    ) as PqsSummaryService & {
      fetchNamespaceDetail?: (
        nodes: Array<{
          id: string;
          label: string;
          mode?: 'pqs_only' | 'pqs_with_grpc';
        }>,
        namespaceId: string,
      ) => Promise<NamespaceDetailResponse>;
    };

    (service as any).fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValueOnce(['Alice::1220abcd'])
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5542'));
    (service as any).fetchGlobalRecentUpdates = jest.fn().mockResolvedValue({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '42',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-09T12:00:00.000Z',
          parties: ['Alice::1220abcd'],
        },
      ],
    });
    (service as any).fetchGlobalContracts = jest.fn().mockResolvedValue({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      contracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          recordTime: '2026-07-09T12:00:00.000Z',
        },
      ],
    });

    await expect(
      service.fetchNamespaceDetail?.(
        [
          {
            id: 'participant-1',
            label: 'Participant 1',
            mode: 'pqs_with_grpc',
          },
          { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
        ],
        '1220abcd',
      ),
    ).resolves.toEqual({
      namespaceId: '1220abcd',
      partyCount: 1,
      nodeCount: 1,
      recentUpdateCount: 1,
      recentContractCount: 1,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '42',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-09T12:00:00.000Z',
          parties: ['Alice::1220abcd'],
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: null,
          packageName: null,
          packageVersion: null,
          recordTime: '2026-07-09T12:00:00.000Z',
        },
      ],
      topologyByNode: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          partyToParticipants: [
            {
              participantId: null,
              participantUid: 'participant-1::1220aaa',
              permission: 'confirmation',
              threshold: 1,
              synchronizerIds: ['global-domain::1220aa'],
            },
          ],
          partyToKeyMappings: [
            {
              keyFingerprint: '1220abcd',
              publicKey: null,
              purpose: 'namespace',
              keyType: 'ed25519',
              keyFormat: 'derX509SubjectPublicKeyInfo',
              keySpec: 'ecCurve25519',
              threshold: 1,
              synchronizerIds: ['global-domain::1220aa'],
            },
          ],
        },
      ],
    });
  });

  it('returns paginated namespace parties aggregated by exact namespace suffix', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async () => ({
          query: jest.fn().mockResolvedValue({ rows: [] }),
        }),
      },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        listLocalParties: jest
          .fn()
          .mockResolvedValueOnce(['Alice::1220abcd'])
          .mockResolvedValueOnce([
            'Alice::1220abcd',
            'Bob::1220abcd',
            'Carol::1220eeee',
          ]),
      },
    ) as PqsSummaryService & {
      fetchNamespaceParties?: (
        nodes: Array<{
          id: string;
          label: string;
          mode?: 'pqs_only' | 'pqs_with_grpc';
        }>,
        namespaceId: string,
        options?: { limit?: number; before?: string; after?: string },
      ) => Promise<NamespacePartiesResponse>;
    };

    (service as any).fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValueOnce(['Alice::1220abcd'])
      .mockResolvedValueOnce([
        'Alice::1220abcd',
        'Bob::1220abcd',
        'Carol::1220eeee',
      ]);

    await expect(
      service.fetchNamespaceParties?.(
        [
          {
            id: 'participant-1',
            label: 'Participant 1',
            mode: 'pqs_with_grpc',
          },
          { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
        ],
        '1220abcd',
        { limit: 15 },
      ),
    ).resolves.toEqual(typedNamespacePartiesFixture);
  });

  it('returns namespace parties from healthy nodes when another node PQS is unavailable', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )({
      getRawExecutor: async () => ({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      }),
    }) as PqsSummaryService & {
      fetchNamespaceParties?: (
        nodes: Array<{
          id: string;
          label: string;
          mode?: 'pqs_only' | 'pqs_with_grpc';
        }>,
        namespaceId: string,
        options?: { limit?: number; before?: string; after?: string },
      ) => Promise<NamespacePartiesResponse>;
    };

    (service as any).fetchActivePartiesForNode = jest
      .fn()
      .mockResolvedValueOnce(['Alice::1220abcd'])
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5542'));

    await expect(
      service.fetchNamespaceParties?.(
        [
          {
            id: 'participant-1',
            label: 'Participant 1',
            mode: 'pqs_with_grpc',
          },
          { id: 'participant-2', label: 'Participant 2', mode: 'pqs_only' },
        ],
        '1220abcd',
        { limit: 15 },
      ),
    ).resolves.toEqual({
      namespaceId: '1220abcd',
      partyCount: 1,
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      parties: [
        {
          partyId: 'Alice::1220abcd',
        },
      ],
    });
  });

  it('keeps party detail available when topology fails for one node', async () => {
    const participant1Query = jest.fn(async (sql: string) => {
      if (
        sql.includes('from party_update_ix') &&
        sql.includes('event_offset') &&
        sql.includes("'Alice'") &&
        sql.includes("'p|Alice'")
      ) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_offset: '0000000000000001',
              record_time: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              parties: ['Alice'],
            },
          ],
        };
      }

      if (sql.includes('contract_row.contract_id::text as contract_id')) {
        return {
          rows: [
            {
              contract_id: '00abc',
              template_id: 'Main:Asset',
              package_id: 'main-package',
              record_time: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1'
              ? participant1Query
              : jest.fn(async () => ({ rows: [] })),
        }),
      },
      undefined,
      {
        getPackage: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-01T10:00:00.000Z',
          packageSize: 1024,
          data: Buffer.from('package'),
        }),
      },
      undefined,
      undefined,
      {
        fetchPartyTopology: jest
          .fn()
          .mockResolvedValueOnce({
            nodeId: 'participant-1',
            label: 'Participant 1',
            status: 'ok',
            errorMessage: null,
            partyToParticipants: [],
            partyToKeyMappings: [],
          })
          .mockResolvedValueOnce({
            nodeId: 'participant-2',
            label: 'Participant 2',
            status: 'grpc_error',
            errorMessage: 'Topology read failed',
            partyToParticipants: [],
            partyToKeyMappings: [],
          }),
      },
    ) as PqsSummaryService & {
      fetchPartyDetail?: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartyDetailResponse>;
    };

    await expect(
      service.fetchPartyDetail?.(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ],
        'Alice',
      ),
    ).resolves.toEqual({
      partyId: 'Alice',
      nodeCount: 1,
      recentUpdateCount: 1,
      recentContractCount: 1,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '0000000000000001',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
          estimatedTrafficUsd: null,
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: 'main-package',
          packageName: 'Main Package',
          packageVersion: '1.2.3',
          recordTime: '2026-07-01T12:00:00.000Z',
        },
      ],
      partyTopologyByNode: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          isLocalParty: false,
          partyToParticipants: [],
          partyToKeyMappings: [],
        },
      ],
    });
  });

  it('keeps party detail available when PQS fails for one node', async () => {
    const participant1Query = jest.fn(async (sql: string) => {
      if (
        sql.includes('from party_update_ix') &&
        sql.includes('event_offset') &&
        sql.includes("'Alice'") &&
        sql.includes("'p|Alice'")
      ) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              event_offset: '0000000000000001',
              record_time: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      if (sql.includes('array_agg(distinct party order by party) as parties')) {
        return {
          rows: [
            {
              update_id:
                '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
              parties: ['Alice'],
            },
          ],
        };
      }

      if (sql.includes('contract_row.contract_id::text as contract_id')) {
        return {
          rows: [
            {
              contract_id: '00abc',
              template_id: 'Main:Asset',
              package_id: 'main-package',
              record_time: '2026-07-01T12:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    });

    const participant2Query = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5542');
    });

    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      },
      undefined,
      {
        getPackage: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: '2026-07-01T10:00:00.000Z',
          packageSize: 1024,
          data: Buffer.from('package'),
        }),
      },
      undefined,
      undefined,
      {
        fetchPartyTopology: jest.fn().mockResolvedValue({
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          partyToParticipants: [],
          partyToKeyMappings: [],
        }),
      },
    ) as PqsSummaryService & {
      fetchPartyDetail?: (
        nodes: Array<{ id: string; label: string }>,
        partyId: string,
      ) => Promise<PartyDetailResponse>;
    };

    await expect(
      service.fetchPartyDetail?.(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ],
        'Alice',
      ),
    ).resolves.toEqual({
      partyId: 'Alice',
      nodeCount: 1,
      recentUpdateCount: 1,
      recentContractCount: 1,
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          recentUpdateCount: 1,
          recentContractCount: 1,
        },
      ],
      recentUpdates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '0000000000000001',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
          estimatedTrafficUsd: null,
        },
      ],
      recentContracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Asset',
          packageId: 'main-package',
          packageName: 'Main Package',
          packageVersion: '1.2.3',
          recordTime: '2026-07-01T12:00:00.000Z',
        },
      ],
      partyTopologyByNode: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          status: 'ok',
          errorMessage: null,
          isLocalParty: false,
          partyToParticipants: [],
          partyToKeyMappings: [],
        },
      ],
    });
  });

  it('returns decoded package detail with metadata, node presence, and decoded structure', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
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
      },
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
                  ],
                },
                choices: representativeTemplateChoices,
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
            moduleCount: 1,
            templateCount: 1,
            dataTypeCount: 1,
          },
        }),
      },
    ) as PqsSummaryService & {
      fetchPackageDetail?: (
        packageId: string,
      ) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(
      service.fetchPackageDetail?.('splice-amulet'),
    ).resolves.toEqual(typedPackageDetailFixture);
  });

  it('exposes package detail sections independently', async () => {
    const metadata = {
      packageId: 'splice-amulet',
      name: 'splice-amulet',
      version: '0.1.24',
      uploadedAt: '1782930571952849',
      packageSize: 960436,
    };
    const inspectPackage = jest.fn().mockResolvedValue({
      ok: true,
      definition: {
        packageId: metadata.packageId,
        packageName: metadata.name,
        packageVersion: metadata.version,
        modules: ['Splice.Amulet'],
        templates: typedPackageDetailFixture.templates,
        dataTypes: typedPackageDetailFixture.dataTypes,
        moduleCount: 1,
        templateCount: 1,
        dataTypeCount: 1,
      },
    });
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue(metadata),
        listNodesForPackage: jest.fn().mockReturnValue([
          {
            nodeId: 'cnqs-sv',
            packageName: 'splice-amulet',
            packageVersion: '0.1.24',
            seenAt: '2026-07-02T12:00:00.000Z',
          },
        ]),
      },
      { inspectPackage },
    ) as PqsSummaryService & {
      fetchPackageSummary?: (
        packageId: string,
      ) => Promise<PackageDetailSummaryResponse>;
      fetchPackageNodes?: (
        packageId: string,
      ) => Promise<PackageDetailNodesResponse>;
      fetchPackageModules?: (
        packageId: string,
      ) => Promise<PackageDetailModulesResponse>;
      fetchPackageTemplates?: (
        packageId: string,
      ) => Promise<PackageDetailTemplatesResponse>;
      fetchPackageDataTypes?: (
        packageId: string,
      ) => Promise<PackageDetailDataTypesResponse>;
    };

    const [summary, nodes, modules, templates, dataTypes] = await Promise.all([
      service.fetchPackageSummary?.('splice-amulet'),
      service.fetchPackageNodes?.('splice-amulet'),
      service.fetchPackageModules?.('splice-amulet'),
      service.fetchPackageTemplates?.('splice-amulet'),
      service.fetchPackageDataTypes?.('splice-amulet'),
    ]);

    expect(summary).toEqual({
      packageId: 'splice-amulet',
      name: 'splice-amulet',
      version: '0.1.24',
      uploadedAt: '1782930571952849',
      packageSize: 960436,
      status: 'decoded',
      moduleCount: 1,
      templateCount: 1,
      dataTypeCount: 1,
    });
    expect(nodes).toEqual({
      packageId: 'splice-amulet',
      seenOnNodes: [
        {
          nodeId: 'cnqs-sv',
          packageName: 'splice-amulet',
          packageVersion: '0.1.24',
          seenAt: '2026-07-02T12:00:00.000Z',
        },
      ],
    });
    expect(modules).toEqual({
      packageId: 'splice-amulet',
      status: 'decoded',
      modules: ['Splice.Amulet'],
    });
    expect(templates).toEqual({
      packageId: 'splice-amulet',
      status: 'decoded',
      templates: typedPackageDetailFixture.templates,
    });
    expect(dataTypes).toEqual({
      packageId: 'splice-amulet',
      status: 'decoded',
      dataTypes: typedPackageDetailFixture.dataTypes,
    });
    expect(inspectPackage).toHaveBeenCalledTimes(4);
  });

  it('returns only the definitions belonging to the requested module', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: null,
          packageSize: 1024,
        }),
      },
      {
        inspectPackage: jest.fn().mockResolvedValue({
          ok: true,
          definition: {
            packageId: 'main-package',
            packageName: 'Main Package',
            packageVersion: '1.2.3',
            modules: ['Main.Module', 'Other.Module'],
            templates: [
              {
                templateId: 'Main.Module:Asset',
                moduleName: 'Main.Module',
                entityName: 'Asset',
                createType: null,
                choices: representativeTemplateChoices,
              },
              {
                templateId: 'Other.Module:OtherAsset',
                moduleName: 'Other.Module',
                entityName: 'OtherAsset',
                createType: null,
              },
            ],
            dataTypes: [
              {
                typeId: 'Main.Module:AssetData',
                moduleName: 'Main.Module',
                entityName: 'AssetData',
                definition: null,
              },
            ],
            moduleCount: 2,
            templateCount: 2,
            dataTypeCount: 1,
          },
        }),
      },
    ) as PqsSummaryService & {
      fetchPackageModule?: (
        packageId: string,
        moduleName: string,
      ) => Promise<PackageModuleDetailResponse>;
    };

    await expect(
      service.fetchPackageModule?.('main-package', 'Main.Module'),
    ).resolves.toEqual({
      packageId: 'main-package',
      name: 'Main Package',
      version: '1.2.3',
      uploadedAt: null,
      packageSize: 1024,
      status: 'decoded',
      moduleName: 'Main.Module',
      templates: [
        {
          templateId: 'Main.Module:Asset',
          moduleName: 'Main.Module',
          entityName: 'Asset',
          createType: null,
          choices: representativeTemplateChoices,
        },
      ],
      dataTypes: [
        {
          typeId: 'Main.Module:AssetData',
          moduleName: 'Main.Module',
          entityName: 'AssetData',
          definition: null,
        },
      ],
    });
  });

  it('returns a template detail from the requested package', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue({
          packageId: 'main-package',
          name: 'Main Package',
          version: '1.2.3',
          uploadedAt: null,
          packageSize: 1024,
        }),
      },
      {
        inspectPackage: jest.fn().mockResolvedValue({
          ok: true,
          definition: {
            packageId: 'main-package',
            packageName: 'Main Package',
            packageVersion: '1.2.3',
            modules: ['Main.Module'],
            templates: [typedPackageDetailFixture.templates[0]],
            dataTypes: [],
            moduleCount: 1,
            templateCount: 1,
            dataTypeCount: 0,
          },
        }),
      },
    ) as PqsSummaryService & {
      fetchPackageTemplate?: (
        packageId: string,
        templateId: string,
      ) => Promise<PackageTemplateDetailResponse>;
    };

    const templateDetail = await service.fetchPackageTemplate?.(
      'main-package',
      'Splice.Amulet:SvRewardCoupon',
    );

    expect(templateDetail?.template?.choices).toEqual(
      representativeTemplateChoices,
    );
    expect(templateDetail).toEqual({
      packageId: 'main-package',
      name: 'Main Package',
      version: '1.2.3',
      uploadedAt: null,
      packageSize: 1024,
      status: 'decoded',
      template: typedPackageDetailFixture.templates[0],
    });
  });

  it('returns invalid package detail with metadata but empty decoded lists', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
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
      },
      {
        inspectPackage: jest.fn().mockResolvedValue({
          ok: false,
          reason: 'invalid_package',
        }),
      },
    ) as PqsSummaryService & {
      fetchPackageDetail?: (
        packageId: string,
      ) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(
      service.fetchPackageDetail?.('broken-package'),
    ).resolves.toEqual({
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

  it('returns not-available package detail when metadata exists but package bytes do not', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue({
          packageId: 'pqs-only-package',
          name: 'pqs-only-package',
          version: '3.5.2',
          uploadedAt: null,
          packageSize: null,
        }),
        listNodesForPackage: jest.fn().mockReturnValue([
          {
            nodeId: 'participant-1',
            packageId: 'pqs-only-package',
            mainPackageId: 'pqs-only-package',
            packageName: 'pqs-only-package',
            packageVersion: '3.5.2',
            uploadedAt: null,
            packageSize: null,
            seenAt: '2026-07-11T10:00:00.000Z',
          },
        ]),
      },
      {
        inspectPackage: jest.fn().mockResolvedValue({
          ok: false,
          reason: 'missing_package',
        }),
      },
    ) as PqsSummaryService & {
      fetchPackageDetail?: (
        packageId: string,
      ) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(
      service.fetchPackageDetail?.('pqs-only-package'),
    ).resolves.toEqual({
      packageId: 'pqs-only-package',
      name: 'pqs-only-package',
      version: '3.5.2',
      uploadedAt: null,
      packageSize: null,
      status: 'not_available',
      seenOnNodes: [
        {
          nodeId: 'participant-1',
          packageName: 'pqs-only-package',
          packageVersion: '3.5.2',
          seenAt: '2026-07-11T10:00:00.000Z',
        },
      ],
      moduleCount: 0,
      templateCount: 0,
      dataTypeCount: 0,
      modules: [],
      templates: [],
      dataTypes: [],
    });
  });

  it('throws Package not found for unknown package ids', async () => {
    const service = new (
      PqsSummaryService as unknown as new (...args: any[]) => PqsSummaryService
    )(
      { getRawExecutor: async () => ({ query: jest.fn() }) },
      undefined,
      {
        getPackageMetadata: jest.fn().mockReturnValue(null),
        listNodesForPackage: jest.fn(),
      },
      {
        inspectPackage: jest.fn(),
      },
    ) as PqsSummaryService & {
      fetchPackageDetail?: (
        packageId: string,
      ) => Promise<PackageDetailResponse>;
    };

    expect(typeof service.fetchPackageDetail).toBe('function');

    await expect(
      service.fetchPackageDetail?.('missing-package'),
    ).rejects.toThrow('Package not found');
  });

  it('returns a normalized ledger summary from schema-qualified PQS tables', async () => {
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

    const getRawExecutor = jest.fn().mockResolvedValue({ query });
    const service = new PqsSummaryService({ getRawExecutor } as never);

    const summary = await service.fetchSummary({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('from "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('from "public"."__transactions" tx'),
    );
    expect(getRawExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-1' }),
    );
    expect(summary.activeContractCount).toBe(12);
    expect(summary.totalUpdateCount).toBe(1442);
    expect(summary.ledgerLabel).toBe('Retail Ledger');
  });

  it('uses the configured non-default PQS schema for summary queries', async () => {
    const query = jest.fn().mockResolvedValueOnce({
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
      getRawExecutor: async () => ({ query }),
    } as never);

    const summary = await service.fetchSummary({
      id: 'participant-2',
      label: 'Participant 2',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Quickstart App User',
      pqs: { connectionUriEnv: 'PARTICIPANT_2_PQS_URL', schema: 'scribe' },
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('from "scribe"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('from "scribe"."__transactions" tx'),
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
      getRawExecutor: async () => ({ query }),
    } as never);

    const updates = await service.fetchRecentUpdates({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from "public"."__transactions" tx'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('order by tx.offset desc'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('limit 31'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('join "public"."__exercises" exercise_row'),
    );
    expect(updates).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          eventOffset: '000000000000000101',
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          estimatedTrafficUsd: null,
          parties: [
            'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
            'app_provider_quickstart-helena-1::122083ea37f868bc1df967ab64179ba230e243296096d6333d3063f2f0de05d278bf',
          ],
        },
        {
          eventOffset: '000000000000000100',
          updateId: '00000000000000000000000000000000',
          recordTime: '2026-07-01T11:59:00.000Z',
          estimatedTrafficUsd: null,
          parties: [],
        },
      ],
    });
  });

  it('builds uncorrelated bounded party candidates before loading transactions', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchRecentUpdates(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { parties: ['Alice'] },
    );

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('with party_0_update_ix as materialized');
    expect(sql).toContain('party_update_ix as materialized');
    expect(sql).toContain(
      'select distinct contract_row.created_at_ix as update_ix',
    );
    expect(sql).toContain(
      'select distinct contract_row.archived_at_ix as update_ix',
    );
    expect(sql).toContain(
      'select distinct exercise_row.exercised_at_ix as update_ix',
    );
    expect(sql).toMatch(
      /from party_update_ix\s+join "public"\."__transactions" tx\s+on tx\.ix = party_update_ix\.update_ix/,
    );
    expect(sql).not.toContain('contract_row.created_at_ix = tx.ix');
    expect(sql).not.toContain('contract_row.archived_at_ix = tx.ix');
    expect(sql).not.toContain('exercise_row.exercised_at_ix = tx.ix');
    expect(sql).toContain('order by contract_row.created_at_ix desc');
    expect(sql).toContain('order by contract_row.archived_at_ix desc');
    expect(sql).toContain('order by exercise_row.exercised_at_ix desc');
    expect(sql).toContain('limit 31');
  });

  it.each([
    {
      name: 'forward OR',
      cursor: { after: '40' },
      partyMode: 'or',
      operator: '>',
      direction: 'asc',
      cursorLookup: 'cursor_tx.offset <= 40',
    },
    {
      name: 'backward AND',
      cursor: { before: '80' },
      partyMode: 'and',
      operator: '<',
      direction: 'desc',
      cursorLookup: 'cursor_tx.offset >= 80',
    },
  ])(
    'bounds every party/template event candidate branch for $name pagination',
    async ({ cursor, partyMode, operator, direction, cursorLookup }) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { type_source: 'contract', pk: '17' },
            { type_source: 'exercise', pk: '29' },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });
      const service = new PqsSummaryService({
        getRawExecutor: async () => ({ query }),
      } as never);

      await service.fetchRecentUpdates(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        {
          limit: 3,
          ...cursor,
          parties: ['Alice', 'Bob'],
          partyMode,
          templates: ['Main:Asset'],
        },
      );

      const sql = String(query.mock.calls[1]?.[0]);
      expect(sql).toContain('party_0_update_ix as materialized');
      expect(sql).toContain('party_1_update_ix as materialized');
      expect(sql).toContain('party_update_ix as materialized');
      expect(sql).toContain('template_update_ix as materialized');
      expect(sql).toContain('filtered_update_ix as materialized');
      expect(sql).toContain(cursorLookup);

      for (const eventColumn of [
        'contract_row.created_at_ix',
        'contract_row.archived_at_ix',
        'exercise_row.exercised_at_ix',
      ]) {
        const escapedColumn = eventColumn.replace('.', '\\.');
        expect(
          sql.match(
            new RegExp(
              `${escapedColumn} \\${operator} \\(select cursor_ix from update_cursor\\)`,
              'g',
            ),
          ),
        ).toHaveLength(6);
        expect(
          sql.match(
            new RegExp(
              `order by ${escapedColumn} ${direction}\\s+limit 4`,
              'g',
            ),
          ),
        ).toHaveLength(3);
        expect(
          sql.match(
            new RegExp(
              `order by ${escapedColumn} ${direction}\\s+offset 4\\s+limit 1`,
              'g',
            ),
          ),
        ).toHaveLength(3);
      }
      expect(sql).not.toContain('contract_row.created_at_ix = tx.ix');
      expect(sql).not.toContain('contract_row.archived_at_ix = tx.ix');
      expect(sql).not.toContain('exercise_row.exercised_at_ix = tx.ix');
    },
  );

  it('applies party filters in schema-qualified recent update queries', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '9130',
            record_time: '2026-07-03T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice'],
          },
        ],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchRecentUpdates(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        {
          limit: 30,
          parties: ['Alice'],
          mode: 'and',
        },
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          eventOffset: '9130',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-03T12:00:00.000Z',
          estimatedTrafficUsd: null,
          parties: ['Alice'],
        },
      ],
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from party_update_ix'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'Alice'"),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'p|Alice'"),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('contract_row.witnesses'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('exercise_row.witnesses'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
  });

  it('applies template filters when fetching recent updates from schema-qualified PQS tables', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [{ pk: '17' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '9130',
            record_time: '2026-07-03T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice'],
          },
        ],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchRecentUpdates(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        {
          limit: 30,
          templates: ['Splice.DsoRules:DsoRules'],
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        updates: [
          expect.objectContaining({
            eventOffset: '9130',
          }),
        ],
      }),
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        "contract_tpe_row.module_name = 'Splice.DsoRules'",
      ),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('contract_row.tpe_pk in (17)'),
    );
  });

  it('prunes contract partitions for template-filtered recent updates', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { type_source: 'contract', pk: '17' },
          { type_source: 'contract', pk: '29' },
          { type_source: 'exercise', pk: '71' },
          { type_source: 'exercise', pk: '83' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchRecentUpdates(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { templates: ['Splice.Amulet:Amulet'] },
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("contract_tpe_row.module_name = 'Splice.Amulet'"),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("exercise_tpe_row.module_name = 'Splice.Amulet'"),
    );
    const sql = String(query.mock.calls[1]?.[0]);
    expect(sql).toContain('contract_row.tpe_pk in (17, 29)');
    expect(sql).toContain('exercise_row.tpe_pk in (71, 83)');
    expect(sql).not.toContain('update_event_templates.template_id');
  });

  it('pushes hide Splice filtering into schema-qualified recent updates queries without per-update event lookups', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            event_offset: '9130',
            record_time: '2026-07-03T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            parties: ['Alice'],
          },
        ],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);
    const fetchEventsSpy = jest
      .spyOn(service as never, 'fetchEventsByUpdateId' as never)
      .mockResolvedValue([
        {
          eventKind: 'create',
          eventId: '#0:0',
          contractId: '00abc',
          templateId: 'Main.Asset:Holding',
          choice: null,
          witnesses: ['Alice'],
          createData: null,
          exerciseData: null,
          raw: {},
        },
      ]);

    await expect(
      service.fetchRecentUpdates(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        {
          limit: 30,
          hideSplice: true,
        },
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          eventOffset: '9130',
          updateId:
            '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
          recordTime: '2026-07-03T12:00:00.000Z',
          estimatedTrafficUsd: null,
          parties: ['Alice'],
        },
      ],
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('contract_tpe_row.module_name'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('visible_update_ix as materialized'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("not like 'Splice.%'"),
    );
    expect(fetchEventsSpy).not.toHaveBeenCalled();
  });

  it('returns cursor metadata for older update pagination windows', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: '\\x00000000000000000000000000000009',
            event_offset: '109',
            record_time: '2026-07-01T12:09:00.000Z',
          },
          {
            update_id: '\\x00000000000000000000000000000008',
            event_offset: '108',
            record_time: '2026-07-01T12:08:00.000Z',
          },
          {
            update_id: '\\x00000000000000000000000000000007',
            event_offset: '107',
            record_time: '2026-07-01T12:07:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    const updates = await service.fetchRecentUpdates(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      {
        limit: 2,
        before: '110',
      },
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('tx.offset < 110'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('limit 3'),
    );
    expect(updates).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 2,
      nextBefore: '108',
      nextAfter: '109',
      updates: [
        {
          eventOffset: '109',
          updateId: '00000000000000000000000000000009',
          recordTime: '2026-07-01T12:09:00.000Z',
          estimatedTrafficUsd: null,
          parties: [],
        },
        {
          eventOffset: '108',
          updateId: '00000000000000000000000000000008',
          recordTime: '2026-07-01T12:08:00.000Z',
          estimatedTrafficUsd: null,
          parties: [],
        },
      ],
    });
  });

  it('paginates merged global updates with opaque cross-node cursors', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query: jest.fn() }),
    } as never);

    jest
      .spyOn(service, 'fetchRecentUpdates')
      .mockImplementation(async (node, options) => {
        expect(options).toEqual(
          expect.objectContaining({
            limit: 3,
            parties: ['Alice'],
            partyMode: 'and',
            hideSplice: true,
          }),
        );
        expect(options).not.toHaveProperty('before', '202');
        expect(options).not.toHaveProperty('after', '202');

        if (node.id === 'participant-1') {
          return {
            nodeId: 'participant-1',
            label: 'Participant 1',
            limit: 3,
            nextBefore: null,
            nextAfter: null,
            updates: [
              {
                eventOffset: '103',
                updateId: '00000000000000000000000000000003',
                recordTime: '2026-07-01T12:03:00.000Z',
                parties: ['Alice'],
              },
              {
                eventOffset: '101',
                updateId: '00000000000000000000000000000001',
                recordTime: '2026-07-01T12:01:00.000Z',
                parties: ['Alice'],
              },
              {
                eventOffset: '099',
                updateId: '00000000000000000000000000000000',
                recordTime: '2026-07-01T11:59:00.000Z',
                parties: ['Alice'],
              },
            ],
          };
        }

        return {
          nodeId: 'participant-2',
          label: 'Participant 2',
          limit: 4,
          nextBefore: null,
          nextAfter: null,
          updates: [
            {
              eventOffset: '202',
              updateId: '00000000000000000000000000000012',
              recordTime: '2026-07-01T12:02:00.000Z',
              parties: ['Alice'],
            },
            {
              eventOffset: '201',
              updateId: '00000000000000000000000000000011',
              recordTime: '2026-07-01T12:01:00.000Z',
              parties: ['Alice'],
            },
            {
              eventOffset: '198',
              updateId: '00000000000000000000000000000010',
              recordTime: '2026-07-01T11:58:00.000Z',
              parties: ['Alice'],
            },
          ],
        };
      });

    const nodes = [
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant' as const,
        mode: 'pqs_only' as const,
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant' as const,
        mode: 'pqs_only' as const,
        ledgerLabel: 'Retail Ledger 2',
        pqs: { connectionUriEnv: 'PARTICIPANT_2_PQS_URL' },
      },
    ];

    const firstPage = await service.fetchGlobalRecentUpdates(nodes, 2, {
      parties: ['Alice'],
      mode: 'and',
      hideSplice: true,
    });

    expect(
      firstPage.updates.map(
        (update) => `${update.nodeId}:${update.eventOffset}`,
      ),
    ).toEqual(['participant-1:103', 'participant-2:202']);
    expect(firstPage.nextBefore).toEqual(expect.any(String));
    expect(firstPage.nextBefore).not.toBe('202');
    expect(firstPage.nextAfter).toBeNull();

    const olderPage = await service.fetchGlobalRecentUpdates(nodes, 2, {
      before: firstPage.nextBefore ?? undefined,
      parties: ['Alice'],
      mode: 'and',
      hideSplice: true,
    });

    expect(
      olderPage.updates.map(
        (update) => `${update.nodeId}:${update.eventOffset}`,
      ),
    ).toEqual(['participant-1:101', 'participant-2:201']);
    expect(olderPage.nextAfter).toEqual(expect.any(String));
    expect(olderPage.nextBefore).toEqual(expect.any(String));
  });

  it('round-trips two older and two newer pages without returning an empty page', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query: jest.fn() }),
    } as never);
    const updates = [
      {
        eventOffset: '106',
        updateId: 'update-106',
        recordTime: '2026-07-01T12:06:00.000Z',
      },
      {
        eventOffset: '105',
        updateId: 'update-105',
        recordTime: '2026-07-01T12:05:00.000Z',
      },
      {
        eventOffset: '104',
        updateId: 'update-104',
        recordTime: '2026-07-01T12:04:00.000Z',
      },
      {
        eventOffset: '103',
        updateId: 'update-103',
        recordTime: '2026-07-01T12:03:00.000Z',
      },
      {
        eventOffset: '102',
        updateId: 'update-102',
        recordTime: '2026-07-01T12:02:00.000Z',
      },
      {
        eventOffset: '101',
        updateId: 'update-101',
        recordTime: '2026-07-01T12:01:00.000Z',
      },
    ];
    const serviceWithFetch = service as PqsSummaryService & {
      fetchRecentUpdates: jest.Mock;
    };

    serviceWithFetch.fetchRecentUpdates = jest.fn(async (node, options) => {
      const limit =
        typeof options === 'number' ? options : (options.limit ?? 30);
      const before = typeof options === 'number' ? undefined : options.before;
      const beforeIndex = before
        ? updates.findIndex((update) => update.eventOffset === before)
        : -1;
      const pageStart = beforeIndex >= 0 ? beforeIndex + 1 : 0;
      const rows = updates.slice(pageStart, pageStart + limit + 1);
      const page = rows.slice(0, limit);

      return {
        nodeId: node.id,
        label: node.label,
        limit,
        nextBefore:
          rows.length > limit
            ? (page[page.length - 1]?.eventOffset ?? null)
            : null,
        nextAfter: null,
        updates: page.map((update) => ({
          ...update,
          parties: [],
        })),
      };
    });

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant' as const,
      mode: 'pqs_only' as const,
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    };
    const firstPage = await service.fetchGlobalRecentUpdates([node], 2);
    const firstOlderPage = await service.fetchGlobalRecentUpdates([node], 2, {
      before: firstPage.nextBefore ?? undefined,
    });
    const secondOlderPage = await service.fetchGlobalRecentUpdates([node], 2, {
      before: firstOlderPage.nextBefore ?? undefined,
    });
    const firstNewerPage = await service.fetchGlobalRecentUpdates([node], 2, {
      after: secondOlderPage.nextAfter ?? undefined,
    });
    const secondNewerPage = await service.fetchGlobalRecentUpdates([node], 2, {
      after: firstNewerPage.nextAfter ?? undefined,
    });

    expect(secondNewerPage.updates.map((update) => update.eventOffset)).toEqual(
      firstPage.updates.map((update) => update.eventOffset),
    );
    expect(secondNewerPage.updates).toHaveLength(2);
  });

  it('returns global recent updates from healthy nodes when another node PQS is unavailable', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: jest.fn(),
    } as never);
    const serviceWithFetch = service as PqsSummaryService & {
      fetchRecentUpdates: jest.Mock;
    };

    serviceWithFetch.fetchRecentUpdates = jest.fn(
      async (node: { id: string; label: string }) => {
        if (node.id === 'participant-2') {
          throw new Error('connect ECONNREFUSED 127.0.0.1:5542');
        }

        return {
          nodeId: node.id,
          label: node.label,
          limit: 30,
          nextBefore: null,
          nextAfter: null,
          updates: [
            {
              eventOffset: '103',
              updateId: 'update-103',
              recordTime: '2026-07-01T12:03:00.000Z',
              parties: ['Alice'],
            },
          ],
        };
      },
    );

    await expect(
      service.fetchGlobalRecentUpdates(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ] as never,
        15,
      ),
    ).resolves.toEqual({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '103',
          updateId: 'update-103',
          recordTime: '2026-07-01T12:03:00.000Z',
          parties: ['Alice'],
          estimatedTrafficUsd: null,
        },
      ],
    });
  });

  it('returns active contracts newest first with an older-page cursor', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          contract_id: '00c',
          template_id: 'Main:C',
          created_record_time: '2026-07-01T12:02:00.000Z',
          created_event_offset: '103',
        },
        {
          contract_id: '00b',
          template_id: 'Main:B',
          created_record_time: '2026-07-01T12:01:00.000Z',
          created_event_offset: '102',
        },
        {
          contract_id: '00a',
          template_id: 'Main:A',
          created_record_time: '2026-07-01T12:00:00.000Z',
          created_event_offset: '101',
        },
      ],
    });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchNodeContracts(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        { limit: 2 },
      ),
    ).resolves.toEqual(typedNodeContractsFixture);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('order by contract_row.created_at_ix desc'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('contract_row.created_at_ix is not null'),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('limit 3'));
  });

  it('maps offset cursors to transaction indexes before paging active contracts', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { before: '3322' },
    );

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('with cursor_boundary as');
    expect(sql).toContain('where cursor_tx.offset >= 3322');
    expect(sql).toContain(
      '(contract_row.created_at_ix, contract_row.create_event_pk, contract_row.contract_id) <',
    );
    expect(sql).toContain('active_contract_page as');
    expect(sql).toContain(
      'order by contract_row.created_at_ix desc, contract_row.create_event_pk desc',
    );
  });

  it('uses a total compound cursor when contracts share a creation event', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: '00z',
            template_id: 'Main:Z',
            created_record_time: '2026-07-01T12:02:00.000Z',
            created_event_offset: '3322',
            created_at_ix: '77',
            create_event_pk: '20',
          },
          {
            contract_id: '00y',
            template_id: 'Main:Y',
            created_record_time: '2026-07-01T12:02:00.000Z',
            created_event_offset: '3322',
            created_at_ix: '77',
            create_event_pk: '20',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: '00y',
            template_id: 'Main:Y',
            created_record_time: '2026-07-01T12:02:00.000Z',
            created_event_offset: '3322',
            created_at_ix: '77',
            create_event_pk: '20',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: '00z',
            template_id: 'Main:Z',
            created_record_time: '2026-07-01T12:02:00.000Z',
            created_event_offset: '3322',
            created_at_ix: '77',
            create_event_pk: '20',
          },
        ],
      });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    } as const;

    const firstPage = await service.fetchNodeContracts(node, { limit: 1 });
    expect(firstPage.contracts.map((contract) => contract.contractId)).toEqual([
      '00z',
    ]);
    expect(firstPage.nextBefore).toMatch(/^acs1\./);
    const cursorPayload = JSON.parse(
      Buffer.from(firstPage.nextBefore!.slice('acs1.'.length), 'base64url').toString(
        'utf8',
      ),
    );
    expect(cursorPayload).toEqual({
      eventOffset: '3322',
      createdAtIx: '77',
      createEventPk: '20',
      contractId: '00z',
    });

    const secondPage = await service.fetchNodeContracts(node, {
      limit: 1,
      before: firstPage.nextBefore ?? undefined,
    });
    expect(secondPage.contracts.map((contract) => contract.contractId)).toEqual([
      '00y',
    ]);
    expect([
      ...firstPage.contracts.map((contract) => contract.contractId),
      ...secondPage.contracts.map((contract) => contract.contractId),
    ]).toEqual(['00z', '00y']);
    const secondSql = String(query.mock.calls[1]?.[0]);
    expect(secondSql).toContain('select 77::bigint as cursor_ix');
    expect(secondSql).toContain('20::bigint as cursor_event_pk');
    expect(secondSql).toContain("'00z'::text as cursor_contract_id");
    expect(secondSql).toContain(
      '(contract_row.created_at_ix, contract_row.create_event_pk, contract_row.contract_id) <',
    );

    const newerPage = await service.fetchNodeContracts(node, {
      limit: 1,
      after: secondPage.nextAfter ?? undefined,
    });
    expect(newerPage.contracts.map((contract) => contract.contractId)).toEqual([
      '00z',
    ]);
    expect(String(query.mock.calls[2]?.[0])).toContain(
      '(contract_row.created_at_ix, contract_row.create_event_pk, contract_row.contract_id) >',
    );
  });

  it('treats a pre-total-order acs1 cursor as a legacy offset cursor', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);
    const oldCursor = `acs1.${Buffer.from(
      JSON.stringify({
        eventOffset: '3322',
        createdAtIx: '77',
        createEventPk: '20',
      }),
      'utf8',
    ).toString('base64url')}`;

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { before: oldCursor },
    );

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('where cursor_tx.offset >= 3322');
    expect(sql).not.toContain('select 77::bigint as cursor_ix');
  });

  it('prunes contract partitions for template-filtered active contracts', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ pk: '17' }, { pk: '29' }] })
      .mockResolvedValueOnce({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { templates: ['Splice.Amulet:Amulet'] },
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("contract_tpe_row.module_name = 'Splice.Amulet'"),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('contract_row.tpe_pk in (17, 29)'),
    );
  });

  it('returns global contracts from healthy nodes when another node PQS is unavailable', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: jest.fn(),
    } as never);
    const serviceWithFetch = service as PqsSummaryService & {
      fetchNodeContracts: jest.Mock;
    };

    serviceWithFetch.fetchNodeContracts = jest.fn(
      async (node: { id: string; label: string }) => {
        if (node.id === 'participant-2') {
          throw new Error('connect ECONNREFUSED 127.0.0.1:5542');
        }

        return {
          nodeId: node.id,
          label: node.label,
          limit: 30,
          nextBefore: null,
          nextAfter: null,
          contracts: [
            {
              contractId: '00abc',
              templateId: 'Main:Vault',
              createdRecordTime: '2026-07-01T12:03:00.000Z',
            },
          ],
        };
      },
    );

    await expect(
      service.fetchGlobalContracts(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ] as never,
        15,
      ),
    ).resolves.toEqual({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      contracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Vault',
          recordTime: '2026-07-01T12:03:00.000Z',
        },
      ],
    });
  });

  it('queries only the selected nodes for global contracts', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: jest.fn(),
    } as never);
    const serviceWithFetch = service as PqsSummaryService & {
      fetchNodeContracts: jest.Mock;
    };

    serviceWithFetch.fetchNodeContracts = jest.fn(
      async (node: { id: string; label: string }) => ({
        nodeId: node.id,
        label: node.label,
        limit: 30,
        nextBefore: null,
        nextAfter: null,
        contracts: [
          {
            contractId: `contract-${node.id}`,
            templateId: 'Main:Vault',
            createdRecordTime: '2026-07-01T12:03:00.000Z',
          },
        ],
      }),
    );

    await expect(
      service.fetchGlobalContracts(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ] as never,
        15,
        { nodeIds: ['participant-2'] },
      ),
    ).resolves.toMatchObject({
      contracts: [expect.objectContaining({ nodeId: 'participant-2' })],
    });

    expect(serviceWithFetch.fetchNodeContracts).toHaveBeenCalledTimes(1);
    expect(serviceWithFetch.fetchNodeContracts).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-2' }),
      expect.anything(),
    );
  });

  it('returns no global contracts without querying when no nodes are selected', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: jest.fn(),
    } as never);
    const serviceWithFetch = service as PqsSummaryService & {
      fetchNodeContracts: jest.Mock;
    };

    serviceWithFetch.fetchNodeContracts = jest.fn();

    await expect(
      service.fetchGlobalContracts(
        [{ id: 'participant-1', label: 'Participant 1' }] as never,
        15,
        { nodeIds: [] },
      ),
    ).resolves.toEqual({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      contracts: [],
    });

    expect(serviceWithFetch.fetchNodeContracts).not.toHaveBeenCalled();
  });

  it('returns party contracts from healthy nodes when another node PQS is unavailable', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: jest.fn(),
    } as never);
    const serviceWithFetch = service as PqsSummaryService & {
      fetchPartyContractsForNode: jest.Mock;
    };

    serviceWithFetch.fetchPartyContractsForNode = jest.fn(
      async (node: { id: string; label: string }) => {
        if (node.id === 'participant-2') {
          throw new Error('connect ECONNREFUSED 127.0.0.1:5542');
        }

        return {
          nodeId: node.id,
          label: node.label,
          limit: 30,
          nextBefore: null,
          nextAfter: null,
          contracts: [
            {
              nodeId: node.id,
              label: node.label,
              contractId: '00abc',
              templateId: 'Main:Vault',
              packageId: 'main-package',
              packageName: 'Main Package',
              packageVersion: '1.2.3',
              recordTime: '2026-07-01T12:03:00.000Z',
            },
          ],
        };
      },
    );

    await expect(
      service.fetchPartyContracts(
        [
          { id: 'participant-1', label: 'Participant 1' },
          { id: 'participant-2', label: 'Participant 2' },
        ] as never,
        'Alice',
        { limit: 15 },
      ),
    ).resolves.toEqual({
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      contracts: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          contractId: '00abc',
          templateId: 'Main:Vault',
          packageId: 'main-package',
          packageName: 'Main Package',
          packageVersion: '1.2.3',
          recordTime: '2026-07-01T12:03:00.000Z',
        },
      ],
    });
  });

  it('reverses newer ACS pages when an after cursor is used', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          contract_id: '00b',
          template_id: 'Main:B',
          created_record_time: '2026-07-01T12:01:00.000Z',
          created_event_offset: '102',
        },
        {
          contract_id: '00c',
          template_id: 'Main:C',
          created_record_time: '2026-07-01T12:02:00.000Z',
          created_event_offset: '103',
        },
        {
          contract_id: '00d',
          template_id: 'Main:D',
          created_record_time: '2026-07-01T12:03:00.000Z',
          created_event_offset: '104',
        },
      ],
    });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchNodeContracts(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        { limit: 2, after: '101' },
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 2,
      nextBefore: '102',
      nextAfter: '103',
      contracts: [
        {
          contractId: '00c',
          templateId: 'Main:C',
          createdRecordTime: '2026-07-01T12:02:00.000Z',
        },
        {
          contractId: '00b',
          templateId: 'Main:B',
          createdRecordTime: '2026-07-01T12:01:00.000Z',
        },
      ],
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('where cursor_tx.offset <= 101'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        '(contract_row.created_at_ix, contract_row.create_event_pk, contract_row.contract_id) >',
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('order by contract_row.created_at_ix asc'),
    );
  });

  it('adds template and hide-splice filters to the ACS query', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ pk: '17' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: '00b',
            template_id: 'Main:Asset',
            created_record_time: '2026-07-01T12:01:00.000Z',
            created_event_offset: '102',
          },
        ],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { limit: 30, templates: ['Main:Asset'], hideSplice: true },
    );

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('contract_row.tpe_pk in (17)'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "visible_contract_tpe.module_name not like 'Splice.%'",
      ),
    );
  });

  it('joins ACS party filters with OR by default', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          contract_id: '00b',
          template_id: 'Main:Asset',
          created_record_time: '2026-07-01T12:01:00.000Z',
          created_event_offset: '102',
        },
      ],
    });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { limit: 30, parties: ['Alice', 'Bob'] },
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "array['Alice', 'p|Alice']::text[] && contract_row.witnesses",
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "array['Bob', 'p|Bob']::text[] && contract_row.witnesses",
      ),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('\n      or '));
  });

  it('casts ACS witness arrays to text[] before applying party overlap filters', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          contract_id: '00b',
          template_id: 'Main:Asset',
          created_record_time: '2026-07-01T12:01:00.000Z',
          created_event_offset: '102',
        },
      ],
    });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { limit: 30, parties: ['Alice'] },
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "array['Alice', 'p|Alice']::text[] && contract_row.witnesses::text[]",
      ),
    );
  });

  it('joins ACS party filters with AND when requested', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          contract_id: '00b',
          template_id: 'Main:Asset',
          created_record_time: '2026-07-01T12:01:00.000Z',
          created_event_offset: '102',
        },
      ],
    });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchNodeContracts(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      { limit: 30, parties: ['Alice', 'Bob'], partyMode: 'and' },
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('\n      and '));
  });

  it('applies global AND party filters to the updates query', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [],
    });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    const updates = await service.fetchRecentUpdates(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      {
        limit: 30,
        parties: ['Alice', 'Bob'],
        mode: 'and',
      },
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from party_update_ix'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from "public"."__exercises" exercise_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'Alice'"),
    );
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("'Bob'"));
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('party_0_update_ix as materialized');
    expect(sql).toContain('party_1_update_ix as materialized');
    expect(sql).toContain('intersect');
    expect(sql).not.toContain('where exists');
    expect(sql).not.toContain('having count(distinct party_filter)');
    expect(updates).toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      updates: [],
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
      getRawExecutor: async () => ({ query }),
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
          mode: 'pqs_only',
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
      expect.stringContaining('from "public"."__transactions" tx'),
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
      getRawExecutor: async () => ({ query }),
    } as never);
    const serviceWithDetail = service as unknown as {
      fetchUpdateDetail?: (node: object, updateId: string) => Promise<unknown>;
    };

    expect(serviceWithDetail.fetchUpdateDetail).toBeDefined();

    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_only',
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
      updateId:
        '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
      estimatedTrafficUsd: null,
      events: [],
      meta: {
        update_id:
          '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
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
        updateId:
          '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
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
        updateId:
          '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      }),
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('from "public"."__transactions" tx'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('join "public"."__exercises" exercise_row'),
    );
  });

  it('rejects when a single update detail is missing', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: async () =>
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
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '99999999',
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
      getRawExecutor: async () => ({ query }),
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
          mode: 'pqs_only',
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

  it('looks up update details through the numeric offset index', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '00003322',
      ),
    ).rejects.toThrow('Update not found');

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('where tx.offset = 3322');
    expect(sql).not.toContain('tx.offset::text =');
  });

  it('rejects malformed update offsets before querying PQS', async () => {
    const query = jest.fn();
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '3322 or 1=1',
      ),
    ).rejects.toThrow('Invalid event offset');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects update offsets outside the PQS bigint range before querying', async () => {
    const query = jest.fn();
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          ledgerLabel: 'Retail Ledger',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        '9223372036854775808',
      ),
    ).rejects.toThrow('Invalid event offset');
    expect(query).not.toHaveBeenCalled();
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
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
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
      expect.stringContaining('from "public"."__transactions" tx'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('join "public"."__exercises" exercise_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("else 'non_consuming_exercise'::text"),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      ),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        'order by update_id asc nulls last, event_id asc nulls last',
      ),
    );
  });

  it('maps schema-qualified PQS event rows into normalized update detail events', async () => {
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
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3',
            parties: ['Alice', 'Bob'],
          },
        ],
      })
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
              source_table: '__contracts',
              event_id: '#0:14',
            },
          },
          {
            event_kind: 'non_consuming_exercise',
            event_id: '#0:12',
            contract_id:
              '00e072d1af33d8e9eedf85cdafe3bb122cf74beaf77aed62d9dd3e9060278a7de7ca121220f2b77ff18dc0c6923a6acf5b7ed90c846e08e0a2c57edfd57e536564c2f740c7',
            template_id:
              't|#splice-wallet:Splice.Wallet.Install:WalletAppInstall',
            choice: 'c|WalletAppInstall_ExecuteBatch',
            witnesses: ['Alice'],
            raw: {
              source_table: '__exercises',
              event_id: '#0:12',
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
              source_table: '__exercises',
              event_id: '#0:22',
            },
          },
        ],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
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
      3,
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('join "public"."__exercises" exercise_row'),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(
        "tx.transaction_id in ('\\x12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3')",
      ),
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
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
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
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
            event_offset: '9130',
            record_time: '2026-07-02T03:50:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
            parties: ['sv::party'],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'non_consuming_exercise',
            event_id: '#0:0',
            contract_id:
              '00966590c35cea9eb8357db014e64b1197499f2a58320f1eaff6a25719aa78ddb4',
            template_id: 't|#splice-dso-governance:Splice.DsoRules:DsoRules',
            choice: 'c|DsoRules_ReceiveSvRewardCoupon',
            witnesses: ['sv::party'],
            raw: {
              source_table: '__exercises',
            },
          },
          {
            event_kind: 'create',
            event_id: '#0:5',
            contract_id:
              '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
            template_id: 'Splice.Amulet:SvRewardCoupon',
            choice: null,
            witnesses: ['sv::party'],
            contract_instance: buildRewardCouponInstance(258, 20000),
            raw: {
              source_table: '__contracts',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            coupon_contract_id:
              '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
            contract_instance: buildRewardCouponInstance(258, 20000),
          },
        ],
      });

    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'cnqs-sv',
          label: 'CNQS Super Validator',
          role: 'participant',
          mode: 'pqs_only',
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
                        value:
                          '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
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

  it('decodes generic exercise argument and result payloads from schema-qualified PQS event rows', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const decoder = new DamlValueDecoderService(
      new PackageRegistryService(new PackageCacheService()),
    );
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8',
            event_offset: '11327',
            record_time: '2026-07-02T17:20:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            update_id:
              '1220c4d4cb71a7824ad32684cbb91ba37b285cec60a45c94c561531c2b1cfaf689b8',
            parties: [
              'sv::1220b4ee7468a5025b999cf14a12569eaaf1de7f1441d0cc6c54f759574825e552b9',
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_kind: 'non_consuming_exercise',
            event_id: '#0:0',
            contract_id:
              '00966590c35cea9eb8357db014e64b1197499f2a58320f1eaff6a25719aa78ddb4ca1212201db4c45f5974070e20c390d2bf5eebc07635beb7af47b8f203f4839829120488',
            template_id: 't|#splice-dso-governance:Splice.DsoRules:DsoRules',
            package_id:
              'i|4974c654485d4ecaa6b5caf8ef3c2679efa8195c4b50d4965a8fff1b72e8efa4',
            choice: 'c|DsoRules_SubmitStatusReport',
            witnesses: [
              'sv::1220b4ee7468a5025b999cf14a12569eaaf1de7f1441d0cc6c54f759574825e552b9',
            ],
            exercise_argument: SUBMIT_STATUS_REPORT_ARGUMENT,
            exercise_result: SUBMIT_STATUS_REPORT_RESULT,
            raw: {
              source_table: '__exercises',
            },
          },
        ],
      });

    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder,
    );

    await expect(
      service.fetchUpdateDetail(
        {
          id: 'cnqs-sv',
          label: 'CNQS Super Validator',
          role: 'participant',
          mode: 'pqs_only',
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
              argument: expect.objectContaining({
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
              }),
              result: expect.objectContaining({
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
              }),
            },
          }),
        ],
      }),
    );
  });

  it('returns contract detail with created update metadata and decoded contract data', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      contractId:
        '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
      templateId: {
        packageId: 'splice-amulet',
        moduleName: 'Splice.Amulet',
        entityName: 'SvRewardCoupon',
      },
      packageId: 'splice-amulet',
      payload: buildRewardCouponInstance(258, 20000),
      createdEventOffset: '9130',
      archivedEventOffset: null,
      createdTransaction: {
        transactionId:
          '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
        offset: '9130',
        effectiveAt: new Date('2026-07-02T03:50:00.000Z'),
      },
      archivedTransaction: null,
    });

    const service = new PqsSummaryService(
      {
        getPqsQuery: async () => ({ contracts: { findUnique } }),
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
          mode: 'pqs_only',
          ledgerLabel: 'Quickstart Super Validator',
          pqs: { connectionUriEnv: 'CNQS_PQS_SV_URL' },
        },
        '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
      ),
    ).resolves.toEqual({
      nodeId: 'cnqs-sv',
      label: 'CNQS Super Validator',
      contractId:
        '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
      templateId: 'Splice.Amulet:SvRewardCoupon',
      packageId: 'splice-amulet',
      packageName: 'splice-amulet',
      packageVersion: '0.1.24',
      createdUpdateId:
        '122062f9df8def1e8bb8b495505e0fe889bee2e7af580ab08ec799f2103ddf67c4cd',
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

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        contractId:
          '001fcf4bfc68ce9fd303f206ad839bfaba1fa714b2bf8f41304bc7701baf90736c',
      },
      include: { createdTransaction: true, archivedTransaction: true },
    });
  });

  it('decodes WalletAppInstall contract detail from a stored contract instance payload', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const decoder = new DamlValueDecoderService(
      new PackageRegistryService(new PackageCacheService()),
    );
    const findUnique = jest.fn().mockResolvedValue({
      contractId:
        '00e072d1af33d8e9eedf85cdafe3bb122cf74beaf77aed62d9dd3e9060278a7de7ca121220f2b77ff18dc0c6923a6acf5b7ed90c846e08e0a2c57edfd57e536564c2f740c7',
      templateId: {
        packageId:
          '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
        moduleName: 'Splice.Wallet.Install',
        entityName: 'WalletAppInstall',
      },
      packageId:
        '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
      payload: WALLET_APP_INSTALL_INSTANCE,
      createdEventOffset: '39',
      archivedEventOffset: null,
      createdTransaction: {
        transactionId:
          '12206f756ff544575b5bda691dcd828cd98c772ff4fa99ec9343c19ffc0d2e1077c3',
        offset: '39',
        effectiveAt: new Date('2026-07-02T10:55:21.000Z'),
      },
      archivedTransaction: null,
    });

    const service = new PqsSummaryService(
      {
        getPqsQuery: async () => ({ contracts: { findUnique } }),
      } as never,
      decoder,
      {
        getPackage: () => ({
          packageId:
            '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
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
          mode: 'pqs_only',
          ledgerLabel: 'Quickstart App User',
          pqs: { connectionUriEnv: 'CNQS_PQS_APP_USER_URL' },
        },
        '00e072d1af33d8e9eedf85cdafe3bb122cf74beaf77aed62d9dd3e9060278a7de7ca121220f2b77ff18dc0c6923a6acf5b7ed90c846e08e0a2c57edfd57e536564c2f740c7',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        templateId: 'Splice.Wallet.Install:WalletAppInstall',
        packageId:
          '1d8317b1e476c03ea2a85bed8435e5c182abe501db58350009187fa839ab2cca',
        packageName: 'splice-wallet',
        packageVersion: '0.1.19',
        contractData: expect.objectContaining({
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
        }),
      }),
    );
  });

  it('returns PQS tokens while gRPC enrichment is still pending', async () => {
    let resolveGrpc: (tokens: TokensResponse['tokens']) => void;
    const grpcTokens = new Promise<TokensResponse['tokens']>((resolve) => {
      resolveGrpc = resolve;
    });
    const grpcOperationsService = {
      fetchHoldingV2Tokens: jest.fn().mockReturnValue(grpcTokens),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );
    jest
      .spyOn(service as never, 'fetchObservedTokensForNode')
      .mockResolvedValue([
        {
          tokenId: 'Issuer::PqsToken',
          name: 'PQS Token',
          symbol: null,
          issuer: 'Issuer',
          source: 'pqs',
        },
      ]);
    jest
      .spyOn(service as never, 'fetchBuiltinTokensForNode')
      .mockResolvedValue([]);

    const response = await Promise.race([
      (
        service as PqsSummaryService & {
          fetchTokens: (
            nodes: Array<{
              id: string;
              label: string;
              mode: 'pqs_with_grpc';
            }>,
          ) => Promise<TokensResponse>;
        }
      ).fetchTokens([
        {
          id: 'participant-1',
          label: 'Participant 1',
          mode: 'pqs_with_grpc',
        },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('PQS response waited for gRPC enrichment')),
          100,
        ),
      ),
    ]);

    expect(response).toMatchObject({
      refreshing: true,
      tokens: [
        expect.objectContaining({
          tokenId: 'Issuer::PqsToken',
          source: 'pqs',
        }),
      ],
    });
    expect(grpcOperationsService.fetchHoldingV2Tokens).toHaveBeenCalledTimes(1);

    resolveGrpc!([]);
    await grpcTokens;
  });

  it('shares a pending gRPC enrichment refresh across concurrent token requests', async () => {
    let resolveGrpc: (tokens: TokensResponse['tokens']) => void;
    const grpcTokens = new Promise<TokensResponse['tokens']>((resolve) => {
      resolveGrpc = resolve;
    });
    const grpcOperationsService = {
      fetchHoldingV2Tokens: jest.fn().mockReturnValue(grpcTokens),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );
    jest
      .spyOn(service as never, 'fetchObservedTokensForNode')
      .mockResolvedValue([
        {
          tokenId: 'Issuer::PqsToken',
          name: 'PQS Token',
          symbol: null,
          issuer: 'Issuer',
          source: 'pqs',
        },
      ]);
    jest
      .spyOn(service as never, 'fetchBuiltinTokensForNode')
      .mockResolvedValue([]);
    const node = {
      id: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_with_grpc' as const,
    };

    await Promise.all([
      (
        service as PqsSummaryService & {
          fetchTokens: (nodes: (typeof node)[]) => Promise<TokensResponse>;
        }
      ).fetchTokens([node]),
      (
        service as PqsSummaryService & {
          fetchTokens: (nodes: (typeof node)[]) => Promise<TokensResponse>;
        }
      ).fetchTokens([node]),
    ]);

    expect(grpcOperationsService.fetchHoldingV2Tokens).toHaveBeenCalledTimes(1);

    resolveGrpc!([]);
    await grpcTokens;
  });

  it('awaits the shared gRPC fallback when PQS finds no tokens', async () => {
    let resolveGrpc: (tokens: TokensResponse['tokens']) => void;
    const grpcTokens = new Promise<TokensResponse['tokens']>((resolve) => {
      resolveGrpc = resolve;
    });
    const grpcOperationsService = {
      fetchHoldingV2Tokens: jest.fn().mockReturnValue(grpcTokens),
    };
    const service = new PqsSummaryService(
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );
    jest
      .spyOn(service as never, 'fetchObservedTokensForNode')
      .mockResolvedValue([]);
    jest
      .spyOn(service as never, 'fetchBuiltinTokensForNode')
      .mockResolvedValue([]);
    const responsePromise = (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string; mode: 'pqs_with_grpc' }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([
      { id: 'participant-1', label: 'Participant 1', mode: 'pqs_with_grpc' },
    ]);
    let settled = false;
    void responsePromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(grpcOperationsService.fetchHoldingV2Tokens).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    resolveGrpc!([
      {
        tokenId: 'Issuer::GrpcToken',
        name: 'gRPC Token',
        symbol: null,
        issuer: 'Issuer',
        source: 'grpc',
      },
    ]);

    await expect(responsePromise).resolves.toMatchObject({
      refreshing: false,
      tokens: [expect.objectContaining({ tokenId: 'Issuer::GrpcToken' })],
    });
  });

  it('returns Canton Coin in the discovered token list', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-amulet',
          event_offset: '303',
          record_time: '2026-07-07T13:00:00.000Z',
          template_id: 'Splice.Amulet:Amulet',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('amulet-1'),
        },
      ],
    });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([
      { id: 'participant-1', label: 'Participant 1' } as never,
      { id: 'participant-2', label: 'Participant 2' } as never,
    ]);

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ],
    });
  });

  it('uses cached literal template type PKs to prune token contract partitions', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('contract_tpe_row.pk::text as pk')) {
        return Promise.resolve({
          rows: [
            {
              pk: '12',
              module_name: 'Splice.Amulet',
              entity_name: 'Amulet',
            },
            {
              pk: '14',
              module_name: 'Splice.Api.Token.HoldingV1',
              entity_name: 'Holding',
            },
            {
              pk: '43',
              module_name: 'Splice.Api.Token.TransferInstructionV1',
              entity_name: 'Transfer',
            },
          ],
        });
      }

      if (sql.includes('from "public"."__transactions" tx')) {
        return Promise.resolve({
          rows: [
            {
              update_id: 'token-update-amulet',
              event_offset: '303',
              record_time: '2026-07-07T13:00:00.000Z',
              template_id: 'Splice.Amulet:Amulet',
              package_id: 'splice-amulet-package',
              contract_instance: Buffer.from('amulet-1'),
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    const typeLookupQuery = query.mock.calls
      .map(([sql]) => sql as string)
      .find((sql) => sql.includes('contract_tpe_row.pk::text as pk'));
    const tokenQuery = query.mock.calls
      .map(([sql]) => sql as string)
      .find((sql) => sql.includes('from "public"."__transactions" tx'));

    expect(typeLookupQuery).toEqual(
      expect.stringContaining("contract_tpe_row.module_name = 'Splice.Amulet'"),
    );
    expect(typeLookupQuery).toEqual(
      expect.stringContaining("contract_tpe_row.module_name like '%.CIP112'"),
    );
    expect(tokenQuery).toEqual(
      expect.stringContaining('contract_row.tpe_pk in (12, 14, 43)'),
    );
    expect(tokenQuery?.slice(tokenQuery.indexOf('where'))).not.toEqual(
      expect.stringContaining(
        "contract_tpe_row.module_name || ':' || contract_tpe_row.entity_name",
      ),
    );
  });

  it('discovers an observed CIP56 token from a holding create even when no transfers exist yet', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-holding-update-1',
          event_offset: '701',
          record_time: '2026-07-07T14:00:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('cip56-holding-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'owner', value: 'Alice' },
            {
              label: 'instrumentId',
              value: {
                kind: 'record',
                fields: [
                  { label: 'admin', value: 'Issuer' },
                  { label: 'id', value: 'validator-license' },
                ],
              },
            },
            { label: 'amount', value: '150.0000000000' },
            {
              label: 'meta',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'values',
                    value: {
                      kind: 'text_map',
                      entries: [
                        { key: 'name', value: 'Validator License' },
                        { key: 'symbol', value: 'VL' },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'Issuer::validator-license',
          name: 'Validator License',
          symbol: 'VL',
          issuer: 'Issuer',
          source: 'pqs',
        },
      ],
    });
  });

  it('canonicalizes offline native Amulet holdings to Canton Coin', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-holding-update-amulet-1',
          event_offset: '706',
          record_time: '2026-07-11T18:05:39.756Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('native-amulet-holding'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'owner', value: 'Alice' },
            {
              label: 'instrumentId',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'admin',
                    value:
                      'DSO::122077e9d7a8f163db646a4b07f89b504a6597cf393ad3e3f23ce0e0e26b95d91588',
                  },
                  { label: 'id', value: 'Amulet' },
                ],
              },
            },
            { label: 'amount', value: '42.0000000000' },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ],
    });
  });

  it('keeps Canton Coin discoverable when Amulet packages are installed but no live token rows exist yet', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ template_id: 'Splice.AmuletRules:AmuletRules' }],
      })
      .mockResolvedValue({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'canton-coin',
          name: 'Canton Coin',
          symbol: null,
          issuer: null,
          source: 'pqs',
        },
      ],
    });
  });

  it('discovers observed CIP112 tokens from PQS-only fallback after forcing a package refresh on invalid_package', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-cip112-update-1',
          event_offset: '711',
          record_time: '2026-07-09T15:01:39.756Z',
          template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('cip112-holding-1'),
        },
        {
          update_id: 'token-cip112-update-2',
          event_offset: '710',
          record_time: '2026-07-09T15:01:38.756Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('cip112-holding-2'),
        },
        {
          update_id: 'token-cip112-update-3',
          event_offset: '709',
          record_time: '2026-07-09T15:01:37.756Z',
          template_id: 'Oz.Vault.Base.ShareToken.CIP112:ReferenceShareToken',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('cip112-holding-3'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockReturnValueOnce({
          status: 'invalid_data',
          reason: 'invalid_package',
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              {
                label: 'vaultIdentity',
                value: {
                  kind: 'record',
                  fields: [
                    { label: 'admin', value: 'VaultAdmin' },
                    { label: 'id', value: 'vault-1' },
                  ],
                },
              },
              { label: 'owner', value: 'Alice' },
              { label: 'name', value: 'USDCx Test Vault Share' },
              { label: 'symbol', value: 'vUSDCx-SHARE' },
              { label: 'amount', value: '150.0000000000' },
            ],
          },
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer' },
              { label: 'instrumentIdText', value: 'USDCx' },
              {
                label: 'transferPolicy',
                value: {
                  kind: 'enum',
                  constructor: 'StrictVaultTransfers',
                },
              },
              { label: 'account', value: { kind: 'unit' } },
              { label: 'amount', value: '100.0000000000' },
            ],
          },
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              {
                label: 'vaultIdentity',
                value: {
                  kind: 'record',
                  fields: [
                    { label: 'admin', value: 'VaultAdmin' },
                    { label: 'id', value: 'vault-1' },
                  ],
                },
              },
              { label: 'name', value: 'USDCx Test Vault Share' },
              { label: 'symbol', value: 'vUSDCx-SHARE' },
            ],
          },
        }),
    };
    const packageRegistry = {
      invalidatePackage: jest.fn(),
    };
    const packageSyncService = {
      syncPackagesById: jest.fn().mockResolvedValue({
        missingPackageIds: ['vault-base-package'],
        fetchedPackageCount: 1,
        skippedBecauseNotDue: false,
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
      undefined,
      packageRegistry as never,
      undefined,
      undefined,
      packageSyncService as never,
    );

    const node = {
      id: 'cnqs-extra-1',
      label: 'CNQS Extra 1',
      mode: 'pqs_only',
    };

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{
            id: string;
            label: string;
            mode?: 'pqs_only' | 'pqs_with_grpc';
          }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([node]);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('%.CIP112'));
    expect(packageSyncService.syncPackagesById).toHaveBeenCalledWith(node, [
      'vault-base-package',
    ]);
    expect(packageRegistry.invalidatePackage).toHaveBeenCalledWith(
      'vault-base-package',
    );
    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'Issuer::USDCx',
          name: 'USDCx',
          symbol: null,
          issuer: 'Issuer',
          source: 'pqs',
        },
        {
          tokenId: 'VaultAdmin::vault-1:share',
          name: 'USDCx Test Vault Share',
          symbol: 'vUSDCx-SHARE',
          issuer: 'VaultAdmin',
          source: 'pqs',
        },
      ],
    });
  });

  it('prefers PQS token discovery over gRPC HoldingV2 for overlapping CIP112 tokens on grpc-enabled nodes', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-holding-update-1',
          event_offset: '701',
          record_time: '2026-07-07T14:00:00.000Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('cip112-underlying-1'),
        },
        {
          update_id: 'token-holding-update-2',
          event_offset: '702',
          record_time: '2026-07-07T14:00:01.000Z',
          template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('cip112-share-1'),
        },
        {
          update_id: 'token-holding-update-3',
          event_offset: '703',
          record_time: '2026-07-07T14:00:02.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('cip56-holding-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'cip112-underlying-1':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'issuer', value: 'Issuer' },
                      { label: 'instrumentIdText', value: 'USDCx' },
                      { label: 'owner', value: 'Alice' },
                      { label: 'amount', value: '150.0000000000' },
                      { label: 'name', value: 'USDCx' },
                    ],
                  },
                };
              case 'cip112-share-1':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      {
                        label: 'vaultIdentity',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'VaultAdmin' },
                            { label: 'id', value: 'vault-1' },
                          ],
                        },
                      },
                      { label: 'owner', value: 'Alice' },
                      { label: 'name', value: 'USDCx Test Vault Share' },
                      { label: 'symbol', value: 'vUSDCx-SHARE' },
                      { label: 'amount', value: '55.0000000000' },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Alice' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      { label: 'amount', value: '150.0000000000' },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const grpcOperationsService = {
      fetchHoldingV2Tokens: jest.fn().mockResolvedValue([
        {
          tokenId: 'Issuer::USDCx',
          name: 'USDCx',
          symbol: null,
          issuer: 'Issuer',
          source: 'grpc',
        },
        {
          tokenId: 'VaultAdmin::vault-1:share',
          name: 'USDCx Test Vault Share',
          symbol: 'vUSDCx-SHARE',
          issuer: 'VaultAdmin',
          source: 'grpc',
        },
      ]),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string; mode: 'pqs_with_grpc' }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([
      { id: 'participant-1', label: 'Participant 1', mode: 'pqs_with_grpc' },
    ]);

    expect(grpcOperationsService.fetchHoldingV2Tokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'participant-1' }),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('%.CIP112'));
    expect(response.tokens).toEqual([
      {
        tokenId: 'Issuer::USDCx',
        name: 'USDCx',
        symbol: null,
        issuer: 'Issuer',
        source: 'pqs',
      },
      {
        tokenId: 'VaultAdmin::vault-1:share',
        name: 'USDCx Test Vault Share',
        symbol: 'vUSDCx-SHARE',
        issuer: 'VaultAdmin',
        source: 'pqs',
      },
      {
        tokenId: 'Issuer::validator-license',
        name: 'Validator License',
        symbol: 'VL',
        issuer: 'Issuer',
        source: 'pqs',
      },
    ]);
  });

  it('keeps same-name CIP112 tokens from different issuers as separate tokens', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'issuer-token-update-1',
          event_offset: '801',
          record_time: '2026-07-09T16:01:39.756Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('issuer-token-1'),
        },
        {
          update_id: 'issuer-token-update-2',
          event_offset: '800',
          record_time: '2026-07-09T16:01:38.756Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('issuer-token-2'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-1' },
              { label: 'instrumentIdText', value: 'USDCx' },
              { label: 'amount', value: '100.0000000000' },
            ],
          },
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-2' },
              { label: 'instrumentIdText', value: 'USDCx' },
              { label: 'amount', value: '250.0000000000' },
            ],
          },
        }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'Issuer-1::USDCx',
          name: 'USDCx',
          symbol: null,
          issuer: 'Issuer-1',
          source: 'pqs',
        },
        {
          tokenId: 'Issuer-2::USDCx',
          name: 'USDCx',
          symbol: null,
          issuer: 'Issuer-2',
          source: 'pqs',
        },
      ],
    });
  });

  it('uses CIP112 instrumentId admin and id as the canonical token identity', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'cip112-standard-token-update-1',
          event_offset: '805',
          record_time: '2026-07-09T16:05:39.756Z',
          template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('standard-cip112-token'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'vaultParty', value: 'AppSpecificVaultParty' },
            {
              label: 'instrumentId',
              value: {
                kind: 'record',
                fields: [
                  { label: 'admin', value: 'RegistryAdmin' },
                  { label: 'id', value: 'USDCx-SHARE' },
                ],
              },
            },
            { label: 'instrumentIdText', value: 'legacy-usdcx-share' },
            { label: 'symbol', value: 'vUSDCx-SHARE' },
            { label: 'name', value: 'USDCx Test Vault Share' },
            { label: 'owner', value: 'Alice' },
            { label: 'amount', value: '100.0000000000' },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    expect(response.tokens).toEqual([
      {
        tokenId: 'RegistryAdmin::USDCx-SHARE',
        name: 'USDCx Test Vault Share',
        symbol: 'vUSDCx-SHARE',
        issuer: 'RegistryAdmin',
        source: 'pqs',
      },
    ]);
  });

  it('paginates discovered tokens with opaque cursors', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'page-token-1',
          event_offset: '901',
          record_time: '2026-07-09T18:00:00.000Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('page-token-1'),
        },
        {
          update_id: 'page-token-2',
          event_offset: '900',
          record_time: '2026-07-09T17:59:00.000Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('page-token-2'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-A' },
              { label: 'instrumentIdText', value: 'Alpha' },
              { label: 'amount', value: '10.0' },
            ],
          },
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-B' },
              { label: 'instrumentIdText', value: 'Beta' },
              { label: 'amount', value: '20.0' },
            ],
          },
        }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'participant-1', label: 'Participant 1' }] as const;

    const firstPage = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: typeof nodes,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens(nodes, 1);

    expect(firstPage).toEqual({
      limit: 1,
      nextBefore: expect.any(String),
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'Issuer-A::Alpha',
          name: 'Alpha',
          symbol: null,
          issuer: 'Issuer-A',
          source: 'pqs',
        },
      ],
    });

    const secondPage = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: typeof nodes,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens(nodes, 1, {
      before: firstPage.nextBefore ?? undefined,
    });

    expect(secondPage).toEqual({
      limit: 1,
      nextBefore: null,
      nextAfter: expect.any(String),
      refreshing: false,
      tokens: [
        {
          tokenId: 'Issuer-B::Beta',
          name: 'Beta',
          symbol: null,
          issuer: 'Issuer-B',
          source: 'pqs',
        },
      ],
    });
  });

  it('filters discovered tokens by name, excluded name, and issuer before pagination', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'filter-token-1',
          event_offset: '911',
          record_time: '2026-07-09T18:10:00.000Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('filter-token-1'),
        },
        {
          update_id: 'filter-token-2',
          event_offset: '910',
          record_time: '2026-07-09T18:09:00.000Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('filter-token-2'),
        },
        {
          update_id: 'filter-token-3',
          event_offset: '909',
          record_time: '2026-07-09T18:08:00.000Z',
          template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('filter-token-3'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-A' },
              { label: 'instrumentIdText', value: 'Alpha Vault' },
              { label: 'name', value: 'Alpha Vault' },
              { label: 'symbol', value: 'ALPHA' },
              { label: 'amount', value: '10.0' },
            ],
          },
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-A' },
              { label: 'instrumentIdText', value: 'Beta Token' },
              { label: 'name', value: 'Beta Token' },
              { label: 'symbol', value: 'BETA' },
              { label: 'amount', value: '20.0' },
            ],
          },
        })
        .mockReturnValueOnce({
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              { label: 'issuer', value: 'Issuer-B' },
              { label: 'instrumentIdText', value: 'Gamma Vault' },
              { label: 'name', value: 'Gamma Vault' },
              { label: 'symbol', value: 'GAMMA' },
              { label: 'amount', value: '30.0' },
            ],
          },
        }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'participant-1', label: 'Participant 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: typeof nodes,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            names?: string[];
            excludeNames?: string[];
            issuers?: string[];
          },
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens(nodes, 30, {
      names: ['vault'],
      excludeNames: ['gamma'],
      issuers: ['Issuer-A'],
    });

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      refreshing: false,
      tokens: [
        {
          tokenId: 'Issuer-A::ALPHA',
          name: 'Alpha Vault',
          symbol: 'ALPHA',
          issuer: 'Issuer-A',
          source: 'pqs',
        },
      ],
    });
  });

  it('merges decoded Canton Coin transfers across nodes, paginates them, and reuses the in-memory cache', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-1',
          event_offset: '101',
          record_time: '2026-07-07T11:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-1'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-2',
          event_offset: '202',
          record_time: '2026-07-07T12:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-2'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => ({
            status: 'decoded',
            value: {
              kind: 'record',
              fields: [
                {
                  label: 'transfer',
                  value:
                    contractInstance.toString() === 'transfer-2'
                      ? {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Alice' },
                            { label: 'receiver', value: 'Bob' },
                            { label: 'amount', value: '42.0' },
                          ],
                        }
                      : {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Carol' },
                            { label: 'receiver', value: 'Dave' },
                            { label: 'amount', value: '12.5' },
                          ],
                        },
                },
              ],
            },
          }),
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [
      { id: 'participant-1', label: 'Participant 1' },
      { id: 'participant-2', label: 'Participant 2' },
    ] as never;

    const firstPage = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 1);

    expect(firstPage).toEqual({
      limit: 1,
      nextBefore: expect.any(String),
      nextAfter: null,
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '42.0',
          sender: 'Alice',
          receiver: 'Bob',
          updateId: 'token-update-2',
          recordTime: '2026-07-07T12:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
              eventOffset: '202',
            },
          ],
        },
      ],
    });

    const secondPage = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 1, {
      before: firstPage.nextBefore ?? undefined,
    });

    expect(secondPage).toEqual({
      limit: 1,
      nextBefore: null,
      nextAfter: expect.any(String),
      transfers: [
        {
          tokenId: 'canton-coin',
          tokenName: 'Canton Coin',
          amount: '12.5',
          sender: 'Carol',
          receiver: 'Dave',
          updateId: 'token-update-1',
          recordTime: '2026-07-07T11:00:00.000Z',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              eventOffset: '101',
            },
          ],
        },
      ],
    });

    expect(participant1Query).toHaveBeenCalledTimes(3);
    expect(participant2Query).toHaveBeenCalledTimes(3);
    expect(decoder.decodeContractInstance).toHaveBeenCalledTimes(2);
  });

  it('includes decoded Amulet creates as inbound Canton Coin movements', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-amulet',
          event_offset: '303',
          record_time: '2026-07-07T13:00:00.000Z',
          template_id: 'Splice.Amulet:Amulet',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('amulet-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            {
              label: 'dso',
              value:
                'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
            },
            { label: 'owner', value: 'RewardReceiver' },
            {
              label: 'amount',
              value: {
                kind: 'record',
                fields: [{ label: 'initialAmount', value: '20000' }],
              },
            },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: Array<{ id: string; label: string }>,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(
      [{ id: 'cnqs-sv', label: 'CNQS Super Validator' }],
      30,
    );

    expect(response.transfers).toEqual([
      {
        tokenId: 'canton-coin',
        tokenName: 'Canton Coin',
        amount: '20000',
        sender:
          'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
        receiver: 'RewardReceiver',
        updateId: 'token-update-amulet',
        recordTime: '2026-07-07T13:00:00.000Z',
        nodes: [
          {
            nodeId: 'cnqs-sv',
            label: 'CNQS Super Validator',
            eventOffset: '303',
          },
        ],
      },
    ]);
  });

  it('returns an empty transfer page when one node succeeds with no transfers and another node fails', async () => {
    const emptyQuery = jest.fn().mockResolvedValue({ rows: [] });
    const failingQuery = jest
      .fn()
      .mockRejectedValue(new Error('pqs unavailable'));
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query: node.id === 'participant-ok' ? emptyQuery : failingQuery,
        }),
      } as never,
      { decodeContractInstance: jest.fn() } as never,
    );
    const nodes = [
      { id: 'participant-ok', label: 'Participant OK' },
      { id: 'participant-failing', label: 'Participant Failing' },
    ] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30);

    expect(response).toEqual({
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      transfers: [],
    });
  });

  it('normalizes a CIP56 transfer record into the merged transfer feed', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'cip56-transfer-update-1',
          event_offset: '808',
          record_time: '2026-07-07T14:05:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('cip56-transfer-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'sender', value: 'Issuer' },
            { label: 'receiver', value: 'Alice' },
            { label: 'amount', value: '42.5000000000' },
            {
              label: 'instrumentId',
              value: {
                kind: 'record',
                fields: [
                  { label: 'admin', value: 'Issuer' },
                  { label: 'id', value: 'validator-license' },
                ],
              },
            },
            {
              label: 'meta',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'values',
                    value: {
                      kind: 'text_map',
                      entries: [
                        { key: 'name', value: 'Validator License' },
                        { key: 'symbol', value: 'VL' },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: Array<{ id: string; label: string }>,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(
      [{ id: 'participant-1', label: 'Participant 1' }],
      30,
    );

    expect(response.transfers).toEqual([
      {
        tokenId: 'Issuer::validator-license',
        tokenName: 'Validator License',
        amount: '42.5000000000',
        sender: 'Issuer',
        receiver: 'Alice',
        updateId: 'cip56-transfer-update-1',
        recordTime: '2026-07-07T14:05:00.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '808',
          },
        ],
      },
    ]);
  });

  it('dedupes identical token transfers seen on multiple nodes into a single row', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'shared-update-1',
          event_offset: '29615',
          record_time: '2026-07-07T12:54:23.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('shared-transfer'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'shared-update-1',
          event_offset: '58393',
          record_time: '2026-07-07T12:54:23.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('shared-transfer'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            {
              label: 'transfer',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'sender',
                    value:
                      'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
                  },
                  {
                    label: 'receiver',
                    value:
                      'app_provider_quickstart-helena-1::122083ea37f868bc1df967ab64179ba230e243296096d6333d3063f2f0de05d278bf',
                  },
                  { label: 'amount', value: '455660.1600000000' },
                ],
              },
            },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: Array<{ id: string; label: string }>,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(
      [
        { id: 'participant-1', label: 'CNQS App Provider' },
        { id: 'participant-2', label: 'CNQS Super Validator' },
      ],
      30,
    );

    expect(response.transfers).toEqual([
      {
        tokenId: 'canton-coin',
        tokenName: 'Canton Coin',
        amount: '455660.1600000000',
        sender:
          'DSO::1220895c459e3ae6d768e9de8617299394051ab7748a1e5f858ec01ad4e5947076df',
        receiver:
          'app_provider_quickstart-helena-1::122083ea37f868bc1df967ab64179ba230e243296096d6333d3063f2f0de05d278bf',
        updateId: 'shared-update-1',
        recordTime: '2026-07-07T12:54:23.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'CNQS App Provider',
            eventOffset: '29615',
          },
          {
            nodeId: 'participant-2',
            label: 'CNQS Super Validator',
            eventOffset: '58393',
          },
        ],
      },
    ]);
  });

  it('filters merged token transfers by separate sender and receiver party lists', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-1',
          event_offset: '101',
          record_time: '2026-07-07T11:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-1'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-2',
          event_offset: '202',
          record_time: '2026-07-07T12:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-2'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => ({
            status: 'decoded',
            value: {
              kind: 'record',
              fields: [
                {
                  label: 'transfer',
                  value:
                    contractInstance.toString() === 'transfer-2'
                      ? {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Alice' },
                            { label: 'receiver', value: 'Bob' },
                            { label: 'amount', value: '42.0' },
                          ],
                        }
                      : {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Carol' },
                            { label: 'receiver', value: 'Dave' },
                            { label: 'amount', value: '12.5' },
                          ],
                        },
                },
              ],
            },
          }),
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [
      { id: 'participant-1', label: 'Participant 1' },
      { id: 'participant-2', label: 'Participant 2' },
    ] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            fromParties?: string[];
            toParties?: string[];
          },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30, {
      fromParties: ['Alice', 'Mallory'],
      toParties: ['Bob'],
    });

    expect(response.transfers).toEqual([
      {
        tokenId: 'canton-coin',
        tokenName: 'Canton Coin',
        amount: '42.0',
        sender: 'Alice',
        receiver: 'Bob',
        updateId: 'token-update-2',
        recordTime: '2026-07-07T12:00:00.000Z',
        nodes: [
          {
            nodeId: 'participant-2',
            label: 'Participant 2',
            eventOffset: '202',
          },
        ],
      },
    ]);
  });

  it('filters merged token transfers by strict amount bounds', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-1',
          event_offset: '101',
          record_time: '2026-07-07T11:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-1'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-2',
          event_offset: '202',
          record_time: '2026-07-07T12:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-2'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => ({
            status: 'decoded',
            value: {
              kind: 'record',
              fields: [
                {
                  label: 'transfer',
                  value:
                    contractInstance.toString() === 'transfer-2'
                      ? {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Alice' },
                            { label: 'receiver', value: 'Bob' },
                            { label: 'amount', value: '42.0' },
                          ],
                        }
                      : {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Carol' },
                            { label: 'receiver', value: 'Dave' },
                            { label: 'amount', value: '12.5' },
                          ],
                        },
                },
              ],
            },
          }),
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [
      { id: 'participant-1', label: 'Participant 1' },
      { id: 'participant-2', label: 'Participant 2' },
    ] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            amountGt?: string;
            amountLt?: string;
          },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30, {
      amountGt: '20',
      amountLt: '50',
    });

    expect(response.transfers).toEqual([
      {
        tokenId: 'canton-coin',
        tokenName: 'Canton Coin',
        amount: '42.0',
        sender: 'Alice',
        receiver: 'Bob',
        updateId: 'token-update-2',
        recordTime: '2026-07-07T12:00:00.000Z',
        nodes: [
          {
            nodeId: 'participant-2',
            label: 'Participant 2',
            eventOffset: '202',
          },
        ],
      },
    ]);
  });

  it('filters merged token transfers by effective movement types', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-1',
          event_offset: '101',
          record_time: '2026-07-07T11:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-1'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'token-update-2',
          event_offset: '202',
          record_time: '2026-07-07T12:00:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('transfer-2'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => ({
            status: 'decoded',
            value: {
              kind: 'record',
              fields: [
                {
                  label: 'transfer',
                  value:
                    contractInstance.toString() === 'transfer-2'
                      ? {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Alice' },
                            { label: 'receiver', value: 'Bob' },
                            { label: 'amount', value: '42.0' },
                          ],
                        }
                      : {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Carol' },
                            { label: 'receiver', value: 'Dave' },
                            { label: 'amount', value: '12.5' },
                          ],
                        },
                },
              ],
            },
          }),
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [
      { id: 'participant-1', label: 'Participant 1' },
      { id: 'participant-2', label: 'Participant 2' },
    ] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            movementTypes?: string[];
          },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30, {
      movementTypes: ['Transfer', 'Mint'],
    });

    expect(response.transfers).toEqual([
      {
        tokenId: 'canton-coin',
        tokenName: 'Canton Coin',
        amount: '42.0',
        sender: 'Alice',
        receiver: 'Bob',
        updateId: 'token-update-2',
        recordTime: '2026-07-07T12:00:00.000Z',
        nodes: [
          {
            nodeId: 'participant-2',
            label: 'Participant 2',
            eventOffset: '202',
          },
        ],
      },
      {
        tokenId: 'canton-coin',
        tokenName: 'Canton Coin',
        amount: '12.5',
        sender: 'Carol',
        receiver: 'Dave',
        updateId: 'token-update-1',
        recordTime: '2026-07-07T11:00:00.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '101',
          },
        ],
      },
    ]);
  });

  it('returns a merged token transfer detail by update id', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'shared-update-1',
          event_offset: '29615',
          record_time: '2026-07-07T12:54:23.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('shared-transfer'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'shared-update-1',
          event_offset: '58393',
          record_time: '2026-07-07T12:54:23.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('shared-transfer'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            {
              label: 'transfer',
              value: {
                kind: 'record',
                fields: [
                  { label: 'sender', value: 'Alice' },
                  { label: 'receiver', value: 'Bob' },
                  { label: 'amount', value: '42.0' },
                ],
              },
            },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenTransferDetail: (
          nodes: Array<{ id: string; label: string }>,
          updateId: string,
        ) => Promise<TokenTransfersResponse['transfers'][number]>;
      }
    ).fetchTokenTransferDetail(
      [
        { id: 'participant-1', label: 'CNQS App Provider' },
        { id: 'participant-2', label: 'CNQS Super Validator' },
      ],
      'shared-update-1',
    );

    expect(response).toEqual({
      tokenId: 'canton-coin',
      tokenName: 'Canton Coin',
      amount: '42.0',
      sender: 'Alice',
      receiver: 'Bob',
      updateId: 'shared-update-1',
      recordTime: '2026-07-07T12:54:23.000Z',
      nodes: [
        {
          nodeId: 'participant-1',
          label: 'CNQS App Provider',
          eventOffset: '29615',
        },
        {
          nodeId: 'participant-2',
          label: 'CNQS Super Validator',
          eventOffset: '58393',
        },
      ],
    });
  });

  it('returns token detail for a discovered token with transfers filtered to that token id', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'transfer-update-1',
          event_offset: '901',
          record_time: '2026-07-07T14:10:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer'),
        },
        {
          update_id: 'holding-update-1',
          event_offset: '902',
          record_time: '2026-07-07T14:11:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('validator-license-holding'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'canton-update-1',
          event_offset: '903',
          record_time: '2026-07-07T14:12:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('canton-transfer'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'validator-license-transfer':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Alice' },
                      { label: 'amount', value: '42.5000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              case 'validator-license-holding':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Alice' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      { label: 'amount', value: '150.0000000000' },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      {
                        label: 'transfer',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Carol' },
                            { label: 'receiver', value: 'Dave' },
                            { label: 'amount', value: '12.5' },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenDetail: (
          nodes: Array<{ id: string; label: string }>,
          tokenId: string,
        ) => Promise<unknown>;
      }
    ).fetchTokenDetail(
      [
        { id: 'participant-1', label: 'Participant 1' },
        { id: 'participant-2', label: 'Participant 2' },
      ],
      'Issuer::validator-license',
    );

    expect(response).toEqual({
      token: {
        tokenId: 'Issuer::validator-license',
        name: 'Validator License',
        symbol: 'VL',
        issuer: 'Issuer',
        source: 'pqs',
      },
      transfers: [
        {
          tokenId: 'Issuer::validator-license',
          tokenName: 'Validator License',
          amount: '42.5000000000',
          sender: 'Issuer',
          receiver: 'Alice',
          updateId: 'transfer-update-1',
          recordTime: '2026-07-07T14:10:00.000Z',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              eventOffset: '901',
            },
          ],
        },
      ],
    });
  });

  it('infers CIP112 movement rows from holding lifecycle updates', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220aa11',
              event_offset: '122205',
              record_time: '2026-07-09T15:01:39.756Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220aa11'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'consuming_exercise',
              event_id: '#0:3',
              contract_id: 'old-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: 'TransferUnderlying',
              witnesses: ['vault-party'],
              contract_instance: null,
              exercise_argument: Buffer.from('transfer-underlying-argument'),
              exercise_result: Buffer.from('transfer-underlying-result'),
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:4',
              contract_id: 'new-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from(
                'new-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:5',
              contract_id: 'new-share-contract',
              template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from('new-share-contract-instance'),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'new-underlying-contract-instance':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'issuer', value: 'Issuer' },
                      { label: 'instrumentIdText', value: 'USDCx' },
                      {
                        label: 'transferPolicy',
                        value: {
                          kind: 'enum',
                          constructor: 'StrictVaultTransfers',
                        },
                      },
                      { label: 'account', value: { kind: 'unit' } },
                      { label: 'amount', value: '100.0000000000' },
                    ],
                  },
                };
              case 'new-share-contract-instance':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      {
                        label: 'vaultIdentity',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'VaultAdmin' },
                            { label: 'id', value: 'vault-1' },
                          ],
                        },
                      },
                      { label: 'owner', value: 'Alice' },
                      { label: 'name', value: 'USDCx Test Vault Share' },
                      { label: 'symbol', value: 'vUSDCx-SHARE' },
                      { label: 'amount', value: '100.0000000000' },
                    ],
                  },
                };
              default:
                return {
                  status: 'not_available',
                };
            }
          },
        ),
      decodeExerciseValue: jest.fn().mockImplementation(() => ({
        argument: {
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              {
                label: 'receiverAccount',
                value: { kind: 'unit' },
              },
              {
                label: 'context',
                value: { kind: 'enum', constructor: 'VaultOperationTransfer' },
              },
            ],
          },
        },
        result: {
          status: 'decoded',
          value: {
            kind: 'contract_id',
            value: 'new-underlying-contract',
          },
        },
      })),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('join "public"."__exercises" exercise_row'),
    );
    expect(response.transfers).toEqual([
      {
        rowId:
          '1220aa11:#0:5:Oz.Vault.Base.ShareToken.CIP112:ShareHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'VaultAdmin::vault-1:share',
        tokenName: 'USDCx Test Vault Share',
        amount: '100.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220aa11',
        recordTime: '2026-07-09T15:01:39.756Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122205',
          },
        ],
      },
      {
        rowId:
          '1220aa11:#0:4:Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'Issuer::USDCx',
        tokenName: 'USDCx',
        amount: '100.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220aa11',
        recordTime: '2026-07-09T15:01:39.756Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122205',
          },
        ],
      },
    ]);
  });

  it('infers CIP112 create movements from create-only holding lifecycle updates', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220cc33',
              event_offset: '122300',
              record_time: '2026-07-09T15:01:41.000Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220cc33'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'create',
              event_id: '#0:4',
              contract_id: 'new-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from(
                'new-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:5',
              contract_id: 'new-share-contract',
              template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from('new-share-contract-instance'),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'new-underlying-contract-instance':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'issuer', value: 'Issuer' },
                      { label: 'instrumentIdText', value: 'USDCx' },
                      {
                        label: 'transferPolicy',
                        value: {
                          kind: 'enum',
                          constructor: 'StrictVaultTransfers',
                        },
                      },
                      { label: 'account', value: { kind: 'unit' } },
                      { label: 'amount', value: '100.0000000000' },
                    ],
                  },
                };
              case 'new-share-contract-instance':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      {
                        label: 'vaultIdentity',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'VaultAdmin' },
                            { label: 'id', value: 'vault-1' },
                          ],
                        },
                      },
                      { label: 'owner', value: 'Alice' },
                      { label: 'name', value: 'USDCx Test Vault Share' },
                      { label: 'symbol', value: 'vUSDCx-SHARE' },
                      { label: 'amount', value: '100.0000000000' },
                    ],
                  },
                };
              default:
                return {
                  status: 'not_available',
                };
            }
          },
        ),
      decodeExerciseValue: jest.fn().mockImplementation(() => ({
        argument: { status: 'not_available' },
        result: { status: 'not_available' },
      })),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30);

    expect(response.transfers).toEqual([
      {
        rowId:
          '1220cc33:#0:5:Oz.Vault.Base.ShareToken.CIP112:ShareHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'VaultAdmin::vault-1:share',
        tokenName: 'USDCx Test Vault Share',
        amount: '100.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220cc33',
        recordTime: '2026-07-09T15:01:41.000Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122300',
          },
        ],
      },
      {
        rowId:
          '1220cc33:#0:4:Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'Issuer::USDCx',
        tokenName: 'USDCx',
        amount: '100.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220cc33',
        recordTime: '2026-07-09T15:01:41.000Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122300',
          },
        ],
      },
    ]);
  });

  it('prefers standard CIP112 EventLog_HoldingsChange exercises over inferred holding creates', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220dd44',
              event_offset: '122301',
              record_time: '2026-07-09T15:01:42.000Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220dd44'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'non_consuming_exercise',
              event_id: '#0:1',
              contract_id: 'event-log-contract',
              template_id: 'Splice.Api.Token.TransferEventsV2:EventLog',
              package_id: 'vault-base-package',
              choice: 'EventLog_HoldingsChange',
              witnesses: ['Issuer', 'Alice', 'Bob'],
              contract_instance: null,
              exercise_argument: Buffer.from('sender-eventlog-argument'),
              exercise_result: Buffer.from('eventlog-result'),
              raw: {},
            },
            {
              event_kind: 'non_consuming_exercise',
              event_id: '#0:2',
              contract_id: 'event-log-contract',
              template_id: 'Splice.Api.Token.TransferEventsV2:EventLog',
              package_id: 'vault-base-package',
              choice: 'EventLog_HoldingsChange',
              witnesses: ['Issuer', 'Alice', 'Bob'],
              contract_instance: null,
              exercise_argument: Buffer.from('receiver-eventlog-argument'),
              exercise_result: Buffer.from('eventlog-result'),
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:3',
              contract_id: 'new-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['Issuer', 'Bob'],
              contract_instance: Buffer.from(
                'new-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            if (
              contractInstance.toString() !== 'new-underlying-contract-instance'
            ) {
              return {
                status: 'not_available',
              };
            }

            return {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  { label: 'issuer', value: 'Issuer' },
                  { label: 'instrumentIdText', value: 'USDCx' },
                  {
                    label: 'transferPolicy',
                    value: {
                      kind: 'enum',
                      constructor: 'StrictVaultTransfers',
                    },
                  },
                  { label: 'owner', value: 'Bob' },
                  { label: 'amount', value: '25.0000000000' },
                ],
              },
            };
          },
        ),
      decodeExerciseValue: jest
        .fn()
        .mockImplementation(
          ({ exerciseArgument }: { exerciseArgument: Buffer | null }) => {
            const argumentName = exerciseArgument?.toString();
            if (argumentName === 'sender-eventlog-argument') {
              return {
                argument: {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'admin', value: 'Issuer' },
                      {
                        label: 'account',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'owner',
                              value: { kind: 'optional', value: 'Alice' },
                            },
                            {
                              label: 'provider',
                              value: { kind: 'optional', value: null },
                            },
                            { label: 'id', value: '' },
                          ],
                        },
                      },
                      {
                        label: 'transferLegSides',
                        value: {
                          kind: 'list',
                          items: [
                            {
                              kind: 'record',
                              fields: [
                                { label: 'transferLegId', value: 'transfer-1' },
                                {
                                  label: 'side',
                                  value: {
                                    kind: 'enum',
                                    constructor: 'SenderSide',
                                  },
                                },
                                {
                                  label: 'otherside',
                                  value: {
                                    kind: 'record',
                                    fields: [
                                      {
                                        label: 'owner',
                                        value: {
                                          kind: 'optional',
                                          value: 'Bob',
                                        },
                                      },
                                      {
                                        label: 'provider',
                                        value: {
                                          kind: 'optional',
                                          value: null,
                                        },
                                      },
                                      { label: 'id', value: '' },
                                    ],
                                  },
                                },
                                { label: 'amount', value: '25.0000000000' },
                                { label: 'instrumentId', value: 'USDCx' },
                              ],
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                result: { status: 'decoded', value: { kind: 'unit' } },
              };
            }

            return {
              argument: {
                status: 'decoded',
                value: {
                  kind: 'record',
                  fields: [
                    { label: 'admin', value: 'Issuer' },
                    {
                      label: 'account',
                      value: {
                        kind: 'record',
                        fields: [
                          {
                            label: 'owner',
                            value: { kind: 'optional', value: 'Bob' },
                          },
                          {
                            label: 'provider',
                            value: { kind: 'optional', value: null },
                          },
                          { label: 'id', value: '' },
                        ],
                      },
                    },
                    {
                      label: 'transferLegSides',
                      value: {
                        kind: 'list',
                        items: [
                          {
                            kind: 'record',
                            fields: [
                              { label: 'transferLegId', value: 'transfer-1' },
                              {
                                label: 'side',
                                value: {
                                  kind: 'enum',
                                  constructor: 'ReceiverSide',
                                },
                              },
                              {
                                label: 'otherside',
                                value: {
                                  kind: 'record',
                                  fields: [
                                    {
                                      label: 'owner',
                                      value: {
                                        kind: 'optional',
                                        value: 'Alice',
                                      },
                                    },
                                    {
                                      label: 'provider',
                                      value: { kind: 'optional', value: null },
                                    },
                                    { label: 'id', value: '' },
                                  ],
                                },
                              },
                              { label: 'amount', value: '25.0000000000' },
                              { label: 'instrumentId', value: 'USDCx' },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              result: { status: 'decoded', value: { kind: 'unit' } },
            };
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30);

    expect(response.transfers).toEqual([
      {
        rowId: '1220dd44:#0:1:transfer-1:Transfer',
        movementType: 'Transfer',
        source: 'pqs',
        tokenId: 'Issuer::USDCx',
        tokenName: 'USDCx',
        amount: '25.0000000000',
        sender: 'Alice',
        receiver: 'Bob',
        updateId: '1220dd44',
        recordTime: '2026-07-09T15:01:42.000Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122301',
          },
        ],
      },
    ]);
  });

  it('parses standard CIP112 EventLog_HoldingsChange exercises from PQS JSON payloads', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220ee55',
              event_offset: '122302',
              record_time: '2026-07-09T15:01:43.000Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220ee55'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'non_consuming_exercise',
              event_id: '#0:1',
              contract_id: 'event-log-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingEventLog',
              package_id: 'vault-base-package',
              choice: 'EventLog_HoldingsChange',
              witnesses: ['Issuer', 'Alice', 'Vault'],
              contract_instance: null,
              exercise_argument: {
                admin: 'Issuer',
                account: {
                  owner: 'Alice',
                  provider: null,
                  id: '',
                },
                transferLegSides: [
                  {
                    transferLegId: 'transfer-1',
                    side: 'SenderSide',
                    otherside: {
                      owner: 'Vault',
                      provider: null,
                      id: 'vault-account',
                    },
                    amount: '25.0000000000',
                    instrumentId: 'USDCx',
                  },
                ],
              },
              exercise_result: {},
              raw: {},
            },
            {
              event_kind: 'non_consuming_exercise',
              event_id: '#0:2',
              contract_id: 'event-log-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingEventLog',
              package_id: 'vault-base-package',
              choice: 'EventLog_HoldingsChange',
              witnesses: ['Issuer', 'Alice', 'Vault'],
              contract_instance: null,
              exercise_argument: {
                admin: 'Issuer',
                account: {
                  owner: 'Vault',
                  provider: null,
                  id: 'vault-account',
                },
                transferLegSides: [
                  {
                    transferLegId: 'transfer-1',
                    side: 'ReceiverSide',
                    otherside: {
                      owner: 'Alice',
                      provider: null,
                      id: '',
                    },
                    amount: '25.0000000000',
                    instrumentId: 'USDCx',
                  },
                ],
              },
              exercise_result: {},
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:3',
              contract_id: 'new-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['Issuer', 'Vault'],
              contract_instance: {
                issuer: 'Issuer',
                instrumentIdText: 'USDCx',
                owner: 'Vault',
                amount: '25.0000000000',
              },
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      {
        decodeContractInstance: jest.fn(),
        decodeExerciseValue: jest.fn(),
      } as never,
    );
    const nodes = [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30);

    expect(response.transfers).toEqual([
      {
        rowId: '1220ee55:#0:1:transfer-1:Transfer',
        movementType: 'Transfer',
        source: 'pqs',
        tokenId: 'Issuer::USDCx',
        tokenName: 'USDCx',
        amount: '25.0000000000',
        sender: 'Alice',
        receiver: 'Vault',
        updateId: '1220ee55',
        recordTime: '2026-07-09T15:01:43.000Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122302',
          },
        ],
      },
    ]);
  });

  it('filters inferred CIP112 create movements by multiple movement types', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220cc33',
              event_offset: '122300',
              record_time: '2026-07-09T15:01:41.000Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220cc33'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'create',
              event_id: '#0:4',
              contract_id: 'new-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from(
                'new-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:5',
              contract_id: 'new-share-contract',
              template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from('new-share-contract-instance'),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'new-underlying-contract-instance':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'issuer', value: 'Issuer' },
                      { label: 'instrumentIdText', value: 'USDCx' },
                      {
                        label: 'transferPolicy',
                        value: {
                          kind: 'enum',
                          constructor: 'StrictVaultTransfers',
                        },
                      },
                      { label: 'account', value: { kind: 'unit' } },
                      { label: 'amount', value: '100.0000000000' },
                    ],
                  },
                };
              case 'new-share-contract-instance':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      {
                        label: 'vaultIdentity',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'VaultAdmin' },
                            { label: 'id', value: 'vault-1' },
                          ],
                        },
                      },
                      { label: 'owner', value: 'Alice' },
                      { label: 'name', value: 'USDCx Test Vault Share' },
                      { label: 'symbol', value: 'vUSDCx-SHARE' },
                      { label: 'amount', value: '100.0000000000' },
                    ],
                  },
                };
              default:
                return {
                  status: 'not_available',
                };
            }
          },
        ),
      decodeExerciseValue: jest.fn().mockImplementation(() => ({
        argument: { status: 'not_available' },
        result: { status: 'not_available' },
      })),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: typeof nodes,
          limit?: number,
          options?: { movementTypes?: string[] },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(nodes, 30, {
      movementTypes: ['Create', 'Mint'],
    });

    expect(response.transfers).toEqual([
      {
        rowId:
          '1220cc33:#0:5:Oz.Vault.Base.ShareToken.CIP112:ShareHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'VaultAdmin::vault-1:share',
        tokenName: 'USDCx Test Vault Share',
        amount: '100.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220cc33',
        recordTime: '2026-07-09T15:01:41.000Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122300',
          },
        ],
      },
      {
        rowId:
          '1220cc33:#0:4:Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'Issuer::USDCx',
        tokenName: 'USDCx',
        amount: '100.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220cc33',
        recordTime: '2026-07-09T15:01:41.000Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122300',
          },
        ],
      },
    ]);
  });

  it('resolves inferred CIP112 transfer detail by row id', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220bb22',
              event_offset: '122196',
              record_time: '2026-07-09T15:01:38.902Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220bb22'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'non_consuming_exercise',
              event_id: '#0:0',
              contract_id: 'underlying-token-contract',
              template_id: 'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingToken',
              package_id: 'vault-base-package',
              choice: 'MintUnderlying',
              witnesses: ['mint-witness'],
              contract_instance: null,
              exercise_argument: Buffer.from('mint-underlying-argument'),
              exercise_result: Buffer.from('mint-underlying-result'),
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:1',
              contract_id: 'minted-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['mint-witness'],
              contract_instance: Buffer.from(
                'minted-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            if (
              contractInstance.toString() !==
              'minted-underlying-contract-instance'
            ) {
              return { status: 'not_available' };
            }

            return {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  { label: 'issuer', value: 'Issuer' },
                  { label: 'instrumentIdText', value: 'USDCx' },
                  {
                    label: 'transferPolicy',
                    value: {
                      kind: 'enum',
                      constructor: 'StrictVaultTransfers',
                    },
                  },
                  { label: 'account', value: { kind: 'unit' } },
                  { label: 'amount', value: '25.0000000000' },
                ],
              },
            };
          },
        ),
      decodeExerciseValue: jest.fn().mockImplementation(() => ({
        argument: { status: 'decoded', value: { kind: 'unit' } },
        result: { status: 'decoded', value: { kind: 'unit' } },
      })),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenTransferDetail: (
          nodes: Array<{ id: string; label: string }>,
          transferId: string,
        ) => Promise<TokenTransfersResponse['transfers'][number]>;
      }
    ).fetchTokenTransferDetail(
      [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }],
      '1220bb22:#0:1:Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding:Mint',
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('join "public"."__exercises" exercise_row'),
    );
    expect(response).toEqual({
      rowId:
        '1220bb22:#0:1:Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding:Mint',
      movementType: 'Mint',
      source: 'pqs_inferred_holding_v2',
      tokenId: 'Issuer::USDCx',
      tokenName: 'USDCx',
      amount: '25.0000000000',
      sender: 'Issuer',
      receiver: null,
      updateId: '1220bb22',
      recordTime: '2026-07-09T15:01:38.902Z',
      nodes: [
        {
          nodeId: 'cnqs-extra-1',
          label: 'CNQS Extra 1',
          eventOffset: '122196',
        },
      ],
    });
  });

  it('batches inferred CIP112 update event loading across recent movement updates', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('/* cip112_movement_update_ids */')) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220aa11',
              event_offset: '122205',
              record_time: '2026-07-09T15:01:39.756Z',
            },
            {
              update_id: '1220bb22',
              event_offset: '122206',
              record_time: '2026-07-09T15:01:40.756Z',
            },
          ],
        });
      }

      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220aa11'") &&
        sql.includes("'1220bb22'")
      ) {
        return Promise.resolve({
          rows: [
            {
              update_id: '1220aa11',
              event_kind: 'consuming_exercise',
              event_id: '#0:3',
              contract_id: 'old-underlying-contract-1',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: 'TransferUnderlying',
              witnesses: ['vault-party'],
              contract_instance: null,
              exercise_argument: Buffer.from('transfer-underlying-argument'),
              exercise_result: Buffer.from('transfer-underlying-result'),
              raw: {},
            },
            {
              update_id: '1220aa11',
              event_kind: 'create',
              event_id: '#0:4',
              contract_id: 'new-underlying-contract-1',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from(
                'new-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
            {
              update_id: '1220bb22',
              event_kind: 'consuming_exercise',
              event_id: '#0:3',
              contract_id: 'old-underlying-contract-2',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: 'TransferUnderlying',
              witnesses: ['vault-party'],
              contract_instance: null,
              exercise_argument: Buffer.from('transfer-underlying-argument'),
              exercise_result: Buffer.from('transfer-underlying-result'),
              raw: {},
            },
            {
              update_id: '1220bb22',
              event_kind: 'create',
              event_id: '#0:4',
              contract_id: 'new-underlying-contract-2',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from(
                'new-underlying-contract-instance',
              ),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            if (
              contractInstance.toString() !== 'new-underlying-contract-instance'
            ) {
              return {
                status: 'not_available',
              };
            }

            return {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  { label: 'issuer', value: 'Issuer' },
                  { label: 'instrumentIdText', value: 'USDCx' },
                  {
                    label: 'transferPolicy',
                    value: {
                      kind: 'enum',
                      constructor: 'StrictVaultTransfers',
                    },
                  },
                  {
                    label: 'account',
                    value: {
                      kind: 'record',
                      fields: [{ label: 'owner', value: 'Alice' }],
                    },
                  },
                  { label: 'amount', value: '100.0000000000' },
                ],
              },
            };
          },
        ),
      decodeExerciseValue: jest.fn().mockImplementation(() => ({
        argument: {
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [
              {
                label: 'receiverAccount',
                value: {
                  kind: 'record',
                  fields: [{ label: 'owner', value: 'Alice' }],
                },
              },
              {
                label: 'context',
                value: { kind: 'enum', constructor: 'VaultOperationTransfer' },
              },
            ],
          },
        },
        result: {
          status: 'decoded',
          value: {
            kind: 'contract_id',
            value: 'new-underlying-contract',
          },
        },
      })),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchLatestTokenTransfers: (
          nodes: Array<{ id: string; label: string }>,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchLatestTokenTransfers(
      [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }],
      30,
    );

    expect(
      query.mock.calls.filter(
        ([sql]) =>
          typeof sql === 'string' &&
          sql.includes('join "public"."__contracts" contract_row') &&
          sql.includes('join "public"."__exercises" exercise_row') &&
          sql.includes('order by update_id asc nulls last'),
      ),
    ).toHaveLength(1);
    expect(response.transfers).toHaveLength(2);
  });

  it('paginates transfers for a single token id without mixing in other tokens', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'transfer-update-2',
          event_offset: '911',
          record_time: '2026-07-07T14:20:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-2'),
        },
        {
          update_id: 'transfer-update-1',
          event_offset: '901',
          record_time: '2026-07-07T14:10:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-1'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'canton-update-1',
          event_offset: '903',
          record_time: '2026-07-07T14:12:00.000Z',
          template_id:
            'Splice.AmuletTransferInstruction:AmuletTransferInstruction',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('canton-transfer'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'validator-license-transfer-2':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Bob' },
                      { label: 'amount', value: '10.0000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              case 'validator-license-transfer-1':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Alice' },
                      { label: 'amount', value: '42.5000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      {
                        label: 'transfer',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'sender', value: 'Carol' },
                            { label: 'receiver', value: 'Dave' },
                            { label: 'amount', value: '12.5' },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [
      { id: 'participant-1', label: 'Participant 1' },
      { id: 'participant-2', label: 'Participant 2' },
    ] as const;

    const firstPage = await (
      service as PqsSummaryService & {
        fetchTokenTransfers: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchTokenTransfers(nodes, 'Issuer::validator-license', 1);

    expect(firstPage).toEqual({
      limit: 1,
      nextBefore: expect.any(String),
      nextAfter: null,
      transfers: [
        {
          tokenId: 'Issuer::validator-license',
          tokenName: 'Validator License',
          amount: '10.0000000000',
          sender: 'Issuer',
          receiver: 'Bob',
          updateId: 'transfer-update-2',
          recordTime: '2026-07-07T14:20:00.000Z',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              eventOffset: '911',
            },
          ],
        },
      ],
    });

    const secondPage = await (
      service as PqsSummaryService & {
        fetchTokenTransfers: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchTokenTransfers(nodes, 'Issuer::validator-license', 1, {
      before: firstPage.nextBefore ?? undefined,
    });

    expect(secondPage).toEqual({
      limit: 1,
      nextBefore: null,
      nextAfter: expect.any(String),
      transfers: [
        {
          tokenId: 'Issuer::validator-license',
          tokenName: 'Validator License',
          amount: '42.5000000000',
          sender: 'Issuer',
          receiver: 'Alice',
          updateId: 'transfer-update-1',
          recordTime: '2026-07-07T14:10:00.000Z',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              eventOffset: '901',
            },
          ],
        },
      ],
    });
  });

  it('filters token-scoped transfers by separate sender and receiver party lists', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'transfer-update-2',
          event_offset: '911',
          record_time: '2026-07-07T14:20:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-2'),
        },
        {
          update_id: 'transfer-update-1',
          event_offset: '901',
          record_time: '2026-07-07T14:10:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'validator-license-transfer-2':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Bob' },
                      { label: 'amount', value: '10.0000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Alice' },
                      { label: 'amount', value: '42.5000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({
          query: participant1Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'participant-1', label: 'Participant 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchTokenTransfers: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            fromParties?: string[];
            toParties?: string[];
          },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchTokenTransfers(nodes, 'Issuer::validator-license', 30, {
      fromParties: ['Issuer'],
      toParties: ['Alice'],
    });

    expect(response.transfers).toEqual([
      {
        tokenId: 'Issuer::validator-license',
        tokenName: 'Validator License',
        amount: '42.5000000000',
        sender: 'Issuer',
        receiver: 'Alice',
        updateId: 'transfer-update-1',
        recordTime: '2026-07-07T14:10:00.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '901',
          },
        ],
      },
    ]);
  });

  it('filters token-scoped transfers by strict amount bounds', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'transfer-update-2',
          event_offset: '911',
          record_time: '2026-07-07T14:20:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-2'),
        },
        {
          update_id: 'transfer-update-1',
          event_offset: '901',
          record_time: '2026-07-07T14:10:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'validator-license-transfer-2':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Bob' },
                      { label: 'amount', value: '10.0000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Alice' },
                      { label: 'amount', value: '42.5000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({
          query: participant1Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'participant-1', label: 'Participant 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchTokenTransfers: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            amountGt?: string;
            amountLt?: string;
          },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchTokenTransfers(nodes, 'Issuer::validator-license', 30, {
      amountGt: '20',
      amountLt: '50',
    });

    expect(response.transfers).toEqual([
      {
        tokenId: 'Issuer::validator-license',
        tokenName: 'Validator License',
        amount: '42.5000000000',
        sender: 'Issuer',
        receiver: 'Alice',
        updateId: 'transfer-update-1',
        recordTime: '2026-07-07T14:10:00.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '901',
          },
        ],
      },
    ]);
  });

  it('filters token-scoped transfers by effective movement type', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'transfer-update-2',
          event_offset: '911',
          record_time: '2026-07-07T14:20:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-2'),
        },
        {
          update_id: 'transfer-update-1',
          event_offset: '901',
          record_time: '2026-07-07T14:10:00.000Z',
          template_id: 'Splice.Api.Token.TransferInstructionV1:Transfer',
          package_id: 'splice-api-token-transfer-instruction-v1',
          contract_instance: Buffer.from('validator-license-transfer-1'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'validator-license-transfer-2':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Bob' },
                      { label: 'amount', value: '10.0000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'sender', value: 'Issuer' },
                      { label: 'receiver', value: 'Alice' },
                      { label: 'amount', value: '42.5000000000' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                  { key: 'symbol', value: 'VL' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({
          query: participant1Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'participant-1', label: 'Participant 1' }] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchTokenTransfers: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            movementType?: string;
          },
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchTokenTransfers(nodes, 'Issuer::validator-license', 30, {
      movementType: 'Transfer',
    });

    expect(response.transfers).toEqual([
      {
        tokenId: 'Issuer::validator-license',
        tokenName: 'Validator License',
        amount: '10.0000000000',
        sender: 'Issuer',
        receiver: 'Bob',
        updateId: 'transfer-update-2',
        recordTime: '2026-07-07T14:20:00.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '911',
          },
        ],
      },
      {
        tokenId: 'Issuer::validator-license',
        tokenName: 'Validator License',
        amount: '42.5000000000',
        sender: 'Issuer',
        receiver: 'Alice',
        updateId: 'transfer-update-1',
        recordTime: '2026-07-07T14:10:00.000Z',
        nodes: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '901',
          },
        ],
      },
    ]);
  });

  it('recovers share-token transfers using the canonical holder token id on grpc-enabled nodes', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('token_transfer_rows')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("'share-contract-1'")) {
        return Promise.resolve({
          rows: [
            {
              contract_id: 'share-contract-1',
              template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
              package_id: 'vault-base-package',
              contract_instance: Buffer.from('share-contract-instance'),
              created_update_id: '1220aa11',
              created_event_offset: '122205',
              created_record_time: '2026-07-09T15:01:39.756Z',
              archived_update_id: null,
              archived_event_offset: null,
              archived_record_time: null,
            },
          ],
        });
      }

      if (
        sql.includes('join "public"."__contracts" contract_row') &&
        sql.includes('join "public"."__exercises" exercise_row') &&
        sql.includes("'1220aa11'")
      ) {
        return Promise.resolve({
          rows: [
            {
              event_kind: 'consuming_exercise',
              event_id: '#0:3',
              contract_id: 'old-underlying-contract',
              template_id:
                'Oz.Vault.Base.TestToken.CIP112:TestUnderlyingHolding',
              package_id: 'vault-base-package',
              choice: 'TransferUnderlying',
              witnesses: ['vault-party'],
              contract_instance: null,
              exercise_argument: Buffer.from('transfer-underlying-argument'),
              exercise_result: Buffer.from('transfer-underlying-result'),
              raw: {},
            },
            {
              event_kind: 'create',
              event_id: '#0:5',
              contract_id: 'share-contract-1',
              template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
              package_id: 'vault-base-package',
              choice: null,
              witnesses: ['vault-party'],
              contract_instance: Buffer.from('share-contract-instance'),
              exercise_argument: null,
              exercise_result: null,
              raw: {},
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            if (contractInstance.toString() !== 'share-contract-instance') {
              return {
                status: 'not_available',
              };
            }

            return {
              status: 'decoded',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'vaultIdentity',
                    value: {
                      kind: 'record',
                      fields: [
                        { label: 'admin', value: 'LegacyVaultAdmin' },
                        { label: 'id', value: 'legacy-vault-id' },
                      ],
                    },
                  },
                  { label: 'owner', value: 'Alice' },
                  { label: 'name', value: 'USDCx Test Vault Share' },
                  { label: 'symbol', value: 'vUSDCx-SHARE' },
                  { label: 'amount', value: '55.0000000000' },
                ],
              },
            };
          },
        ),
      decodeExerciseValue: jest.fn().mockReturnValue({
        argument: {
          status: 'decoded',
          value: {
            kind: 'record',
            fields: [],
          },
        },
        result: {
          status: 'decoded',
          value: {
            kind: 'unit',
          },
        },
      }),
    };
    const grpcOperationsService = {
      fetchHoldingV2Tokens: jest.fn().mockResolvedValue([
        {
          tokenId: 'RegistryAdmin::USDCx-SHARE',
          name: 'USDCx Test Vault Share',
          symbol: 'vUSDCx-SHARE',
          issuer: 'RegistryAdmin',
          source: 'grpc',
        },
      ]),
      fetchHoldingV2TokenHolders: jest.fn().mockResolvedValue([
        {
          contractId: 'share-contract-1',
          nodeId: 'cnqs-extra-1',
          label: 'CNQS Extra 1',
          tokenId: 'RegistryAdmin::USDCx-SHARE',
          partyId: 'Alice',
          amount: '55.0000000000',
        },
      ]),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );
    const nodes = [
      { id: 'cnqs-extra-1', label: 'CNQS Extra 1', mode: 'pqs_with_grpc' },
    ] as const;

    const response = await (
      service as PqsSummaryService & {
        fetchTokenTransfers: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
        ) => Promise<TokenTransfersResponse>;
      }
    ).fetchTokenTransfers(nodes, 'RegistryAdmin::USDCx-SHARE', 30);

    expect(response.transfers).toEqual([
      {
        rowId:
          '1220aa11:#0:5:Oz.Vault.Base.ShareToken.CIP112:ShareHolding:Create',
        movementType: 'Create',
        source: 'pqs_inferred_holding_v2',
        tokenId: 'RegistryAdmin::USDCx-SHARE',
        tokenName: 'USDCx Test Vault Share',
        amount: '55.0000000000',
        sender: null,
        receiver: 'Alice',
        updateId: '1220aa11',
        recordTime: '2026-07-09T15:01:39.756Z',
        nodes: [
          {
            nodeId: 'cnqs-extra-1',
            label: 'CNQS Extra 1',
            eventOffset: '122205',
          },
        ],
      },
    ]);
  });

  it('returns top holders for a token by merging observed holdings across nodes', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'holding-update-1',
          event_offset: '1001',
          record_time: '2026-07-07T14:20:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('alice-holding'),
        },
        {
          update_id: 'holding-update-2',
          event_offset: '1002',
          record_time: '2026-07-07T14:21:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('bob-holding'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'holding-update-3',
          event_offset: '1003',
          record_time: '2026-07-07T14:22:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('alice-holding-shared'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'alice-holding':
              case 'alice-holding-shared':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Alice' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      { label: 'amount', value: '150.0000000000' },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Bob' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      { label: 'amount', value: '90.0000000000' },
                      {
                        label: 'meta',
                        value: {
                          kind: 'record',
                          fields: [
                            {
                              label: 'values',
                              value: {
                                kind: 'text_map',
                                entries: [
                                  { key: 'name', value: 'Validator License' },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenHolders: (
          nodes: Array<{ id: string; label: string }>,
          tokenId: string,
        ) => Promise<unknown>;
      }
    ).fetchTokenHolders(
      [
        { id: 'participant-1', label: 'Participant 1' },
        { id: 'participant-2', label: 'Participant 2' },
      ],
      'Issuer::validator-license',
    );

    expect(response).toEqual({
      tokenId: 'Issuer::validator-license',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      holders: [
        {
          partyId: 'Alice',
          amount: '300.0000000000',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
            },
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
            },
          ],
        },
        {
          partyId: 'Bob',
          amount: '90.0000000000',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
            },
          ],
        },
      ],
    });
  });

  it('returns top holders for a CIP112 token from PQS-only fallback holding creates', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'holding-update-cip112-1',
          event_offset: '1101',
          record_time: '2026-07-09T15:01:39.756Z',
          template_id: 'Oz.Vault.Base.ShareToken.CIP112:ShareHolding',
          package_id: 'vault-base-package',
          contract_instance: Buffer.from('alice-cip112-holding'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            {
              label: 'vaultIdentity',
              value: {
                kind: 'record',
                fields: [
                  { label: 'admin', value: 'VaultAdmin' },
                  { label: 'id', value: 'vault-1' },
                ],
              },
            },
            { label: 'owner', value: 'Alice' },
            { label: 'name', value: 'USDCx Test Vault Share' },
            { label: 'symbol', value: 'vUSDCx-SHARE' },
            { label: 'amount', value: '55.0000000000' },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenHolders: (
          nodes: Array<{ id: string; label: string }>,
          tokenId: string,
        ) => Promise<unknown>;
      }
    ).fetchTokenHolders(
      [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1' }],
      'VaultAdmin::vault-1:share',
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('%.CIP112'));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('join "public"."__contracts" contract_row'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'join "public"."__contract_tpe" contract_tpe_row',
      ),
    );
    expect(response).toEqual({
      tokenId: 'VaultAdmin::vault-1:share',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      holders: [
        {
          partyId: 'Alice',
          amount: '55.0000000000',
          nodes: [
            {
              nodeId: 'cnqs-extra-1',
              label: 'CNQS Extra 1',
            },
          ],
        },
      ],
    });
  });

  it('prefers gRPC HoldingV2 token holders for CIP112 tokens on grpc-enabled nodes', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'holding-update-cip56-1',
          event_offset: '1102',
          record_time: '2026-07-09T15:02:39.756Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('alice-cip56-holding'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            { label: 'owner', value: 'Alice' },
            {
              label: 'instrumentId',
              value: {
                kind: 'record',
                fields: [
                  { label: 'admin', value: 'Issuer' },
                  { label: 'id', value: 'validator-license' },
                ],
              },
            },
            { label: 'amount', value: '42.0000000000' },
            {
              label: 'meta',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'values',
                    value: {
                      kind: 'text_map',
                      entries: [
                        { key: 'name', value: 'Validator License' },
                        { key: 'symbol', value: 'VL' },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };
    const grpcOperationsService = {
      fetchHoldingV2Tokens: jest.fn().mockResolvedValue([
        {
          tokenId: 'RegistryAdmin::USDCx-SHARE',
          name: 'USDCx Test Vault Share',
          symbol: 'vUSDCx-SHARE',
          issuer: 'RegistryAdmin',
          source: 'grpc',
        },
      ]),
      fetchHoldingV2TokenHolders: jest.fn().mockResolvedValue([
        {
          contractId: 'share-contract-1',
          nodeId: 'cnqs-extra-1',
          label: 'CNQS Extra 1',
          tokenId: 'RegistryAdmin::USDCx-SHARE',
          partyId: 'Alice',
          amount: '55.0000000000',
        },
      ]),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
      undefined,
      undefined,
      undefined,
      grpcOperationsService as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenHolders: (
          nodes: Array<{ id: string; label: string; mode: 'pqs_with_grpc' }>,
          tokenId: string,
        ) => Promise<unknown>;
      }
    ).fetchTokenHolders(
      [{ id: 'cnqs-extra-1', label: 'CNQS Extra 1', mode: 'pqs_with_grpc' }],
      'RegistryAdmin::USDCx-SHARE',
    );

    expect(
      grpcOperationsService.fetchHoldingV2TokenHolders,
    ).toHaveBeenCalledWith(expect.objectContaining({ id: 'cnqs-extra-1' }));
    expect(response).toEqual({
      tokenId: 'RegistryAdmin::USDCx-SHARE',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      holders: [
        {
          partyId: 'Alice',
          amount: '55.0000000000',
          nodes: [
            {
              nodeId: 'cnqs-extra-1',
              label: 'CNQS Extra 1',
            },
          ],
        },
      ],
    });
  });

  it('uses configured token metadata keys when decoding PQS-observed holdings', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'holding-update-cip56-custom-meta',
          event_offset: '1201',
          record_time: '2026-07-09T15:12:39.756Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('alice-cip56-custom-meta-holding'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest.fn().mockReturnValue({
        status: 'decoded',
        value: {
          kind: 'record',
          fields: [
            {
              label: 'instrumentId',
              value: {
                kind: 'record',
                fields: [
                  { label: 'admin', value: 'Issuer' },
                  { label: 'id', value: 'validator-license' },
                ],
              },
            },
            {
              label: 'meta',
              value: {
                kind: 'record',
                fields: [
                  {
                    label: 'values',
                    value: {
                      kind: 'text_map',
                      entries: [
                        { key: 'display_name', value: 'Validator License' },
                        { key: 'ticker', value: 'VL' },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({ query }),
      } as never,
      decoder as never,
      undefined,
      undefined,
      {
        getTokenMetadataConfig: () => ({
          nameKeys: ['display_name'],
          symbolKeys: ['ticker'],
        }),
      } as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokens: (
          nodes: Array<{ id: string; label: string }>,
        ) => Promise<TokensResponse>;
      }
    ).fetchTokens([{ id: 'participant-1', label: 'Participant 1' } as never]);

    expect(response.tokens).toEqual([
      {
        tokenId: 'Issuer::validator-license',
        name: 'Validator License',
        symbol: 'VL',
        issuer: 'Issuer',
        source: 'pqs',
      },
    ]);
  });

  it('returns Canton Coin holders by summing active Amulets per party without double-counting the same contract across nodes', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          contract_id: 'amulet-contract-1',
          update_id: 'amulet-update-1',
          event_offset: '2001',
          record_time: '2026-07-07T15:00:00.000Z',
          template_id: 'Splice.Amulet:Amulet',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('alice-amulet-1'),
        },
        {
          contract_id: 'amulet-contract-2',
          update_id: 'amulet-update-2',
          event_offset: '2002',
          record_time: '2026-07-07T15:01:00.000Z',
          template_id: 'Splice.Amulet:Amulet',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('alice-amulet-2'),
        },
      ],
    });
    const participant2Query = jest.fn().mockResolvedValue({
      rows: [
        {
          contract_id: 'amulet-contract-1',
          update_id: 'amulet-update-1',
          event_offset: '3001',
          record_time: '2026-07-07T15:00:00.000Z',
          template_id: 'Splice.Amulet:Amulet',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('alice-amulet-1'),
        },
        {
          contract_id: 'amulet-contract-3',
          update_id: 'amulet-update-3',
          event_offset: '3002',
          record_time: '2026-07-07T15:02:00.000Z',
          template_id: 'Splice.Amulet:Amulet',
          package_id: 'splice-amulet-package',
          contract_instance: Buffer.from('bob-amulet'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'alice-amulet-1':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Alice' },
                      {
                        label: 'amount',
                        value: {
                          kind: 'record',
                          fields: [{ label: 'initialAmount', value: '25.0' }],
                        },
                      },
                    ],
                  },
                };
              case 'alice-amulet-2':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Alice' },
                      {
                        label: 'amount',
                        value: {
                          kind: 'record',
                          fields: [{ label: 'initialAmount', value: '10.0' }],
                        },
                      },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Bob' },
                      {
                        label: 'amount',
                        value: {
                          kind: 'record',
                          fields: [{ label: 'initialAmount', value: '5.0' }],
                        },
                      },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async (node: { id: string }) => ({
          query:
            node.id === 'participant-1' ? participant1Query : participant2Query,
        }),
      } as never,
      decoder as never,
    );

    const response = await (
      service as PqsSummaryService & {
        fetchTokenHolders: (
          nodes: Array<{ id: string; label: string }>,
          tokenId: string,
        ) => Promise<unknown>;
      }
    ).fetchTokenHolders(
      [
        { id: 'participant-1', label: 'Participant 1' },
        { id: 'participant-2', label: 'Participant 2' },
      ],
      'canton-coin',
    );

    expect(response).toEqual({
      tokenId: 'canton-coin',
      limit: 30,
      nextBefore: null,
      nextAfter: null,
      holders: [
        {
          partyId: 'Alice',
          amount: '35.0',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
            },
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
            },
          ],
        },
        {
          partyId: 'Bob',
          amount: '5.0',
          nodes: [
            {
              nodeId: 'participant-2',
              label: 'Participant 2',
            },
          ],
        },
      ],
    });
  });

  it('paginates token holders with opaque cursors', async () => {
    const participant1Query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'holding-update-1',
          event_offset: '1001',
          record_time: '2026-07-07T14:20:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('alice-holding'),
        },
        {
          update_id: 'holding-update-2',
          event_offset: '1002',
          record_time: '2026-07-07T14:21:00.000Z',
          template_id: 'Splice.Api.Token.HoldingV1:Holding',
          package_id: 'splice-api-token-holding-v1',
          contract_instance: Buffer.from('bob-holding'),
        },
      ],
    });
    const decoder = {
      decodeContractInstance: jest
        .fn()
        .mockImplementation(
          ({ contractInstance }: { contractInstance: Buffer }) => {
            switch (contractInstance.toString()) {
              case 'alice-holding':
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Alice' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      { label: 'amount', value: '150.0000000000' },
                    ],
                  },
                };
              default:
                return {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [
                      { label: 'owner', value: 'Bob' },
                      {
                        label: 'instrumentId',
                        value: {
                          kind: 'record',
                          fields: [
                            { label: 'admin', value: 'Issuer' },
                            { label: 'id', value: 'validator-license' },
                          ],
                        },
                      },
                      { label: 'amount', value: '90.0000000000' },
                    ],
                  },
                };
            }
          },
        ),
    };
    const service = new PqsSummaryService(
      {
        getRawExecutor: async () => ({
          query: participant1Query,
        }),
      } as never,
      decoder as never,
    );
    const nodes = [{ id: 'participant-1', label: 'Participant 1' }] as const;

    const firstPage = await (
      service as PqsSummaryService & {
        fetchTokenHolders: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenHoldersResponse>;
      }
    ).fetchTokenHolders(nodes, 'Issuer::validator-license', 1);

    expect(firstPage).toEqual({
      tokenId: 'Issuer::validator-license',
      limit: 1,
      nextBefore: expect.any(String),
      nextAfter: null,
      holders: [
        {
          partyId: 'Alice',
          amount: '150.0000000000',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
            },
          ],
        },
      ],
    });

    const secondPage = await (
      service as PqsSummaryService & {
        fetchTokenHolders: (
          nodes: typeof nodes,
          tokenId: string,
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<TokenHoldersResponse>;
      }
    ).fetchTokenHolders(nodes, 'Issuer::validator-license', 1, {
      before: firstPage.nextBefore ?? undefined,
    });

    expect(secondPage).toEqual({
      tokenId: 'Issuer::validator-license',
      limit: 1,
      nextBefore: null,
      nextAfter: expect.any(String),
      holders: [
        {
          partyId: 'Bob',
          amount: '90.0000000000',
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
            },
          ],
        },
      ],
    });
  });

  it('throws when a token detail is requested for an unknown token id', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      }),
    } as never);

    await expect(
      (
        service as PqsSummaryService & {
          fetchTokenDetail: (
            nodes: Array<{ id: string; label: string }>,
            tokenId: string,
          ) => Promise<unknown>;
        }
      ).fetchTokenDetail(
        [{ id: 'participant-1', label: 'Participant 1' }],
        'missing-token',
      ),
    ).rejects.toThrow('Token not found');
  });

  it('returns historical traffic purchases from BuyMemberTraffic exercises', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'update-traffic-1',
          event_offset: '42',
          record_time: '2026-07-21T12:00:00.000Z',
          exercise_argument: {
            trafficAmount: '1000000',
          },
          exercise_result: {
            purchasedTraffic: 'member-traffic-contract-id',
            amuletPaid: '12.5000000000',
          },
        },
      ],
    });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchTrafficPurchases(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        { limit: 15 },
      ),
    ).resolves.toEqual({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 15,
      nextBefore: null,
      nextAfter: null,
      purchases: [
        {
          updateId: 'update-traffic-1',
          eventOffset: '42',
          recordTime: '2026-07-21T12:00:00.000Z',
          purchasedTraffic: '1000000',
          amuletPaid: '12.5000000000',
        },
      ],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("module_name = 'Splice.AmuletRules'"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('exercise_row.argument as exercise_argument'),
    );
  });

  it('supports newer traffic purchase pages using an after cursor', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'update-traffic-3',
          event_offset: '43',
          record_time: '2026-07-21T12:03:00.000Z',
          exercise_argument: { trafficAmount: '3000000' },
          exercise_result: { amuletPaid: '30.0000000000' },
        },
        {
          update_id: 'update-traffic-4',
          event_offset: '44',
          record_time: '2026-07-21T12:04:00.000Z',
          exercise_argument: { trafficAmount: '4000000' },
          exercise_result: { amuletPaid: '40.0000000000' },
        },
        {
          update_id: 'update-traffic-5',
          event_offset: '45',
          record_time: '2026-07-21T12:05:00.000Z',
          exercise_argument: { trafficAmount: '5000000' },
          exercise_result: { amuletPaid: '50.0000000000' },
        },
      ],
    });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await expect(
      service.fetchTrafficPurchases(
        {
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          mode: 'pqs_only',
          pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
        },
        { limit: 2, after: '42' },
      ),
    ).resolves.toMatchObject({
      limit: 2,
      nextBefore: '43',
      nextAfter: '44',
      purchases: [
        { updateId: 'update-traffic-4', eventOffset: '44' },
        { updateId: 'update-traffic-3', eventOffset: '43' },
      ],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tx.offset > 42'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('order by tx.offset asc'),
    );
  });

  it('applies date, purchased traffic, and paid amount filters', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);

    await service.fetchTrafficPurchases(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      {
        limit: 15,
        minDate: '2026-07-01',
        maxDate: '2026-07-31',
        purchasedMin: '500000',
        purchasedMax: '2000000',
        paidMin: '10',
        paidMax: '20.5',
      },
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("tx.effective_at >= '2026-07-01'::date"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "tx.effective_at < ('2026-07-31'::date + interval '1 day')",
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "exercise_tpe_row.choice::text like '%AmuletRules_BuyMemberTraffic'",
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.not.stringContaining("exercise_row.argument->>'trafficAmount'"),
    );
  });

  it('merges selected node traffic purchases into one globally paginated result', async () => {
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query: jest.fn() }),
    } as never);
    const fetchTrafficPurchases = jest
      .spyOn(service, 'fetchTrafficPurchases')
      .mockResolvedValueOnce({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 3,
        nextBefore: null,
        nextAfter: null,
        purchases: [
          {
            updateId: 'update-1',
            eventOffset: '10',
            recordTime: '2026-07-21T12:00:00.000Z',
            purchasedTraffic: '100',
            amuletPaid: '1',
          },
        ],
      })
      .mockResolvedValueOnce({
        nodeId: 'participant-2',
        label: 'Participant 2',
        limit: 3,
        nextBefore: null,
        nextAfter: null,
        purchases: [
          {
            updateId: 'update-2',
            eventOffset: '20',
            recordTime: '2026-07-21T12:01:00.000Z',
            purchasedTraffic: '200',
            amuletPaid: '2',
          },
        ],
      });

    await expect(
      (
        service as PqsSummaryService & { fetchGlobalTrafficPurchases: Function }
      ).fetchGlobalTrafficPurchases(
        [
          {
            id: 'participant-1',
            label: 'Participant 1',
            role: 'participant',
            mode: 'pqs_only',
          },
          {
            id: 'participant-2',
            label: 'Participant 2',
            role: 'participant',
            mode: 'pqs_only',
          },
        ] as never,
        15,
        { nodeIds: ['participant-1', 'participant-2'] },
      ),
    ).resolves.toMatchObject({
      limit: 15,
      purchases: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          updateId: 'update-2',
        },
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          updateId: 'update-1',
        },
      ],
    });
    expect(fetchTrafficPurchases).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'participant-1' }),
      expect.objectContaining({ limit: expect.any(Number) }),
    );
  });

  it('adds an estimated traffic USD value to recent updates', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            update_id: 'update-1',
            event_offset: '10',
            record_time: '2026-07-25T12:00:00.000Z',
            paid_traffic_cost: '100',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ update_id: 'update-1', parties: ['Alice'] }],
      });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);
    const trafficCostEstimateService = {
      estimate: jest.fn().mockResolvedValue('12.34'),
    };
    (
      service as PqsSummaryService & { trafficCostEstimateService: unknown }
    ).trafficCostEstimateService = trafficCostEstimateService;
    jest.spyOn(service, 'fetchTrafficPurchases').mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 1,
      nextBefore: null,
      nextAfter: null,
      purchases: [
        {
          updateId: 'purchase-1',
          eventOffset: '9',
          recordTime: '2026-07-24T12:00:00.000Z',
          purchasedTraffic: '1000',
          amuletPaid: '5',
        },
      ],
    });

    const response = await service.fetchRecentUpdates({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_only',
      ledgerLabel: 'Retail Ledger',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tx.paid_traffic_cost::text'),
    );
    expect(trafficCostEstimateService.estimate).toHaveBeenCalledWith(
      '100',
      expect.objectContaining({ purchasedTraffic: '1000', amuletPaid: '5' }),
    );
    expect(response.updates[0]).toMatchObject({ estimatedTrafficUsd: '12.34' });
  });

  it('adds the estimate to update detail without exposing the raw traffic cost field', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          update_id: 'update-1',
          event_offset: '10',
          record_time_iso: '2026-07-25T12:00:00.000Z',
          paid_traffic_cost: '100',
        },
      ],
    });
    const service = new PqsSummaryService({
      getRawExecutor: async () => ({ query }),
    } as never);
    (
      service as PqsSummaryService & { trafficCostEstimateService: unknown }
    ).trafficCostEstimateService = {
      estimate: jest.fn().mockResolvedValue('12.34'),
    };
    jest.spyOn(service, 'fetchTrafficPurchases').mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 1,
      nextBefore: null,
      nextAfter: null,
      purchases: [
        {
          updateId: 'purchase-1',
          eventOffset: '9',
          recordTime: '2026-07-24T12:00:00.000Z',
          purchasedTraffic: '1000',
          amuletPaid: '5',
        },
      ],
    });
    jest
      .spyOn(service as never, 'fetchPartiesByUpdateId' as never)
      .mockResolvedValue(new Map([['update-1', ['Alice']]]));
    jest
      .spyOn(service as never, 'fetchEventsByUpdateId' as never)
      .mockResolvedValue([]);

    const response = await service.fetchUpdateDetail(
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_only',
        ledgerLabel: 'Retail Ledger',
        pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      },
      '10',
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tx.paid_traffic_cost::text'),
    );
    expect(response.estimatedTrafficUsd).toBe('12.34');
    expect(response).not.toHaveProperty('paidTrafficCost');
  });
});
