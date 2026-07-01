import { describe, expect, it, jest } from '@jest/globals';
import { GrpcOperationsService } from '../../src/grpc/grpc-operations.service';

describe('GrpcOperationsService', () => {
  it('returns reachability metadata when the channel becomes ready', async () => {
    const service = new GrpcOperationsService({
      create: () => ({
        waitForReady: (
          _deadline: number,
          callback: (error: Error | null) => void,
        ) => callback(null),
        Check: (
          _request: { service: string },
          callback: (_error: null, response: { status: string }) => void,
        ) => callback(null, { status: 'SERVING' }),
      }),
    } as never);

    const result = await service.fetchOperationalInfo({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: { target: 'localhost:5012', useTls: false, connectTimeoutMs: 5000 },
    });

    expect(result.reachable).toBe(true);
    expect(result.healthCheckImplemented).toBe(true);
    expect(result.servingStatus).toBe('SERVING');
  });
});
