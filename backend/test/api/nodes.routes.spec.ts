import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
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
            fetchPartyDetail: jest.fn().mockRejectedValue(new Error('Party not found')),
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
    expect(routePaths.indexOf('/api/parties/:partyId')).toBeGreaterThanOrEqual(0);
    expect(routePaths.indexOf('/api/parties/local')).toBeLessThan(
      routePaths.indexOf('/api/parties/:partyId'),
    );
  });
});
