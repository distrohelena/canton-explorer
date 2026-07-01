import { describe, expect, it } from '@jest/globals';
import { computeNodeStatus } from '../../src/domain/node-health';

describe('computeNodeStatus', () => {
  it('returns healthy when PQS and gRPC are both usable', () => {
    expect(
      computeNodeStatus({
        pqsOk: true,
        grpcRequired: true,
        grpcOk: true,
        isStale: false,
        hasUsableSnapshot: true,
      }),
    ).toBe('healthy');
  });

  it('returns degraded when snapshot is stale but still usable', () => {
    expect(
      computeNodeStatus({
        pqsOk: true,
        grpcRequired: false,
        grpcOk: false,
        isStale: true,
        hasUsableSnapshot: true,
      }),
    ).toBe('degraded');
  });

  it('returns down when PQS is unavailable and nothing usable remains', () => {
    expect(
      computeNodeStatus({
        pqsOk: false,
        grpcRequired: true,
        grpcOk: false,
        isStale: true,
        hasUsableSnapshot: false,
      }),
    ).toBe('down');
  });
});
