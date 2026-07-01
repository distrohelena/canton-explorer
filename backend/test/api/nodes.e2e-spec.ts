import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { NodeCacheService } from '../../src/cache/node-cache.service';
import { NodeConfigService } from '../../src/config/node-config.service';

describe('Nodes API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NodeConfigService)
      .useValue({ list: () => [] })
      .compile();

    app = moduleRef.createNestApplication();
    const cache = app.get(NodeCacheService);
    cache.upsert({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      ledgerLabel: 'Retail Ledger',
      status: 'healthy',
      latencyMs: 21,
      lastSuccessAt: '2026-07-01T12:00:00.000Z',
      lastErrorAt: null,
      errorSummary: null,
      serviceInfo: {
        target: 'localhost:5012',
        reachable: true,
        healthCheckImplemented: true,
        servingStatus: 'SERVING',
      },
      ledgerSummary: {
        ledgerLabel: 'Retail Ledger',
        pqsDatabase: 'participant1_pqs',
        activeContractCount: 12,
        latestOffset: '000000000000123456',
        latestEventAt: '2026-07-01T11:59:00.000Z',
      },
      sourceStatus: {
        pqs: {
          ok: true,
          checkedAt: '2026-07-01T12:00:00.000Z',
          latencyMs: 11,
          message: null,
        },
        grpc: {
          ok: true,
          checkedAt: '2026-07-01T12:00:00.000Z',
          latencyMs: 10,
          message: null,
        },
      },
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns node summaries', async () => {
    const response = await request(app.getHttpServer()).get('/api/nodes').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('participant-1');
  });

  it('returns aggregated ledgers', async () => {
    const response = await request(app.getHttpServer()).get('/api/ledgers').expect(200);

    expect(response.body[0].ledgerLabel).toBe('Retail Ledger');
  });
});
