import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { NodesController } from '../../src/api/nodes.controller';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodeConfigService } from '../../src/config/node-config.service';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';
import { NamespaceFingerprintService } from '../../src/namespaces/namespace-fingerprint.service';
import { PqsSummaryService } from '../../src/pqs/pqs-summary.service';

describe('NodesController routes', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('returns 400 instead of 500 for a malformed update offset', async () => {
    const fetchUpdateDetail = jest
      .fn()
      .mockRejectedValue(new Error('Invalid event offset'));
    const moduleRef = await Test.createTestingModule({
      controllers: [NodesController],
      providers: [
        { provide: NodeCacheService, useValue: {} },
        {
          provide: NodeConfigService,
          useValue: {
            list: jest.fn().mockReturnValue([
              {
                id: 'participant-1',
                label: 'Participant 1',
                role: 'participant',
                mode: 'pqs_only',
                pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
              },
            ]),
          },
        },
        { provide: GrpcOperationsService, useValue: {} },
        { provide: NamespaceFingerprintService, useValue: {} },
        { provide: PqsSummaryService, useValue: { fetchUpdateDetail } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).get(
      '/api/nodes/participant-1/updates/not-a-numeric-offset',
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid update offset');
    expect(fetchUpdateDetail).not.toHaveBeenCalled();
  });

  it('registers /api/parties/local before /api/parties/:partyId', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NodesController],
      providers: [
        {
          provide: NodeCacheService,
          useValue: {
            list: jest.fn(),
            get: jest.fn(),
            listActivityHistory: jest.fn(),
          },
        },
        {
          provide: NodeConfigService,
          useValue: {
            list: jest.fn().mockReturnValue([
              {
                id: 'participant-1',
                label: 'Participant 1',
                role: 'participant',
                mode: 'pqs_with_grpc',
                pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
                grpc: {
                  ledgerTarget: 'localhost:5012',
                  ledgerAdminTarget: 'localhost:5013',
                  participantAdminTarget: 'localhost:5014',
                  useTls: false,
                  connectTimeoutMs: 5000,
                },
              },
            ]),
          },
        },
        {
          provide: GrpcOperationsService,
          useValue: {
            listLocalParties: jest.fn().mockResolvedValue(['LocalAlice']),
          },
        },
        {
          provide: PqsSummaryService,
          useValue: {
            fetchGlobalRecentUpdates: jest.fn(),
            fetchRecentUpdates: jest.fn(),
            fetchUpdateDetail: jest.fn(),
            fetchContractDetail: jest.fn(),
            fetchPackageDetail: jest.fn(),
            fetchPackagesByName: jest.fn(),
            fetchNodePackages: jest.fn(),
            fetchActiveParties: jest.fn(),
            fetchPartyDetail: jest
              .fn()
              .mockRejectedValue(new Error('Party not found')),
            fetchPartySummary: jest.fn(),
            fetchPartyNodes: jest.fn(),
            fetchPartyTopology: jest.fn(),
            fetchNamespaceDetail: jest.fn(),
            fetchNamespaceSummary: jest.fn(),
            fetchNamespaceNodes: jest.fn(),
            fetchNamespaceTopology: jest.fn(),
            fetchNamespaceUpdates: jest.fn(),
            fetchNamespaceContracts: jest.fn(),
          },
        },
        {
          provide: NamespaceFingerprintService,
          useValue: {
            summarize: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const expressApp = app.getHttpAdapter().getInstance() as {
      router?: { stack?: Array<{ route?: { path?: string } }> };
    };
    const routePaths =
      expressApp.router?.stack
        ?.filter((layer) => layer.route?.path)
        .map((layer) => layer.route?.path) ?? [];

    expect(routePaths.indexOf('/api/parties/local')).toBeGreaterThanOrEqual(0);
    expect(routePaths.indexOf('/api/parties/:partyId')).toBeGreaterThanOrEqual(
      0,
    );
    expect(routePaths.indexOf('/api/parties/local')).toBeLessThan(
      routePaths.indexOf('/api/parties/:partyId'),
    );
  });

  it.each([
    ['/api/parties/:partyId/summary', '/api/parties/:partyId'],
    ['/api/parties/:partyId/nodes', '/api/parties/:partyId'],
    ['/api/parties/:partyId/topology', '/api/parties/:partyId'],
    ['/api/namespaces/:namespaceId/summary', '/api/namespaces/:namespaceId'],
    ['/api/namespaces/:namespaceId/nodes', '/api/namespaces/:namespaceId'],
    ['/api/namespaces/:namespaceId/topology', '/api/namespaces/:namespaceId'],
    ['/api/namespaces/:namespaceId/updates', '/api/namespaces/:namespaceId'],
    ['/api/namespaces/:namespaceId/contracts', '/api/namespaces/:namespaceId'],
  ])(
    'registers literal section route %s before aggregate route %s',
    async (sectionPath, aggregatePath) => {
      const moduleRef = await Test.createTestingModule({
        controllers: [NodesController],
        providers: [
          {
            provide: NodeCacheService,
            useValue: {
              list: jest.fn(),
              get: jest.fn(),
              listActivityHistory: jest.fn(),
            },
          },
          {
            provide: NodeConfigService,
            useValue: { list: jest.fn().mockReturnValue([]) },
          },
          { provide: GrpcOperationsService, useValue: {} },
          { provide: NamespaceFingerprintService, useValue: {} },
          {
            provide: PqsSummaryService,
            useValue: {
              fetchPartyDetail: jest.fn(),
              fetchPartySummary: jest.fn(),
              fetchPartyNodes: jest.fn(),
              fetchPartyTopology: jest.fn(),
              fetchNamespaceDetail: jest.fn(),
              fetchNamespaceSummary: jest.fn(),
              fetchNamespaceNodes: jest.fn(),
              fetchNamespaceTopology: jest.fn(),
              fetchNamespaceUpdates: jest.fn(),
              fetchNamespaceContracts: jest.fn(),
            },
          },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
      const routePaths = (
        (
          app.getHttpAdapter().getInstance() as {
            router?: { stack?: Array<{ route?: { path?: string } }> };
          }
        ).router?.stack ?? []
      ).flatMap((layer) => (layer.route?.path ? [layer.route.path] : []));

      expect(routePaths.indexOf(sectionPath)).toBeGreaterThanOrEqual(0);
      expect(routePaths.indexOf(aggregatePath)).toBeGreaterThanOrEqual(0);
      expect(routePaths.indexOf(sectionPath)).toBeLessThan(
        routePaths.indexOf(aggregatePath),
      );
    },
  );
});
