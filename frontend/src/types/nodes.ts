export type NodeStatus = 'healthy' | 'degraded' | 'down';
export type NodeMode = 'pqs_only' | 'pqs_with_grpc';

export interface SourceStatus {
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface NodeSnapshot {
  id: string;
  label: string;
  role: 'participant';
  mode: NodeMode;
  ledgerLabel: string;
  status: NodeStatus;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorSummary: string | null;
  serviceInfo: {
    target: string | null;
    reachable: boolean;
    healthCheckImplemented: boolean;
    servingStatus: string | null;
  };
  ledgerSummary: {
    ledgerLabel: string;
    pqsDatabase: string;
    activeContractCount: number;
    latestOffset: string | null;
    latestEventAt: string | null;
    totalUpdateCount: number;
  };
  sourceStatus: Record<'pqs' | 'grpc', SourceStatus>;
}

export interface NodeTrafficState {
  synchronizerId: string;
  extraTrafficPurchased: string;
  extraTrafficConsumed: string;
  baseTrafficRemainder: string;
  lastConsumedCost: string;
  timestamp: string;
  serial: number | null;
}

export interface NodeTrafficPurchase {
  updateId: string;
  eventOffset: string;
  recordTime: string | null;
  purchasedTraffic: string | null;
  amuletPaid: string | null;
}

export interface NodeTrafficPurchasesResponse {
  nodeId: string;
  label: string;
  mode: NodeMode;
  current: {
    status: 'ok' | 'grpc_not_configured' | 'grpc_error';
    states: NodeTrafficState[];
    error: string | null;
  };
  history: {
    status: 'ok' | 'pqs_error';
    limit: number;
    nextBefore: string | null;
    nextAfter: string | null;
    purchases: NodeTrafficPurchase[];
    error: string | null;
  };
}

export interface GlobalTrafficPurchase extends NodeTrafficPurchase {
  nodeId: string;
  label: string;
}

export interface GlobalTrafficCurrentEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  status: 'ok' | 'grpc_not_configured' | 'grpc_error';
  states: NodeTrafficState[];
  error: string | null;
}

export interface GlobalTrafficHistoryStatus {
  nodeId: string;
  label: string;
  status: 'ok' | 'pqs_error';
  error: string | null;
}

export interface GlobalTrafficPurchasesResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  purchases: GlobalTrafficPurchase[];
  current: GlobalTrafficCurrentEntry[];
  historyStatus: GlobalTrafficHistoryStatus[];
}

export interface NodeInstalledPackageEntry {
  packageId: string;
  version: string | null;
  uploadedAt: string | null;
  seenAt: string;
}

export interface NodeInstalledPackageGroup {
  packageName: string;
  packages: NodeInstalledPackageEntry[];
}

export type NodeParticipantStatusState =
  | 'ok'
  | 'not_initialized'
  | 'grpc_not_configured'
  | 'grpc_error';

export type NodeParticipantStatusComponentSeverity = 'ok' | 'degraded' | 'failed' | 'fatal';
export type NodeParticipantSynchronizerHealth = 'unspecified' | 'healthy' | 'unhealthy';
export type NodeParticipantWaitingForExternalInput =
  | 'unspecified'
  | 'id'
  | 'node_topology'
  | 'initialization';

export interface NodeParticipantStatusComponent {
  name: string;
  severity: NodeParticipantStatusComponentSeverity;
  description: string | null;
}

export interface NodeParticipantTopologyQueues {
  manager: number;
  dispatcher: number;
  clients: number;
}

export interface NodeParticipantConnectedSynchronizer {
  physicalSynchronizerId: string | null;
  health: NodeParticipantSynchronizerHealth;
}

export interface NodeParticipantStatusSummary {
  uid: string | null;
  uptime: string | null;
  ports: Record<string, number>;
  active: boolean;
  commonStatusActive: boolean | null;
  version: string | null;
  supportedProtocolVersions: number[];
  topologyQueues: NodeParticipantTopologyQueues | null;
  components: NodeParticipantStatusComponent[];
  connectedSynchronizers: NodeParticipantConnectedSynchronizer[];
}

export interface NodeParticipantNotInitializedSummary {
  active: boolean;
  waitingForExternalInput: NodeParticipantWaitingForExternalInput;
  version: string | null;
}

export interface NodeParticipantStatusResponse {
  nodeId: string;
  label: string;
  mode: NodeMode;
  participantStatusStatus: NodeParticipantStatusState;
  participantStatus: NodeParticipantStatusSummary | null;
  notInitialized: NodeParticipantNotInitializedSummary | null;
  participantStatusError: string | null;
  participantStatusErrorCode: string | null;
  participantStatusErrorDetails: string | null;
  participantStatusErrorTid: string | null;
}

export interface NodePackagesResponse {
  nodeId: string;
  label: string;
  packagesByName: NodeInstalledPackageGroup[];
}
