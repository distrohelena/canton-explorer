import * as api from './api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchActiveParties,
  fetchActivityHistory,
  fetchLocalParties,
  fetchTokenDetail,
  fetchTokenHolders,
  fetchTokenTransfers,
  fetchTokenTransferDetail,
  fetchLatestTokenTransfers,
  fetchNodeActiveParties,
  fetchNodeContracts,
  fetchNodeLocalParties,
  fetchNodeParticipantStatus,
  fetchNodeUpdates,
  fetchNodes,
  fetchTokens,
} from './api';
import type { NodeContractDetailResponse, NodeContractsResponse } from '../types/contracts';
import type { NodePackagesResponse, NodeParticipantStatusResponse } from '../types/nodes';
import type { ActivePartiesResponse } from '../types/active-parties';
import type { PartyDetailResponse } from '../types/parties';
import type { PackageDetailResponse, PackageFamilyResponse } from '../types/packages';
import type {
  TokenDetailResponse,
  TokenHoldersResponse,
  TokenTransfersResponse,
  TokensResponse,
} from '../types/tokens';
import type { NodeUpdateDetailResponse } from '../types/updates';

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
    event_offset: '0000000000000001',
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

const typedNodeContractsFixture = {
  nodeId: 'participant-1',
  label: 'Participant 1',
  limit: 25,
  nextBefore: '000000000000000099',
  nextAfter: null,
  contracts: [
    {
      contractId: '00abc',
      templateId: 'Main:Asset',
      createdRecordTime: '2026-07-01T12:00:00.000Z',
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
  nodeId: 'participant-1',
  label: 'Participant 1',
  packagesByName: [
    {
      packageName: 'main-package-name',
      packages: [
        {
          packageId: 'main-package-v2',
          version: '1.2.4',
          uploadedAt: '2026-07-02T13:00:00.000Z',
          seenAt: '2026-07-02T13:05:00.000Z',
        },
        {
          packageId: 'main-package',
          version: '1.2.3',
          uploadedAt: '2026-07-02T12:00:00.000Z',
          seenAt: '2026-07-02T12:05:00.000Z',
        },
      ],
    },
  ],
} satisfies NodePackagesResponse;

const typedNodeParticipantStatusFixture = {
  nodeId: 'participant-2',
  label: 'Participant 2',
  mode: 'pqs_with_grpc',
  participantStatusStatus: 'ok',
  participantStatus: {
    uid: 'participant2::1220abc',
    uptime: '3600s',
    ports: {
      admin: 5012,
      ledger: 5011,
    },
    active: true,
    commonStatusActive: true,
    version: '3.4.0',
    supportedProtocolVersions: [30, 31],
    topologyQueues: {
      manager: 1,
      dispatcher: 2,
      clients: 3,
    },
    components: [
      {
        name: 'sync-service',
        severity: 'ok',
        description: 'running',
      },
    ],
    connectedSynchronizers: [
      {
        physicalSynchronizerId: 'physical::1220def',
        health: 'healthy',
      },
    ],
  },
  notInitialized: null,
  participantStatusError: null,
  participantStatusErrorCode: null,
  participantStatusErrorDetails: null,
  participantStatusErrorTid: null,
} satisfies NodeParticipantStatusResponse;

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
      updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
      recordTime: '2026-07-01T12:00:00.000Z',
      parties: ['Alice', 'Bob'],
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
  partyTopologyByNode: [],
} satisfies PartyDetailResponse;

const typedActivePartiesFixture = {
  nodes: [
    {
      nodeId: 'participant-1',
      label: 'Participant 1',
      mode: 'pqs_only',
      parties: ['Alice', 'Bob'],
      localPartiesStatus: 'grpc_not_configured',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    },
    {
      nodeId: 'participant-2',
      label: 'Participant 2',
      mode: 'pqs_with_grpc',
      parties: [],
      localPartiesStatus: 'ok',
      localPartiesError: null,
      localPartiesErrorCode: null,
      localPartiesErrorDetails: null,
      localPartiesErrorTid: null,
    },
  ],
} satisfies ActivePartiesResponse;

const typedTokensFixture = {
  tokens: [
    {
      tokenId: 'canton-coin',
      name: 'Canton Coin',
      symbol: null,
      source: 'pqs',
    },
  ],
} satisfies TokensResponse;

const typedTokenTransfersFixture = {
  limit: 25,
  nextBefore: 'cursor-token-1',
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
} satisfies TokenTransfersResponse;

const typedTokenDetailFixture = {
  token: {
    tokenId: 'canton-coin',
    name: 'Canton Coin',
    symbol: null,
    source: 'pqs',
  },
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
} satisfies TokenDetailResponse;

const typedScopedTokenTransfersFixture = {
  limit: 25,
  nextBefore: 'token-cursor-before-2',
  nextAfter: 'token-cursor-after-2',
  transfers: [
    {
      tokenId: 'validator-license',
      tokenName: 'Validator License',
      amount: '42.5000000000',
      sender: 'Issuer',
      receiver: 'Alice',
      updateId: 'validator-license-update-1',
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
} satisfies TokenTransfersResponse;

const typedTokenHoldersFixture = {
  tokenId: 'canton-coin',
  limit: 25,
  nextBefore: null,
  nextAfter: null,
  holders: [
    {
      partyId: 'Alice',
      amount: '100.0',
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
  ],
} satisfies TokenHoldersResponse;

const typedTokenTransferDetailFixture = {
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
} satisfies TokenTransfersResponse['transfers'][number];

describe('fetchNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps typed update and contract detail fixtures in sync with API response contracts', () => {
    expect(typedUpdateDetailFixture.events[0].createData).toBeDefined();
    expect(typedContractDetailFixture.contractData).toBeDefined();
    expect(typedPackageDetailFixture.templates[0].templateId).toBe('Splice.Amulet:SvRewardCoupon');
    expect(typedPackageFamilyFixture.packages[0].packageId).toBe('splice-amulet-v2');
    expect(typedNodePackagesFixture.packagesByName[0].packages[0].packageId).toBe('main-package-v2');
    expect(typedPartyDetailFixture.recentUpdates[0].updateId).toContain('1220994e');
    expect(typedTokenDetailFixture.token.tokenId).toBe('canton-coin');
    expect(typedTokenHoldersFixture.holders[0].partyId).toBe('Alice');
  });

  it('loads node summaries from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'participant-1', label: 'Participant 1', status: 'healthy' },
        ],
      }),
    );

    const nodes = await fetchNodes();

    expect(nodes[0].id).toBe('participant-1');
  });

  it('loads activity history from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: '2026-07-01T12:00:00.000Z',
          windowMinutes: 180,
          nodes: [
            {
              nodeId: 'participant-1',
              label: 'Participant 1',
              status: 'healthy',
              latestActiveContractCount: 15,
              samples: [
                {
                  timestamp: '2026-07-01T12:00:00.000Z',
                  activityValue: 3,
                  activeContractCount: 15,
                  latestOffset: '11',
                },
              ],
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const history = await fetchActivityHistory(7);

    expect(history.nodes[0].nodeId).toBe('participant-1');
    expect(history.nodes[0].samples[0].activityValue).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/nodes/activity-history?days=7');
  });

  it('loads active parties grouped by node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedActivePartiesFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchActiveParties();

    expect(result.nodes[0].nodeId).toBe('participant-1');
    expect(result.nodes[0].parties).toEqual(['Alice', 'Bob']);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/parties');
  });

  it('loads local parties grouped by node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedActivePartiesFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchLocalParties();

    expect(result.nodes[0].localPartiesStatus).toBe('grpc_not_configured');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/parties/local');
  });

  it('loads active parties for a single node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedActivePartiesFixture.nodes[0],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNodeActiveParties('participant-1');

    expect(result.nodeId).toBe('participant-1');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/nodes/participant-1/parties');
  });

  it('loads local parties for a single node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedActivePartiesFixture.nodes[1],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNodeLocalParties('participant-2');

    expect(result.nodeId).toBe('participant-2');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/nodes/participant-2/parties/local');
  });

  it('loads participant status for a single node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedNodeParticipantStatusFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNodeParticipantStatus('participant-2');

    expect(result.nodeId).toBe('participant-2');
    expect(result.participantStatus?.uid).toBe('participant2::1220abc');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/nodes/participant-2/participant-status',
    );
  });

  it('loads discovered tokens from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokensFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokens();

    expect(result.tokens[0]?.tokenId).toBe('canton-coin');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/tokens');
  });

  it('loads latest token transfers with cursor pagination from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenTransfersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchLatestTokenTransfers(25, { before: 'cursor-token-0' });

    expect(result.transfers[0]?.updateId).toBe('token-update-2');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/transfers?before=cursor-token-0&limit=25',
    );
  });

  it('loads latest token transfers with from/to party filters from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenTransfersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchLatestTokenTransfers(25, {
      fromParties: ['Alice', 'Carol'],
      toParties: ['Bob'],
    });

    expect(result.transfers[0]?.updateId).toBe('token-update-2');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/transfers?fromParty=Alice&fromParty=Carol&toParty=Bob&limit=25',
    );
  });

  it('loads latest token transfers with amount bounds from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenTransfersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchLatestTokenTransfers(25, {
      amountGt: '10.5',
      amountLt: '100.0',
    });

    expect(result.transfers[0]?.updateId).toBe('token-update-2');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/transfers?amountGt=10.5&amountLt=100.0&limit=25',
    );
  });

  it('loads a token detail by token id from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenDetailFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenDetail('canton-coin');

    expect(result.token.tokenId).toBe('canton-coin');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/tokens/canton-coin');
  });

  it('loads token holders by token id from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenHoldersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenHolders('canton-coin');

    expect(result.holders[0]?.partyId).toBe('Alice');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/tokens/canton-coin/holders?limit=25');
  });

  it('loads token holders by token id with cursor pagination from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenHoldersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenHolders('canton-coin', 25, { before: 'holders-cursor-1' });

    expect(result.holders[0]?.partyId).toBe('Alice');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/canton-coin/holders?before=holders-cursor-1&limit=25',
    );
  });

  it('loads token-scoped transfers with cursor pagination from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedScopedTokenTransfersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenTransfers('validator-license', 25, { before: 'token-cursor-before-2' });

    expect(result.transfers[0]?.tokenId).toBe('validator-license');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/validator-license/transfers?before=token-cursor-before-2&limit=25',
    );
  });

  it('loads token-scoped transfers with from/to party filters from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedScopedTokenTransfersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenTransfers('validator-license', 25, {
      fromParties: ['Issuer'],
      toParties: ['Alice', 'Bob'],
    });

    expect(result.transfers[0]?.tokenId).toBe('validator-license');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/validator-license/transfers?fromParty=Issuer&toParty=Alice&toParty=Bob&limit=25',
    );
  });

  it('loads token-scoped transfers with amount bounds from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedScopedTokenTransfersFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenTransfers('validator-license', 25, {
      amountGt: '20',
      amountLt: '50',
    });

    expect(result.transfers[0]?.tokenId).toBe('validator-license');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/validator-license/transfers?amountGt=20&amountLt=50&limit=25',
    );
  });

  it('loads a token transfer detail by update id from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedTokenTransferDetailFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTokenTransferDetail('token-update-2');

    expect(result.updateId).toBe('token-update-2');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/tokens/transfers/token-update-2',
    );
  });

  it('loads active contracts for a single node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedNodeContractsFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNodeContracts('participant-1', { before: '000000000000000099' });

    expect(result.nodeId).toBe('participant-1');
    expect(result.contracts[0].contractId).toBe('00abc');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/nodes/participant-1/contracts?before=000000000000000099',
    );
  });

  it('loads filtered active contracts for a single node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedNodeContractsFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNodeContracts('participant-1', {
      before: 'cursor-1',
      parties: ['Alice', 'Bob'],
      templates: ['Main:Asset'],
      partyMode: 'and',
      hideSplice: true,
    });

    expect(result.nodeId).toBe('participant-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/nodes/participant-1/contracts?before=cursor-1&party=Alice&party=Bob&template=Main%3AAsset&partyMode=and&hideSplice=true',
    );
  });

  it('loads recent updates for a node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        nodeId: 'participant-1',
        label: 'Participant 1',
        limit: 25,
        nextBefore: '000000000000000001',
        nextAfter: null,
        updates: [
          {
            eventOffset: '000000000000000001',
            updateId: '00000000000000000000000000000001',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const updates = await fetchNodeUpdates('participant-1', {
      before: '000000000000000025',
      parties: ['Alice', 'Bob'],
      templates: ['Main:Asset'],
      partyMode: 'and',
    });

    expect(updates.nodeId).toBe('participant-1');
    expect(updates.limit).toBe(25);
    expect(updates.nextBefore).toBe('000000000000000001');
    expect(updates.nextAfter).toBeNull();
    expect(updates.updates[0].eventOffset).toBe('000000000000000001');
    expect(updates.updates[0].updateId).toBe('00000000000000000000000000000001');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/nodes/participant-1/updates?before=000000000000000025&party=Alice&party=Bob&template=Main%3AAsset&partyMode=and',
    );
  });

  it('loads recent updates for a node without cursor params by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          nodeId: 'participant-1',
          label: 'Participant 1',
          limit: 25,
          nextBefore: null,
          nextAfter: null,
          updates: [
            {
              eventOffset: '000000000000000001',
              updateId: '00000000000000000000000000000001',
              recordTime: '2026-07-01T12:00:00.000Z',
              parties: ['Alice'],
            },
          ],
        }),
      }),
    );

    const updates = await fetchNodeUpdates('participant-1');

    expect(updates.nodeId).toBe('participant-1');
    expect(updates.limit).toBe(25);
    expect(updates.updates[0].eventOffset).toBe('000000000000000001');
    expect(updates.updates[0].updateId).toBe('00000000000000000000000000000001');
  });

  it('loads globally merged recent updates from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        updates: [
          {
            nodeId: 'participant-2',
            label: 'Participant 2',
            eventOffset: '000000000000000002',
            updateId: '00000000000000000000000000000002',
            recordTime: '2026-07-01T12:01:00.000Z',
            parties: ['Bob'],
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const apiModule = api as {
      fetchLatestUpdates?: (
        limit?: number,
        options?: { before?: string; after?: string },
      ) => Promise<{
        limit: number;
        nextBefore: string | null;
        nextAfter: string | null;
        updates: Array<{
          nodeId: string;
          label: string;
          eventOffset: string;
          updateId: string;
          recordTime: string | null;
          parties: string[];
        }>;
      }>;
    };

    expect(apiModule.fetchLatestUpdates).toBeTypeOf('function');

    const updates = await apiModule.fetchLatestUpdates?.();

    expect(updates).toEqual({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-2',
          label: 'Participant 2',
          eventOffset: '000000000000000002',
          updateId: '00000000000000000000000000000002',
          recordTime: '2026-07-01T12:01:00.000Z',
          parties: ['Bob'],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/updates?limit=25');
  });

  it('loads globally merged recent updates with cursor params from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 25,
        nextBefore: '000000000000000010',
        nextAfter: '000000000000000020',
        updates: [],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const updates = await (
      api as {
        fetchLatestUpdates?: (
          limit?: number,
          options?: { before?: string; after?: string },
        ) => Promise<{
          limit: number;
          nextBefore: string | null;
          nextAfter: string | null;
          updates: unknown[];
        }>;
      }
    ).fetchLatestUpdates?.(25, {
      before: '000000000000000010',
      after: '000000000000000020',
    });

    expect(updates).toEqual({
      limit: 25,
      nextBefore: '000000000000000010',
      nextAfter: '000000000000000020',
      updates: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/updates?before=000000000000000010&after=000000000000000020&limit=25',
    );
  });

  it('loads globally merged recent updates with filter params from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        updates: [],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const updates = await (
      api as {
        fetchLatestUpdates?: (
          limit?: number,
          options?: {
            before?: string;
            after?: string;
            parties?: string[];
            templates?: string[];
            partyMode?: 'or' | 'and';
            hideSplice?: boolean;
          },
        ) => Promise<{
          limit: number;
          nextBefore: string | null;
          nextAfter: string | null;
          updates: unknown[];
        }>;
      }
    ).fetchLatestUpdates?.(25, {
      parties: ['Alice', 'Bob'],
      templates: ['Main:Asset', 'Main:Wallet'],
      partyMode: 'and',
      hideSplice: true,
    });

    expect(updates).toEqual({
      limit: 25,
      nextBefore: null,
      nextAfter: null,
      updates: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/updates?party=Alice&party=Bob&template=Main%3AAsset&template=Main%3AWallet&partyMode=and&hideSplice=true&limit=25',
    );
  });

  it('loads a single update detail for a node from the backend API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
              raw: {
                event_id: '#0:0',
                contract_id: '00abc',
                template_id: 'Main:Asset',
              },
            },
          ],
          meta: {
            update_id: '\\x1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
            record_time: 1782907200000000,
            event_offset: '0000000000000001',
          },
        }),
      }),
    );

    const fetchNodeUpdateDetail = (
      api as {
        fetchNodeUpdateDetail?: (id: string, updateId: string) => Promise<unknown>;
      }
    ).fetchNodeUpdateDetail;

    expect(fetchNodeUpdateDetail).toBeTypeOf('function');

    const updateDetail = await fetchNodeUpdateDetail?.(
      'participant-1',
      '0000000000000001',
    );

    expect(updateDetail).toEqual(
      expect.objectContaining({
        nodeId: 'participant-1',
        eventOffset: '0000000000000001',
        updateId: '1220994e2270c5b3c5e5e0149d19cc2c4a2df6e1764f07b6a411a6a9cafe879fd8e1',
        events: [
          expect.objectContaining({
            eventKind: 'create',
            raw: expect.objectContaining({
              event_id: '#0:0',
            }),
          }),
        ],
      }),
    );
  });

  it('loads a single contract detail for a node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
        contractData: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchNodeContractDetail = (
      api as {
        fetchNodeContractDetail?: (id: string, contractId: string) => Promise<unknown>;
      }
    ).fetchNodeContractDetail;

    expect(fetchNodeContractDetail).toBeTypeOf('function');

    const contractDetail = await fetchNodeContractDetail?.('participant-1', '00abc');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/nodes/participant-1/contracts/00abc');
    expect(contractDetail).toEqual(
      expect.objectContaining({
        nodeId: 'participant-1',
        contractId: '00abc',
        templateId: 'Main:Asset',
      }),
    );
  });

  it('loads a global package detail from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedPackageDetailFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchPackageDetail = (
      api as {
        fetchPackageDetail?: (packageId: string) => Promise<unknown>;
      }
    ).fetchPackageDetail;

    expect(fetchPackageDetail).toBeTypeOf('function');

    const packageDetail = await fetchPackageDetail?.('splice-amulet');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/packages/splice-amulet');
    expect(packageDetail).toEqual(
      expect.objectContaining({
        packageId: 'splice-amulet',
        status: 'decoded',
        modules: ['Splice.Amulet'],
      }),
    );
  });

  it('loads all known versions for a package name from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedPackageFamilyFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchPackagesByName = (
      api as {
        fetchPackagesByName?: (packageName: string) => Promise<unknown>;
      }
    ).fetchPackagesByName;

    expect(fetchPackagesByName).toBeTypeOf('function');

    const packageFamily = await fetchPackagesByName?.('splice-amulet');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/packages/by-name/splice-amulet',
    );
    expect(packageFamily).toEqual(typedPackageFamilyFixture);
  });

  it('loads installed packages for a node from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedNodePackagesFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchNodePackages = (
      api as {
        fetchNodePackages?: (id: string) => Promise<unknown>;
      }
    ).fetchNodePackages;

    expect(fetchNodePackages).toBeTypeOf('function');

    const nodePackages = await fetchNodePackages?.('participant-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/nodes/participant-1/packages',
    );
    expect(nodePackages).toEqual(typedNodePackagesFixture);
  });

  it('loads party detail from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => typedPartyDetailFixture,
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchPartyDetail = (
      api as {
        fetchPartyDetail?: (partyId: string) => Promise<unknown>;
      }
    ).fetchPartyDetail;

    expect(fetchPartyDetail).toBeTypeOf('function');

    const partyDetail = await fetchPartyDetail?.('Alice');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/parties/Alice');
    expect(partyDetail).toEqual(typedPartyDetailFixture);
  });

  it('loads party-scoped updates from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 25,
        nextBefore: 'cursor-before-1',
        nextAfter: null,
        updates: [
          {
            nodeId: 'participant-1',
            label: 'Participant 1',
            eventOffset: '000000000000000001',
            updateId: '00000000000000000000000000000001',
            recordTime: '2026-07-01T12:00:00.000Z',
            parties: ['Alice'],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchPartyUpdates = (
      api as {
        fetchPartyUpdates?: (
          partyId: string,
          options?: {
            before?: string;
            after?: string;
            templates?: string[];
            hideSplice?: boolean;
          },
        ) => Promise<unknown>;
      }
    ).fetchPartyUpdates;

    expect(fetchPartyUpdates).toBeTypeOf('function');

    const updates = await fetchPartyUpdates?.('Alice', {
      before: 'cursor-before-0',
      templates: ['Main:Asset'],
      hideSplice: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/parties/Alice/updates?before=cursor-before-0&template=Main%3AAsset&hideSplice=true&limit=25',
    );
    expect(updates).toEqual({
      limit: 25,
      nextBefore: 'cursor-before-1',
      nextAfter: null,
      updates: [
        {
          nodeId: 'participant-1',
          label: 'Participant 1',
          eventOffset: '000000000000000001',
          updateId: '00000000000000000000000000000001',
          recordTime: '2026-07-01T12:00:00.000Z',
          parties: ['Alice'],
        },
      ],
    });
  });

  it('loads party-scoped contracts from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 25,
        nextBefore: 'cursor-contract-1',
        nextAfter: null,
        contracts: [
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
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchPartyContracts = (
      api as {
        fetchPartyContracts?: (
          partyId: string,
          options?: {
            before?: string;
            after?: string;
            limit?: number;
          },
        ) => Promise<unknown>;
      }
    ).fetchPartyContracts;

    expect(fetchPartyContracts).toBeTypeOf('function');

    const contracts = await fetchPartyContracts?.('Alice', {
      before: 'cursor-contract-0',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/parties/Alice/contracts?before=cursor-contract-0&limit=25',
    );
    expect(contracts).toEqual({
      limit: 25,
      nextBefore: 'cursor-contract-1',
      nextAfter: null,
      contracts: [
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
    });
  });

  it('loads filtered party-scoped contracts from the backend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limit: 25,
        nextBefore: null,
        nextAfter: null,
        contracts: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchPartyContracts = (
      api as {
        fetchPartyContracts?: (
          partyId: string,
          options?: {
            before?: string;
            after?: string;
            templates?: string[];
            hideSplice?: boolean;
            limit?: number;
          },
        ) => Promise<unknown>;
      }
    ).fetchPartyContracts;

    await fetchPartyContracts?.('Alice', {
      before: 'cursor-contract-0',
      templates: ['Main:Asset'],
      hideSplice: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/api/parties/Alice/contracts?before=cursor-contract-0&template=Main%3AAsset&hideSplice=true&limit=25',
    );
  });

  it('loads grouped search results from the backend API using the trimmed query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Alice',
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
          items: [{ partyId: 'Alice', nodeIds: ['participant-1'] }],
          displayedCount: 1,
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
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fetchSearchResults = (
      api as {
        fetchSearchResults?: (query: string) => Promise<unknown>;
      }
    ).fetchSearchResults;

    expect(fetchSearchResults).toBeTypeOf('function');

    const results = await fetchSearchResults?.(' Alice ');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/api/search?q=Alice');
    expect(results).toEqual({
      query: 'Alice',
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
        items: [{ partyId: 'Alice', nodeIds: ['participant-1'] }],
        displayedCount: 1,
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
  });
});
