export type NodeRole = 'participant';
export type NodeMode = 'pqs_only' | 'pqs_with_grpc';
export type NodeStatus = 'healthy' | 'degraded' | 'down';

export interface SourceStatus {
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface LedgerSummary {
  ledgerLabel: string;
  pqsDatabase: string;
  activeContractCount: number;
  latestOffset: string | null;
  latestEventAt: string | null;
  totalUpdateCount: number;
}

export interface ServiceInfo {
  target: string | null;
  reachable: boolean;
  healthCheckImplemented: boolean;
  servingStatus: string | null;
}

export interface NodeActivitySample {
  timestamp: string;
  activityValue: number;
  activeContractCount: number;
  latestOffset: string | null;
}

export interface NodeActivitySeries {
  nodeId: string;
  label: string;
  status: NodeStatus;
  latestActiveContractCount: number;
  samples: NodeActivitySample[];
}

export interface NodeActivityHistoryResponse {
  generatedAt: string;
  windowMinutes: number;
  nodes: NodeActivitySeries[];
}

export interface NodeRecentUpdate {
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface NodeRecentUpdatesResponse {
  nodeId: string;
  label: string;
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  updates: NodeRecentUpdate[];
}

export interface GlobalRecentUpdate extends NodeRecentUpdate {
  nodeId: string;
  label: string;
}

export interface GlobalRecentUpdatesResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  updates: GlobalRecentUpdate[];
}

export interface SearchResultGroup<T> {
  items: T[];
  displayedCount: number;
  truncated: boolean;
  status: 'ok' | 'partial' | 'failed';
  warnings: string[];
}

export interface SearchUpdateResult {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface SearchContractResult {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  createdRecordTime: string | null;
}

export interface SearchPartyResult {
  partyId: string;
  nodeIds: string[];
}

export interface SearchPackageIdResult {
  packageId: string;
  name: string | null;
  version: string | null;
}

export interface SearchPackageNameResult {
  name: string;
  packages: Array<{
    packageId: string;
    version: string | null;
  }>;
}

export interface SearchResultsResponse {
  query: string;
  updates: SearchResultGroup<SearchUpdateResult>;
  contracts: SearchResultGroup<SearchContractResult>;
  parties: SearchResultGroup<SearchPartyResult>;
  packages: {
    packageIds: SearchResultGroup<SearchPackageIdResult>;
    packageNames: SearchResultGroup<SearchPackageNameResult>;
  };
}

export interface NodeActiveContractSummary {
  contractId: string;
  templateId: string | null;
  createdRecordTime: string | null;
}

export interface NodeContractsResponse {
  nodeId: string;
  label: string;
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  contracts: NodeActiveContractSummary[];
}

export interface GlobalContractSummary {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  recordTime: string | null;
}

export interface GlobalContractsResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  contracts: GlobalContractSummary[];
}

export interface NodeUpdateDetailMeta {
  update_id: string;
  record_time: string | number | null;
  [key: string]: unknown;
}

export type NodeDecodeFailureReason =
  | 'missing_package'
  | 'invalid_package'
  | 'unknown_template'
  | 'unknown_choice'
  | 'unknown_data_type'
  | 'decode_failure';

export type NodeDecodedDamlValue =
  | string
  | number
  | boolean
  | { kind: 'contract_id'; value: string }
  | { kind: 'record'; fields: Array<{ label: string; value: NodeDecodedDamlValue }> }
  | { kind: 'variant'; constructor: string; value: NodeDecodedDamlValue | null }
  | { kind: 'enum'; constructor: string }
  | { kind: 'list'; items: NodeDecodedDamlValue[] }
  | { kind: 'optional'; value: NodeDecodedDamlValue | null }
  | { kind: 'text_map'; entries: Array<{ key: string; value: NodeDecodedDamlValue }> }
  | { kind: 'gen_map'; entries: Array<{ key: NodeDecodedDamlValue; value: NodeDecodedDamlValue }> }
  | { kind: 'unit' };

export type NodeDecodeState<T> =
  | { status: 'decoded'; value: T }
  | { status: 'invalid_data'; reason: NodeDecodeFailureReason }
  | { status: 'not_available' };

export interface NodeExerciseDecodeState {
  argument: NodeDecodeState<NodeDecodedDamlValue>;
  result: NodeDecodeState<NodeDecodedDamlValue>;
}

export interface NodeUpdateDetailEvent {
  eventKind: 'create' | 'consuming_exercise' | 'non_consuming_exercise';
  eventId: string | null;
  contractId: string | null;
  packageId?: string | null;
  templateId: string | null;
  choice: string | null;
  witnesses: string[];
  createData?: NodeDecodeState<NodeDecodedDamlValue> | null;
  exerciseData?: NodeExerciseDecodeState | null;
  raw: Record<string, unknown>;
}

export interface NodeUpdateDetailResponse {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
  meta: NodeUpdateDetailMeta;
  events: NodeUpdateDetailEvent[];
}

export interface NodeContractDetailResponse {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  packageId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  createdUpdateId: string | null;
  createdEventOffset: string | null;
  createdRecordTime: string | null;
  archivedUpdateId: string | null;
  archivedEventOffset: string | null;
  archivedRecordTime: string | null;
  contractData: NodeDecodeState<NodeDecodedDamlValue> | null;
}

export interface PackageSeenOnNode {
  nodeId: string;
  packageName: string | null;
  packageVersion: string | null;
  seenAt: string;
}

export interface PackageTypeField {
  name: string;
  type: PackageTypeNode;
}

export interface PackageTypeConstructor {
  name: string;
  type: PackageTypeNode | null;
}

export interface PackageInterfaceMethod {
  name: string;
  type: PackageTypeNode | null;
}

export interface PackageInterfaceChoice {
  name: string;
  consuming: boolean;
  argumentType: PackageTypeNode | null;
  resultType: PackageTypeNode | null;
}

export interface PackageTypeNode {
  kind:
    | 'builtin'
    | 'type_var'
    | 'type_con'
    | 'record'
    | 'variant'
    | 'enum'
    | 'interface'
    | 'struct'
    | 'forall'
    | 'nat'
    | 'synonym'
    | 'unknown';
  label: string;
  packageId?: string | null;
  typeId?: string | null;
  arguments?: PackageTypeNode[];
  typeParameters?: string[];
  fields?: PackageTypeField[];
  constructors?: PackageTypeConstructor[];
  view?: PackageTypeNode | null;
  requires?: PackageTypeNode[];
  methods?: PackageInterfaceMethod[];
  choices?: PackageInterfaceChoice[];
  body?: PackageTypeNode | null;
  definition?: PackageTypeNode | null;
  note?: 'recursive_reference' | 'missing_definition' | 'unsupported';
}

export interface PackageTemplateSummary {
  templateId: string;
  moduleName: string;
  entityName: string;
  createType: PackageTypeNode | null;
}

export interface PackageDataTypeSummary {
  typeId: string;
  moduleName: string;
  entityName: string;
  definition: PackageTypeNode | null;
}

export interface PackageDetailResponse {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
  status: 'decoded' | 'invalid_package' | 'missing_package';
  seenOnNodes: PackageSeenOnNode[];
  moduleCount: number;
  templateCount: number;
  dataTypeCount: number;
  modules: string[];
  templates: PackageTemplateSummary[];
  dataTypes: PackageDataTypeSummary[];
}

export interface PackageFamilyEntry {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
}

export interface PackageFamilyResponse {
  name: string;
  packages: PackageFamilyEntry[];
}

export interface TemplateFilterEntry {
  templateId: string;
}

export interface TemplateFilterResponse {
  templates: TemplateFilterEntry[];
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

export interface ActivePartiesNodeEntry {
  nodeId: string;
  label: string;
  mode: NodeMode;
  parties: string[];
  localPartiesStatus?: 'ok' | 'grpc_not_configured' | 'grpc_error';
  localPartiesError?: string | null;
  localPartiesErrorCode?: string | null;
  localPartiesErrorDetails?: string | null;
  localPartiesErrorTid?: string | null;
}

export interface ActivePartiesResponse {
  nodes: ActivePartiesNodeEntry[];
}

export interface PartyNodeSummary {
  nodeId: string;
  label: string;
  recentUpdateCount: number;
  recentContractCount: number;
}

export interface PartyRecentUpdate {
  nodeId: string;
  label: string;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
  parties: string[];
}

export interface PartyRecentContract {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  packageId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  recordTime: string | null;
}

export interface PartyContractsResponse {
  limit: number;
  nextBefore: string | null;
  nextAfter: string | null;
  contracts: PartyRecentContract[];
}

export interface PartyTopologyParticipantMapping {
  participantId: string | null;
  participantUid: string | null;
  permission: string | null;
  synchronizerIds: string[];
}

export interface PartyTopologyKeyMapping {
  keyFingerprint: string | null;
  purpose: string | null;
  keyType: string | null;
  synchronizerIds: string[];
}

export type PartyTopologyNodeStatus = 'ok' | 'grpc_not_configured' | 'grpc_error';

export interface PartyTopologyNodeEntry {
  nodeId: string;
  label: string;
  status: PartyTopologyNodeStatus;
  errorMessage: string | null;
  partyToParticipants: PartyTopologyParticipantMapping[];
  partyToKeyMappings: PartyTopologyKeyMapping[];
}

export interface PartyDetailResponse {
  partyId: string;
  nodeCount: number;
  recentUpdateCount: number;
  recentContractCount: number;
  nodes: PartyNodeSummary[];
  recentUpdates: PartyRecentUpdate[];
  recentContracts: PartyRecentContract[];
  partyTopologyByNode: PartyTopologyNodeEntry[];
}
