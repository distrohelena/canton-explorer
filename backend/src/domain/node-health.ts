import type { NodeStatus } from './node.types';

export interface ComputeNodeStatusArgs {
  pqsOk: boolean;
  grpcRequired: boolean;
  grpcOk: boolean;
  isStale: boolean;
  hasUsableSnapshot: boolean;
}

export function computeNodeStatus(args: ComputeNodeStatusArgs): NodeStatus {
  if (!args.pqsOk && !args.hasUsableSnapshot) {
    return 'degraded';
  }

  if (args.isStale) {
    return 'degraded';
  }

  if (args.grpcRequired && !args.grpcOk) {
    return 'degraded';
  }

  return args.pqsOk ? 'healthy' : 'degraded';
}
