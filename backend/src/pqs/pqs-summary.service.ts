import { Injectable, Optional } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import {
  DEFAULT_TOKEN_METADATA_CONFIG,
  type TokenMetadataConfig,
} from '../config/node-config.schema';
import { NodeConfigService } from '../config/node-config.service';
import type {
  PackageRegistryResult,
  ResolvedPackageInspection,
} from '../packages/daml-decoder.types';
import type {
  ActivePartiesResponse,
  RecentActivePartiesResponse,
  GlobalContractsResponse,
  GlobalRecentUpdatesResponse,
  NamespaceDetailResponse,
  NamespaceContractsResponse,
  NamespaceNodesResponse,
  NamespacePartiesResponse,
  NamespaceSummaryResponse,
  NamespaceTopologyResponse,
  NamespaceUpdatesResponse,
  NodeContractsResponse,
  NodeContractDetailResponse,
  NodePackagesResponse,
  PartyDetailResponse,
  PartyNodesResponse,
  PartySummaryResponse,
  PartyTopologyResponse,
  LedgerSummary,
  NodeDecodeFailureReason,
  NodeDecodeState,
  NodeDecodedDamlValue,
  NodeExerciseDecodeState,
  PackageTypeNode,
  PackageDetailDataTypesResponse,
  PackageDetailModulesResponse,
  PackageDetailNodesResponse,
  PackageDetailResponse,
  PackageDetailSummaryResponse,
  PackageDetailTemplatesResponse,
  PackageModuleDetailResponse,
  PackageTemplateDetailResponse,
  PackageFamilyResponse,
  NodeUpdateDetailEvent,
  NodeUpdateDetailMeta,
  NodeUpdateDetailResponse,
  NodeRecentUpdate,
  NodeRecentUpdatesResponse,
  NodeTrafficPurchase,
  NodeTrafficPurchasesResponse,
  GlobalTrafficCurrentEntry,
  GlobalTrafficHistoryStatus,
  GlobalTrafficPurchase,
  GlobalTrafficPurchasesResponse,
  PartyContractsResponse,
  SearchContractResult,
  SearchPackageIdResult,
  SearchPackageNameResult,
  SearchPartyResult,
  SearchResultGroup,
  SearchResultsResponse,
  SearchUpdateResult,
  TemplateFilterResponse,
  TokenSummary,
  TokenDetailResponse,
  TokenHoldersResponse,
  TokenHolderSummary,
  TokensResponse,
  TokenTransferSummary,
  TokenTransfersResponse,
} from '../domain/node.types';
import { PqsManagerFactory } from './pqs-manager.factory';
import { DamlValueDecoderService } from '../packages/daml-value-decoder.service';
import { PackageCacheService } from '../packages/package-cache.service';
import { PackageRegistryService } from '../packages/package-registry.service';
import {
  GrpcOperationsService,
  type GrpcTokenHolderObservation,
} from '../grpc/grpc-operations.service';
import { PackageSyncService } from '../packages/package-sync.service';
import {
  TrafficCostEstimateService,
  type TrafficCostEstimate,
} from '../traffic/traffic-cost-estimate.service';
import { qualifyPqsRelation } from './pqs-schema';

interface SummaryRow {
  pqs_database: string;
  active_contract_count: number | string | null;
  latest_offset: string | null;
  latest_event_at: string | null;
  total_update_count: number | string | null;
}

interface UpdateMetaRow {
  update_id: string | null;
  update_ix?: string | number | null;
  event_offset?: string | number | null;
  record_time: string | null;
  paid_traffic_cost?: string | null;
  candidate_frontier_ix?: string | number | null;
}

interface ActivityBucketRow {
  bucket_timestamp: string | null;
  activity_value: number | string | null;
  latest_offset: string | null;
}

interface UpdateDetailRow {
  update_id: string;
  event_offset?: string | number | null;
  record_time?: string | number | null;
  record_time_iso?: string | null;
  paid_traffic_cost?: string | null;
  meta?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface TrafficPurchaseRow {
  update_id: string;
  event_offset: string | number;
  record_time: string | null;
  package_id?: string | null;
  template_id?: string | null;
  choice?: string | null;
  exercise_argument?: unknown;
  exercise_result?: unknown;
}

interface TrafficPurchaseQueryFilters {
  minDate?: string;
  maxDate?: string;
  purchasedMin?: string;
  purchasedMax?: string;
  paidMin?: string;
  paidMax?: string;
}

interface UpdatePartiesRow {
  update_id: string;
  parties: string[] | string | null;
}

interface PartyContractRow {
  contract_id: string | null;
  template_id: string | null;
  package_id: string | null;
  record_time: string | null;
  created_event_offset?: string | number | null;
}

interface ActivePartiesRow {
  parties: string[] | string | null;
}

interface UpdateEventRow {
  update_id?: string | null;
  event_kind: 'create' | 'consuming_exercise' | 'non_consuming_exercise';
  event_id: string | null;
  contract_id: string | null;
  template_id: string | null;
  package_id?: string | null;
  choice: string | null;
  witnesses: string[] | string | null;
  contract_instance?: unknown;
  exercise_argument?: unknown;
  exercise_result?: unknown;
  raw: Record<string, unknown> | null;
}

interface RewardCouponInstanceRow {
  coupon_contract_id: string | null;
  contract_instance: unknown;
}

interface ContractDetailRow {
  contract_id: string;
  template_id: string | null;
  package_id: string | null;
  contract_instance: unknown;
  created_update_id: string | null;
  created_event_offset: string | number | null;
  created_record_time: string | null;
  archived_update_id: string | null;
  archived_event_offset: string | number | null;
  archived_record_time: string | null;
}

interface ActiveContractRow {
  contract_id: string;
  template_id: string | null;
  created_record_time: string | null;
  created_event_offset: string | number | null;
  created_at_ix?: string | number | null;
  create_event_pk?: string | number | null;
}

interface ActiveContractCursor {
  eventOffset: string;
  createdAtIx: string;
  createEventPk: string;
  contractId: string;
}

type DecodedActiveContractCursor =
  | { kind: 'compound'; value: ActiveContractCursor }
  | { kind: 'legacy'; eventOffset: string };

interface GlobalUpdateCursor {
  recordTime: string | null;
  nodeId: string;
  eventOffset: string;
  updateId: string;
}

interface GlobalMergedUpdate extends NodeRecentUpdate {
  nodeId: string;
  label: string;
}

interface GlobalContractCursor {
  recordTime: string | null;
  nodeId: string;
  contractId: string;
}

interface GlobalTrafficCursor {
  recordTime: string | null;
  nodeId: string;
  eventOffset: string;
  updateId: string;
}

interface GlobalMergedContract {
  nodeId: string;
  label: string;
  contractId: string;
  templateId: string | null;
  packageId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  recordTime: string | null;
}

interface TokenTransferRow {
  contract_id?: string | null;
  update_id: string;
  event_offset: string | number | null;
  record_time: string | null;
  template_id: string | null;
  package_id: string | null;
  contract_instance: unknown;
}

interface Cip112MovementUpdateRow {
  update_id: string;
  event_offset: string | number | null;
  record_time: string | null;
}

interface NodeTokenTransferObservation {
  rowId?: string;
  movementType?: string | null;
  source?: 'pqs' | 'pqs_inferred_holding_v2';
  nodeId: string;
  label: string;
  tokenId: string;
  tokenName: string;
  amount: string | null;
  sender: string | null;
  receiver: string | null;
  eventOffset: string;
  updateId: string;
  recordTime: string | null;
}

interface GlobalTokenTransferCursor {
  rowId?: string;
  recordTime: string | null;
  updateId: string;
  tokenId: string;
  amount: string | null;
  sender: string | null;
  receiver: string | null;
}

interface GlobalTokenHolderCursor {
  partyId: string;
  amount: string | null;
}

interface GlobalTokenCursor {
  tokenId: string;
  name: string;
}

interface CachedNodeTokenTransfers {
  cachedAt: number;
  transfers: NodeTokenTransferObservation[];
}

interface CachedNodeObservedTokens {
  cachedAt: number;
  tokens: TokenSummary[];
}

interface TokenTemplateType {
  pk: number;
  templateId: string;
  isCip112: boolean;
}

interface CachedNodeTokenTemplateTypes {
  cachedAt: number;
  templateTypes: TokenTemplateType[];
}

interface TokenTemplateTypeRow {
  pk: string | number | null;
  module_name: string | null;
  entity_name: string | null;
}

interface TemplateTypePkRow {
  type_source?: 'contract' | 'exercise';
  pk: string | number | bigint | null;
}

type TemplateTypePks = {
  contract: readonly bigint[];
  exercise: readonly bigint[];
};

interface LoadedNodeObservedTokens {
  refreshing: boolean;
  tokens: TokenSummary[];
}

interface NodeTokenHolderObservation {
  contractId: string | null;
  nodeId: string;
  label: string;
  tokenId: string;
  partyId: string;
  amount: string | null;
}

interface CachedNodeTokenHolders {
  cachedAt: number;
  holders: NodeTokenHolderObservation[];
}

interface SearchMatchedUpdate extends SearchUpdateResult {
  exact: boolean;
}

interface SearchMatchedContract extends SearchContractResult {
  exact: boolean;
}

interface SearchMatchedParty extends SearchPartyResult {
  exact: boolean;
}

interface SearchMatchedPackageId extends SearchPackageIdResult {
  exact: boolean;
}

interface SearchMatchedPackageName extends SearchPackageNameResult {
  exact: boolean;
}

interface PqsCoreRelations {
  contracts: string;
  contractTpe: string;
  exercises: string;
  exerciseTpe: string;
  events: string;
  packages: string;
  transactions: string;
}

const SEARCH_GROUP_LIMIT = 25;
const CANTON_COIN_TOKEN_ID = 'canton-coin';
const CANTON_COIN_TOKEN_NAME = 'Canton Coin';
const CANTON_COIN_TRANSFER_TEMPLATE_ID =
  'Splice.AmuletTransferInstruction:AmuletTransferInstruction';
const CANTON_COIN_AMULET_TEMPLATE_ID = 'Splice.Amulet:Amulet';
const AMULET_RULES_TEMPLATE_ID = 'Splice.AmuletRules:AmuletRules';
const NATIVE_AMULET_SUPPORT_TEMPLATE_IDS = [
  CANTON_COIN_AMULET_TEMPLATE_ID,
  AMULET_RULES_TEMPLATE_ID,
  'Splice.Amulet:ValidatorRight',
] as const;
const NATIVE_AMULET_INTRINSIC_ID = 'Amulet';
const CIP56_HOLDING_TEMPLATE_ID = 'Splice.Api.Token.HoldingV1:Holding';
const CIP56_TRANSFER_TEMPLATE_ID =
  'Splice.Api.Token.TransferInstructionV1:Transfer';
const CIP112_TEMPLATE_ID_LIKE_PATTERN = '%.CIP112:%';
const TOKEN_DISCOVERY_TEMPLATE_IDS = [
  CANTON_COIN_TRANSFER_TEMPLATE_ID,
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_HOLDING_TEMPLATE_ID,
  CIP56_TRANSFER_TEMPLATE_ID,
] as const;
const TOKEN_DISCOVERY_TEMPLATE_PATTERNS = [
  CIP112_TEMPLATE_ID_LIKE_PATTERN,
] as const;
const TOKEN_DISCOVERY_NON_CIP112_TEMPLATE_IDS = [
  CANTON_COIN_TRANSFER_TEMPLATE_ID,
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_HOLDING_TEMPLATE_ID,
  CIP56_TRANSFER_TEMPLATE_ID,
] as const;
const TOKEN_DISCOVERY_NON_CIP112_TEMPLATE_PATTERNS = [] as const;
const TOKEN_HOLDER_TEMPLATE_IDS = [
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_HOLDING_TEMPLATE_ID,
] as const;
const TOKEN_HOLDER_TEMPLATE_PATTERNS = [
  CIP112_TEMPLATE_ID_LIKE_PATTERN,
] as const;
const TOKEN_HOLDER_NON_CIP112_TEMPLATE_IDS = [
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_HOLDING_TEMPLATE_ID,
] as const;
const TOKEN_HOLDER_NON_CIP112_TEMPLATE_PATTERNS = [] as const;
const TOKEN_TRANSFER_TEMPLATE_IDS = [
  CANTON_COIN_TRANSFER_TEMPLATE_ID,
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_TRANSFER_TEMPLATE_ID,
] as const;
const INFERRED_HOLDING_V2_SOURCE = 'pqs_inferred_holding_v2';
const TOKEN_TRANSFER_CACHE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TRANSFER_CACHE_LIMIT = 250;

function pqsCoreRelations(node: NodeConfig): PqsCoreRelations {
  const qualifiedNode = {
    ...node,
    pqs: {
      connectionUriEnv: node.pqs?.connectionUriEnv ?? '',
      schema: node.pqs?.schema ?? 'public',
    },
  } as NodeConfig;

  return {
    contracts: qualifyPqsRelation(qualifiedNode, '__contracts'),
    contractTpe: qualifyPqsRelation(qualifiedNode, '__contract_tpe'),
    exercises: qualifyPqsRelation(qualifiedNode, '__exercises'),
    exerciseTpe: qualifyPqsRelation(qualifiedNode, '__exercise_tpe'),
    events: qualifyPqsRelation(qualifiedNode, '__events'),
    packages: qualifyPqsRelation(qualifiedNode, '__packages'),
    transactions: qualifyPqsRelation(qualifiedNode, '__transactions'),
  };
}

function isoUtcTimestampExpression(expression: string): string {
  return `to_char(${expression} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

function contractTemplateIdentifierExpression(alias: string): string {
  return `case
    when ${alias}.module_name is null or ${alias}.entity_name is null then null
    else ${alias}.module_name || ':' || ${alias}.entity_name
  end`;
}

function compareGlobalMergedUpdates(
  left: GlobalUpdateCursor,
  right: GlobalUpdateCursor,
): number {
  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (
    leftHasRecordTime &&
    rightHasRecordTime &&
    leftRecordTimeMs !== rightRecordTimeMs
  ) {
    return rightRecordTimeMs - leftRecordTimeMs;
  }

  if (leftHasRecordTime !== rightHasRecordTime) {
    return leftHasRecordTime ? -1 : 1;
  }

  if (left.nodeId !== right.nodeId) {
    return left.nodeId.localeCompare(right.nodeId);
  }

  if (left.eventOffset !== right.eventOffset) {
    return right.eventOffset.localeCompare(left.eventOffset);
  }

  return right.updateId.localeCompare(left.updateId);
}

function encodeGlobalUpdateCursor(update: GlobalUpdateCursor): string {
  return Buffer.from(JSON.stringify(update), 'utf8').toString('base64url');
}

function decodeGlobalUpdateCursor(cursor?: string): GlobalUpdateCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalUpdateCursor>;

    if (
      (decoded.recordTime === null || typeof decoded.recordTime === 'string') &&
      typeof decoded.nodeId === 'string' &&
      typeof decoded.eventOffset === 'string' &&
      typeof decoded.updateId === 'string'
    ) {
      return {
        recordTime: decoded.recordTime ?? null,
        nodeId: decoded.nodeId,
        eventOffset: decoded.eventOffset,
        updateId: decoded.updateId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function compareGlobalMergedContracts(
  left: GlobalContractCursor,
  right: GlobalContractCursor,
): number {
  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (
    leftHasRecordTime &&
    rightHasRecordTime &&
    leftRecordTimeMs !== rightRecordTimeMs
  ) {
    return rightRecordTimeMs - leftRecordTimeMs;
  }

  if (leftHasRecordTime !== rightHasRecordTime) {
    return leftHasRecordTime ? -1 : 1;
  }

  if (left.nodeId !== right.nodeId) {
    return left.nodeId.localeCompare(right.nodeId);
  }

  return right.contractId.localeCompare(left.contractId);
}

function encodeGlobalContractCursor(contract: GlobalContractCursor): string {
  return Buffer.from(JSON.stringify(contract), 'utf8').toString('base64url');
}

function decodeGlobalContractCursor(
  cursor?: string,
): GlobalContractCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalContractCursor>;

    if (
      (decoded.recordTime === null || typeof decoded.recordTime === 'string') &&
      typeof decoded.nodeId === 'string' &&
      typeof decoded.contractId === 'string'
    ) {
      return {
        recordTime: decoded.recordTime ?? null,
        nodeId: decoded.nodeId,
        contractId: decoded.contractId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function compareGlobalTrafficPurchases(
  left: GlobalTrafficPurchase | GlobalTrafficCursor,
  right: GlobalTrafficPurchase | GlobalTrafficCursor,
): number {
  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (
    leftHasRecordTime &&
    rightHasRecordTime &&
    leftRecordTimeMs !== rightRecordTimeMs
  ) {
    return rightRecordTimeMs - leftRecordTimeMs;
  }

  if (leftHasRecordTime !== rightHasRecordTime) {
    return leftHasRecordTime ? -1 : 1;
  }

  if (left.nodeId !== right.nodeId) {
    return left.nodeId.localeCompare(right.nodeId);
  }

  if (left.eventOffset !== right.eventOffset) {
    return right.eventOffset.localeCompare(left.eventOffset);
  }

  return right.updateId.localeCompare(left.updateId);
}

function encodeGlobalTrafficCursor(purchase: GlobalTrafficPurchase): string {
  return Buffer.from(
    JSON.stringify({
      recordTime: purchase.recordTime,
      nodeId: purchase.nodeId,
      eventOffset: purchase.eventOffset,
      updateId: purchase.updateId,
    }),
    'utf8',
  ).toString('base64url');
}

function decodeGlobalTrafficCursor(
  cursor?: string,
): GlobalTrafficCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalTrafficCursor>;

    if (
      (decoded.recordTime === null || typeof decoded.recordTime === 'string') &&
      typeof decoded.nodeId === 'string' &&
      typeof decoded.eventOffset === 'string' &&
      typeof decoded.updateId === 'string'
    ) {
      return {
        recordTime: decoded.recordTime ?? null,
        nodeId: decoded.nodeId,
        eventOffset: decoded.eventOffset,
        updateId: decoded.updateId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function compareSearchUpdates(
  left: SearchMatchedUpdate,
  right: SearchMatchedUpdate,
): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (
    leftHasRecordTime &&
    rightHasRecordTime &&
    leftRecordTimeMs !== rightRecordTimeMs
  ) {
    return rightRecordTimeMs - leftRecordTimeMs;
  }

  if (leftHasRecordTime !== rightHasRecordTime) {
    return leftHasRecordTime ? -1 : 1;
  }

  if (left.label !== right.label) {
    return left.label.localeCompare(right.label);
  }

  return right.eventOffset.localeCompare(left.eventOffset);
}

function compareSearchContracts(
  left: SearchMatchedContract,
  right: SearchMatchedContract,
): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  const leftRecordTimeMs = Date.parse(left.createdRecordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.createdRecordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (
    leftHasRecordTime &&
    rightHasRecordTime &&
    leftRecordTimeMs !== rightRecordTimeMs
  ) {
    return rightRecordTimeMs - leftRecordTimeMs;
  }

  if (leftHasRecordTime !== rightHasRecordTime) {
    return leftHasRecordTime ? -1 : 1;
  }

  if (left.label !== right.label) {
    return left.label.localeCompare(right.label);
  }

  return left.contractId.localeCompare(right.contractId);
}

function compareGlobalTokenTransfers(
  left: GlobalTokenTransferCursor,
  right: GlobalTokenTransferCursor,
): number {
  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (
    leftHasRecordTime &&
    rightHasRecordTime &&
    leftRecordTimeMs !== rightRecordTimeMs
  ) {
    return rightRecordTimeMs - leftRecordTimeMs;
  }

  if (leftHasRecordTime !== rightHasRecordTime) {
    return leftHasRecordTime ? -1 : 1;
  }

  if (left.updateId !== right.updateId) {
    return right.updateId.localeCompare(left.updateId);
  }

  if (left.tokenId !== right.tokenId) {
    return right.tokenId.localeCompare(left.tokenId);
  }

  if ((left.sender ?? '') !== (right.sender ?? '')) {
    return (right.sender ?? '').localeCompare(left.sender ?? '');
  }

  if ((left.receiver ?? '') !== (right.receiver ?? '')) {
    return (right.receiver ?? '').localeCompare(left.receiver ?? '');
  }

  if ((left.rowId ?? '') !== (right.rowId ?? '')) {
    return (right.rowId ?? '').localeCompare(left.rowId ?? '');
  }

  return (right.amount ?? '').localeCompare(left.amount ?? '');
}

function encodeGlobalTokenTransferCursor(
  transfer: GlobalTokenTransferCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      rowId: transfer.rowId,
      recordTime: transfer.recordTime,
      updateId: transfer.updateId,
      tokenId: transfer.tokenId,
      amount: transfer.amount,
      sender: transfer.sender,
      receiver: transfer.receiver,
    } satisfies GlobalTokenTransferCursor),
    'utf8',
  ).toString('base64url');
}

function decodeGlobalTokenTransferCursor(
  cursor?: string,
): GlobalTokenTransferCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalTokenTransferCursor>;

    if (
      (decoded.rowId === undefined || typeof decoded.rowId === 'string') &&
      (decoded.recordTime === null || typeof decoded.recordTime === 'string') &&
      typeof decoded.updateId === 'string' &&
      typeof decoded.tokenId === 'string' &&
      (decoded.amount === null || typeof decoded.amount === 'string') &&
      (decoded.sender === null || typeof decoded.sender === 'string') &&
      (decoded.receiver === null || typeof decoded.receiver === 'string')
    ) {
      return {
        rowId: decoded.rowId,
        recordTime: decoded.recordTime ?? null,
        updateId: decoded.updateId,
        tokenId: decoded.tokenId,
        amount: decoded.amount ?? null,
        sender: decoded.sender ?? null,
        receiver: decoded.receiver ?? null,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function compareGlobalTokenHolders(
  left: GlobalTokenHolderCursor,
  right: GlobalTokenHolderCursor,
): number {
  const leftValue =
    left.amount === null ? Number.NEGATIVE_INFINITY : Number(left.amount);
  const rightValue =
    right.amount === null ? Number.NEGATIVE_INFINITY : Number(right.amount);
  const leftValid = Number.isFinite(leftValue);
  const rightValid = Number.isFinite(rightValue);

  if (leftValid && rightValid && leftValue !== rightValue) {
    return rightValue - leftValue;
  }

  if (leftValid !== rightValid) {
    return leftValid ? -1 : 1;
  }

  return left.partyId.localeCompare(right.partyId);
}

function compareGlobalTokens(
  left: GlobalTokenCursor,
  right: GlobalTokenCursor,
): number {
  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.tokenId.localeCompare(right.tokenId);
}

function encodeGlobalTokenCursor(token: GlobalTokenCursor): string {
  return Buffer.from(
    JSON.stringify({
      tokenId: token.tokenId,
      name: token.name,
    } satisfies GlobalTokenCursor),
    'utf8',
  ).toString('base64url');
}

function decodeGlobalTokenCursor(cursor?: string): GlobalTokenCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalTokenCursor>;

    if (
      typeof decoded.tokenId === 'string' &&
      typeof decoded.name === 'string'
    ) {
      return {
        tokenId: decoded.tokenId,
        name: decoded.name,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function encodeGlobalTokenHolderCursor(
  holder: GlobalTokenHolderCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      partyId: holder.partyId,
      amount: holder.amount,
    } satisfies GlobalTokenHolderCursor),
    'utf8',
  ).toString('base64url');
}

function decodeGlobalTokenHolderCursor(
  cursor?: string,
): GlobalTokenHolderCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalTokenHolderCursor>;

    if (
      typeof decoded.partyId === 'string' &&
      (decoded.amount === null || typeof decoded.amount === 'string')
    ) {
      return {
        partyId: decoded.partyId,
        amount: decoded.amount ?? null,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function compareSearchParties(
  left: SearchMatchedParty,
  right: SearchMatchedParty,
): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  return left.partyId.localeCompare(right.partyId);
}

function compareSearchPackageIds(
  left: SearchMatchedPackageId,
  right: SearchMatchedPackageId,
): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  const leftName = left.name ?? '';
  const rightName = right.name ?? '';
  if (leftName !== rightName) {
    return leftName.localeCompare(rightName);
  }

  const leftVersion = left.version ?? '';
  const rightVersion = right.version ?? '';
  if (leftVersion !== rightVersion) {
    return rightVersion.localeCompare(leftVersion);
  }

  return left.packageId.localeCompare(right.packageId);
}

function compareSearchPackageNames(
  left: SearchMatchedPackageName,
  right: SearchMatchedPackageName,
): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function normalizePartyFilters(parties?: string[]): string[] {
  if (!parties) {
    return [];
  }

  return Array.from(
    new Set(
      parties.map((party) => party.trim()).filter((party) => party.length > 0),
    ),
  );
}

function normalizePartyFilterMode(partyMode?: string): 'or' | 'and' {
  return partyMode === 'and' ? 'and' : 'or';
}

function normalizeTemplateFilterValue(templateId: string): string {
  return templateId.trim().replace(/^t\|#[^:]+:/, '');
}

function normalizeTemplateFilters(templates?: string[]): string[] {
  if (!templates) {
    return [];
  }

  return Array.from(
    new Set(
      templates
        .map((templateId) => normalizeTemplateFilterValue(templateId))
        .filter((templateId) => templateId.length > 0),
    ),
  );
}

function normalizeTokenTextFilters(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeTokenIssuerFilters(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  );
}

function summaryQuery(node: NodeConfig): string {
  const relations = pqsCoreRelations(node);

  return `
    select
      current_database() as pqs_database,
      (
        select count(*)::int
        from ${relations.contracts} contract_row
        where contract_row.archived_at_ix is null
      ) as active_contract_count,
      (
        select max(tx.offset)::text
        from ${relations.transactions} tx
      ) as latest_offset,
      (
        select ${isoUtcTimestampExpression('max(tx.effective_at)')}
        from ${relations.transactions} tx
      ) as latest_event_at,
      (
        select count(*)::int
        from ${relations.transactions} tx
      ) as total_update_count
  `;
}

function pqsActivityBucketsQuery(
  node: NodeConfig,
  days: number,
  bucketMinutes: number,
): string {
  const relations = pqsCoreRelations(node);
  const normalizedDays =
    Number.isFinite(days) && days > 0 ? Math.trunc(days) : 30;
  const normalizedBucketMinutes =
    Number.isFinite(bucketMinutes) && bucketMinutes > 0
      ? Math.trunc(bucketMinutes)
      : 15;
  const bucketSeconds = normalizedBucketMinutes * 60;
  const minEffectiveAt = new Date(
    Date.now() - normalizedDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return `
    select
      to_char(
        to_timestamp(floor(extract(epoch from tx.effective_at) / ${bucketSeconds}) * ${bucketSeconds}) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as bucket_timestamp,
      count(*)::int as activity_value,
      max(tx.offset)::text as latest_offset
    from ${relations.transactions} tx
    where tx.effective_at >= '${escapeSqlLiteral(minEffectiveAt)}'::timestamptz
    group by 1
    order by 1 asc
  `;
}

function normalizeTemplateTypePks(
  templateTypePks: readonly bigint[],
): bigint[] {
  return Array.from(
    new Set(
      templateTypePks
        .filter((templateTypePk) => templateTypePk > 0n)
        .map((templateTypePk) => templateTypePk.toString()),
    ),
    (templateTypePk) => BigInt(templateTypePk),
  );
}

function templateTypePkFilterClause(
  column: string,
  templateTypePks: readonly bigint[],
): string {
  const normalizedTemplateTypePks = normalizeTemplateTypePks(templateTypePks);
  return normalizedTemplateTypePks.length > 0
    ? `${column} in (${normalizedTemplateTypePks.join(', ')})`
    : 'false';
}

type PqsUpdateCandidateWindow = {
  direction: 'asc' | 'desc';
  limit: number;
  eventCursorOperator: '>' | '<' | null;
  cursorCte: string | null;
};

type PqsUpdateCandidateCte = {
  name: string;
  sql: string;
  frontierSql: string;
};

type PqsUpdateEventCandidateBranch = {
  sql: string;
  frontierSql: string;
};

type PqsUpdateEventCandidateSet = {
  sql: string;
  frontierSql: string;
};

function buildPqsUpdateCandidateWindow(
  node: NodeConfig,
  limit: number,
  before: string | null,
  after: string | null,
): PqsUpdateCandidateWindow {
  const relations = pqsCoreRelations(node);
  const useAfterCursor = Boolean(after && !before);

  if (useAfterCursor && after) {
    return {
      direction: 'asc',
      limit,
      eventCursorOperator: '>',
      cursorCte: `update_cursor as (
        select coalesce(
          (
            select cursor_tx.ix
            from ${relations.transactions} cursor_tx
            where cursor_tx.offset <= ${after}
            order by cursor_tx.offset desc
            limit 1
          ),
          -1::bigint
        ) as cursor_ix
      )`,
    };
  }

  if (before) {
    return {
      direction: 'desc',
      limit,
      eventCursorOperator: '<',
      cursorCte: `update_cursor as (
        select coalesce(
          (
            select cursor_tx.ix
            from ${relations.transactions} cursor_tx
            where cursor_tx.offset >= ${before}
            order by cursor_tx.offset asc
            limit 1
          ),
          9223372036854775807::bigint
        ) as cursor_ix
      )`,
    };
  }

  return {
    direction: 'desc',
    limit,
    eventCursorOperator: null,
    cursorCte: null,
  };
}

function buildPqsUpdateEventCandidateBranch(
  source: string,
  eventColumn: string,
  matchCondition: string,
  window: PqsUpdateCandidateWindow,
  additionalCondition?: string,
): PqsUpdateEventCandidateBranch {
  const conditions = [
    `${eventColumn} is not null`,
    window.eventCursorOperator
      ? `${eventColumn} ${window.eventCursorOperator} (select cursor_ix from update_cursor)`
      : null,
    additionalCondition,
    matchCondition,
  ].filter((condition): condition is string => Boolean(condition));

  return {
    sql: `(select distinct ${eventColumn} as update_ix
        from ${source}
        where ${conditions.join('\n          and ')}
        order by ${eventColumn} ${window.direction}
        limit ${window.limit})`,
    frontierSql: `select update_ix
      from (
        select distinct ${eventColumn} as update_ix
        from ${source}
        where ${conditions.join('\n          and ')}
        order by ${eventColumn} ${window.direction}
        offset ${window.limit}
        limit 1
      ) event_candidate_frontier`,
  };
}

function buildPqsUpdateEventCandidateSet(
  node: NodeConfig,
  window: PqsUpdateCandidateWindow,
  contractMatch: string,
  exerciseMatch: string,
  candidateSourceName?: string,
): PqsUpdateEventCandidateSet {
  const relations = pqsCoreRelations(node);
  const candidateCondition = candidateSourceName
    ? (eventColumn: string) =>
        `${eventColumn} in (select update_ix from ${candidateSourceName})`
    : undefined;

  const branches = [
    buildPqsUpdateEventCandidateBranch(
      `${relations.contracts} contract_row`,
      'contract_row.created_at_ix',
      contractMatch,
      window,
      candidateCondition?.('contract_row.created_at_ix'),
    ),
    buildPqsUpdateEventCandidateBranch(
      `${relations.contracts} contract_row`,
      'contract_row.archived_at_ix',
      contractMatch,
      window,
      candidateCondition?.('contract_row.archived_at_ix'),
    ),
    buildPqsUpdateEventCandidateBranch(
      `${relations.exercises} exercise_row`,
      'exercise_row.exercised_at_ix',
      exerciseMatch,
      window,
      candidateCondition?.('exercise_row.exercised_at_ix'),
    ),
  ];

  return {
    sql: `select distinct update_ix
    from (
      ${branches.map((branch) => branch.sql).join('\n\n      union all\n\n      ')}
    ) matched_update_events`,
    frontierSql: branches
      .map((branch) => branch.frontierSql)
      .join('\n      union all\n      '),
  };
}

function buildPqsHideSpliceUpdateCandidateSet(
  node: NodeConfig,
  window: PqsUpdateCandidateWindow,
): PqsUpdateEventCandidateSet {
  const relations = pqsCoreRelations(node);
  const contractTemplateId =
    contractTemplateIdentifierExpression('contract_tpe_row');
  const exerciseTemplateId = contractTemplateIdentifierExpression(
    'exercise_contract_tpe_row',
  );
  const contractVisible = `(${contractTemplateId} is null or ${contractTemplateId} not like 'Splice.%')`;
  const exerciseVisible = `(${exerciseTemplateId} is null or ${exerciseTemplateId} not like 'Splice.%')`;

  const branches = [
    buildPqsUpdateEventCandidateBranch(
      `${relations.contracts} contract_row
        join ${relations.contractTpe} contract_tpe_row
          on contract_tpe_row.pk = contract_row.tpe_pk`,
      'contract_row.created_at_ix',
      contractVisible,
      window,
    ),
    buildPqsUpdateEventCandidateBranch(
      `${relations.contracts} contract_row
        join ${relations.contractTpe} contract_tpe_row
          on contract_tpe_row.pk = contract_row.tpe_pk`,
      'contract_row.archived_at_ix',
      contractVisible,
      window,
    ),
    buildPqsUpdateEventCandidateBranch(
      `${relations.exercises} exercise_row
        join ${relations.contractTpe} exercise_contract_tpe_row
          on exercise_contract_tpe_row.pk = exercise_row.contract_tpe_pk`,
      'exercise_row.exercised_at_ix',
      exerciseVisible,
      window,
    ),
  ];

  return {
    sql: `select distinct update_ix
    from (
      ${branches.map((branch) => branch.sql).join('\n\n      union all\n\n      ')}
    ) visible_update_events`,
    frontierSql: branches
      .map((branch) => branch.frontierSql)
      .join('\n      union all\n      '),
  };
}

function buildPqsUpdateCandidateCte(
  node: NodeConfig,
  window: PqsUpdateCandidateWindow,
  parties?: string[],
  templateTypePks?: TemplateTypePks,
  partyMode?: string,
  hideSplice?: boolean,
): PqsUpdateCandidateCte | null {
  const normalizedParties = normalizePartyFilters(parties);
  const hasTemplateFilter = templateTypePks !== undefined;

  if (normalizedParties.length === 0 && !hasTemplateFilter && !hideSplice) {
    return null;
  }

  const ctes: string[] = [];
  const frontierQueries: string[] = [];
  let partyCandidateName: string | null = null;
  let templateCandidateName: string | null = null;
  let visibleCandidateName: string | null = null;

  if (templateTypePks) {
    templateCandidateName = 'template_update_ix';
    const templateCandidates = buildPqsUpdateEventCandidateSet(
      node,
      window,
      templateTypePkFilterClause(
        'contract_row.tpe_pk',
        templateTypePks.contract,
      ),
      templateTypePkFilterClause(
        'exercise_row.tpe_pk',
        templateTypePks.exercise,
      ),
    );
    ctes.push(`${templateCandidateName} as materialized (
    ${templateCandidates.sql}
  )`);
    frontierQueries.push(templateCandidates.frontierSql);
  }

  if (hideSplice) {
    visibleCandidateName = 'visible_update_ix';
    const visibleCandidates = buildPqsHideSpliceUpdateCandidateSet(node, window);
    ctes.push(`${visibleCandidateName} as materialized (
    ${visibleCandidates.sql}
  )`);
    frontierQueries.push(visibleCandidates.frontierSql);
  }

  const partyCandidateSourceNames = [
    templateCandidateName,
    visibleCandidateName,
  ].filter((name): name is string => Boolean(name));
  const partyCandidateSourceName =
    partyCandidateSourceNames.length === 2
      ? 'visible_filtered_update_ix'
      : partyCandidateSourceNames[0];

  if (partyCandidateSourceNames.length === 2) {
    const [templateName, visibleName] = partyCandidateSourceNames;
    ctes.push(`${partyCandidateSourceName} as materialized (
    select ${templateName}.update_ix
    from ${templateName}
    join ${visibleName}
      on ${visibleName}.update_ix = ${templateName}.update_ix
  )`);
  }

  if (normalizedParties.length > 0) {
    const partyCandidateNames = normalizedParties.map((partyId, index) => {
      const name = `party_${index}_update_ix`;
      const partyCandidates = buildPqsUpdateEventCandidateSet(
        node,
        window,
        partyWitnessArrayMatchCondition('contract_row.witnesses', partyId),
        partyWitnessArrayMatchCondition('exercise_row.witnesses', partyId),
        partyCandidateSourceName,
      );
      ctes.push(`${name} as materialized (
    ${partyCandidates.sql}
  )`);
      frontierQueries.push(partyCandidates.frontierSql);
      return name;
    });
    partyCandidateName = 'party_update_ix';
    const partySetOperator =
      normalizePartyFilterMode(partyMode) === 'and' ? 'intersect' : 'union';
    ctes.push(`${partyCandidateName} as materialized (
    ${partyCandidateNames
      .map((name) => `select update_ix from ${name}`)
      .join(`\n    ${partySetOperator}\n    `)}
  )`);
  }

  const candidateNames = [
    partyCandidateName,
    templateCandidateName,
    visibleCandidateName,
  ].filter((name): name is string => Boolean(name));
  const name =
    candidateNames.length === 1 ? candidateNames[0] : 'filtered_update_ix';

  if (candidateNames.length > 1) {
    const [firstCandidateName, ...remainingCandidateNames] = candidateNames;
    ctes.push(`${name} as materialized (
    select ${firstCandidateName}.update_ix
    from ${firstCandidateName}
    ${remainingCandidateNames
      .map(
        (candidateName) =>
          `join ${candidateName}
      on ${candidateName}.update_ix = ${firstCandidateName}.update_ix`,
      )
      .join('\n    ')}
  )`);
  }

  return {
    name,
    sql: ctes.join(',\n'),
    frontierSql: frontierQueries.join('\n      union all\n      '),
  };
}

function pqsRecentUpdatesQuery(
  node: NodeConfig,
  limit: number,
  before?: string,
  after?: string,
  parties?: string[],
  templateTypePks?: TemplateTypePks,
  partyMode?: string,
  hideSplice?: boolean,
  candidateLimit?: number,
): string {
  const relations = pqsCoreRelations(node);
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const queryLimit = limit + 1;
  const candidateWindow = buildPqsUpdateCandidateWindow(
    node,
    candidateLimit ?? queryLimit,
    normalizedBefore,
    normalizedAfter,
  );
  const candidateCte = buildPqsUpdateCandidateCte(
    node,
    candidateWindow,
    parties,
    templateTypePks,
    partyMode,
    hideSplice,
  );
  const ctes = [
    candidateCte ? candidateWindow.cursorCte : null,
    candidateCte?.sql,
    candidateCte
      ? `candidate_progress as (
        select ${candidateWindow.direction === 'desc' ? 'max' : 'min'}(update_ix) as frontier_update_ix
        from (
          ${candidateCte.frontierSql}
        ) candidate_frontiers
      )`
      : null,
  ].filter((value): value is string => Boolean(value));
  const withClause = ctes.length > 0 ? `with ${ctes.join(',\n')}` : '';
  const fromClause = candidateCte
    ? `from ${candidateCte.name}
      join ${relations.transactions} tx
        on tx.ix = ${candidateCte.name}.update_ix
        ${
          normalizedAfter && !normalizedBefore
            ? `and tx.offset > ${normalizedAfter}`
            : normalizedBefore
              ? `and tx.offset < ${normalizedBefore}`
              : ''
        }
      right join candidate_progress on true`
    : `from ${relations.transactions} tx`;
  const afterFilters = [
    candidateCte || !normalizedAfter ? null : `tx.offset > ${normalizedAfter}`,
  ].filter((value): value is string => Boolean(value));
  const olderFilters = [
    candidateCte || !normalizedBefore ? null : `tx.offset < ${normalizedBefore}`,
  ].filter((value): value is string => Boolean(value));

  if (normalizedAfter && !normalizedBefore) {
    const whereClause =
      afterFilters.length > 0
        ? `where ${afterFilters.join('\n      and ')}`
        : '';
    return `
      ${withClause}
      select
        tx.transaction_id::text as update_id,
        tx.ix::text as update_ix,
        tx.offset::text as event_offset,
        ${isoUtcTimestampExpression('tx.effective_at')} as record_time,
        tx.paid_traffic_cost::text as paid_traffic_cost,
        ${candidateCte ? 'candidate_progress.frontier_update_ix::text' : 'null::text'} as candidate_frontier_ix
      ${fromClause}
      ${whereClause}
      order by tx.offset asc
      limit ${queryLimit}
    `;
  }

  const whereClause =
    olderFilters.length > 0 ? `where ${olderFilters.join('\n      and ')}` : '';

  return `
    ${withClause}
    select
      tx.transaction_id::text as update_id,
      tx.ix::text as update_ix,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time,
      tx.paid_traffic_cost::text as paid_traffic_cost,
      ${candidateCte ? 'candidate_progress.frontier_update_ix::text' : 'null::text'} as candidate_frontier_ix
    ${fromClause}
    ${whereClause}
    order by tx.offset desc
    limit ${queryLimit}
  `;
}

function pqsSearchUpdatesQuery(
  node: NodeConfig,
  searchQuery: string,
  limit: number,
): string {
  const relations = pqsCoreRelations(node);
  const quotedQuery = escapeSqlLiteral(searchQuery);

  return `
    select
      tx.transaction_id::text as update_id,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time
    from ${relations.transactions} tx
    where tx.offset::text like '${quotedQuery}%'
      or tx.transaction_id like '${quotedQuery}%'
    order by tx.effective_at desc nulls last, tx.offset desc
    limit ${limit}
  `;
}

function pqsRecentUpdatePartiesQuery(
  node: NodeConfig,
  updateIds: string[],
): string {
  const relations = pqsCoreRelations(node);
  const quotedIds = updateIds
    .map((updateId) => `'${escapeSqlLiteral(updateId)}'`)
    .join(', ');

  return `
    select
      update_id,
      array_agg(distinct party order by party) as parties
    from (
      select
        tx.transaction_id::text as update_id,
        unnest(contract_row.witnesses) as party
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.created_at_ix = tx.ix
      where tx.transaction_id in (${quotedIds})

      union

      select
        tx.transaction_id::text as update_id,
        unnest(contract_row.witnesses) as party
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.archived_at_ix = tx.ix
      where tx.transaction_id in (${quotedIds})

      union

      select
        tx.transaction_id::text as update_id,
        unnest(exercise_row.witnesses) as party
      from ${relations.transactions} tx
      join ${relations.exercises} exercise_row
        on exercise_row.exercised_at_ix = tx.ix
      where tx.transaction_id in (${quotedIds})
    ) update_parties
    group by update_id
  `;
}

function pqsRecentActivePartiesQuery(
  node: NodeConfig,
  windowStart: string,
): string {
  const relations = pqsCoreRelations(node);
  const quotedWindowStart = escapeSqlLiteral(windowStart);

  return `
    select
      array_agg(distinct party order by party) as parties
    from (
      select unnest(contract_row.witnesses) as party
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.created_at_ix = tx.ix
      where tx.effective_at >= '${quotedWindowStart}'::timestamptz

      union

      select unnest(contract_row.witnesses) as party
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.archived_at_ix = tx.ix
      where tx.effective_at >= '${quotedWindowStart}'::timestamptz

      union

      select unnest(exercise_row.witnesses) as party
      from ${relations.transactions} tx
      join ${relations.exercises} exercise_row
        on exercise_row.exercised_at_ix = tx.ix
      where tx.effective_at >= '${quotedWindowStart}'::timestamptz
    ) recent_parties
  `;
}

function pqsActivePartiesQuery(node: NodeConfig): string {
  const relations = pqsCoreRelations(node);

  return `
    select
      array_agg(distinct party order by party) as parties
    from (
      select unnest(contract_row.witnesses) as party
      from ${relations.contracts} contract_row

      union

      select unnest(exercise_row.witnesses) as party
      from ${relations.exercises} exercise_row
    ) observed_parties
  `;
}

function pqsPartyRecentUpdatesQuery(
  node: NodeConfig,
  partyId: string,
  limit: number,
): string {
  const relations = pqsCoreRelations(node);
  const candidateWindow = buildPqsUpdateCandidateWindow(
    node,
    limit,
    null,
    null,
  );
  const partyUpdateIxCte = buildPqsUpdateCandidateCte(node, candidateWindow, [
    partyId,
  ]);

  return `
    ${partyUpdateIxCte ? `with ${partyUpdateIxCte.sql}` : ''}
    select
      tx.transaction_id::text as update_id,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time,
      tx.paid_traffic_cost::text as paid_traffic_cost
    ${
      partyUpdateIxCte
        ? `from ${partyUpdateIxCte.name}
    join ${relations.transactions} tx
      on tx.ix = ${partyUpdateIxCte.name}.update_ix`
        : `from ${relations.transactions} tx
    where false`
    }
    order by tx.offset desc
    limit ${limit}
  `;
}

function buildPqsActiveContractsFilterClause(
  node: NodeConfig,
  parties?: string[],
  templateTypePks?: readonly bigint[],
  partyMode?: string,
  hideSplice?: boolean,
): string | null {
  const partyConditions = normalizePartyFilters(parties).map((party) =>
    partyWitnessArrayMatchCondition('contract_row.witnesses', party),
  );
  const groups: string[] = [];

  if (partyConditions.length > 0) {
    const partyJoiner =
      normalizePartyFilterMode(partyMode) === 'and'
        ? '\n      and '
        : '\n      or ';
    groups.push(
      partyConditions.length === 1
        ? partyConditions[0]
        : `(\n      ${partyConditions.join(partyJoiner)}\n    )`,
    );
  }

  if (templateTypePks !== undefined) {
    groups.push(
      templateTypePkFilterClause('contract_row.tpe_pk', templateTypePks),
    );
  }

  if (hideSplice) {
    const relations = pqsCoreRelations(node);
    groups.push(`contract_row.tpe_pk in (
      select visible_contract_tpe.pk
      from ${relations.contractTpe} visible_contract_tpe
      where visible_contract_tpe.module_name not like 'Splice.%'
        and visible_contract_tpe.entity_name is not null
    )`);
  }

  if (groups.length === 0) {
    return null;
  }

  return groups.length === 1
    ? groups[0]
    : `(\n      ${groups.join('\n      and ')}\n    )`;
}

function pqsActiveContractsQuery(
  node: NodeConfig,
  limit: number,
  before?: string,
  after?: string,
  parties?: string[],
  templateTypePks?: readonly bigint[],
  partyMode?: string,
  hideSplice?: boolean,
): string {
  const relations = pqsCoreRelations(node);
  const normalizedBefore = decodeActiveContractCursor(before);
  const normalizedAfter = decodeActiveContractCursor(after);
  const queryLimit = limit + 1;
  const useAfterCursor = Boolean(normalizedAfter && !normalizedBefore);
  const orderDirection = useAfterCursor ? 'asc' : 'desc';
  const filterClause = buildPqsActiveContractsFilterClause(
    node,
    parties,
    templateTypePks,
    partyMode,
    hideSplice,
  );
  const selectedCursor = useAfterCursor ? normalizedAfter : normalizedBefore;
  const cursorBoundary =
    selectedCursor?.kind === 'compound'
      ? `cursor_boundary as (
      select ${selectedCursor.value.createdAtIx}::bigint as cursor_ix,
        ${selectedCursor.value.createEventPk}::bigint as cursor_event_pk,
        '${escapeSqlLiteral(selectedCursor.value.contractId)}'::text as cursor_contract_id
    )`
      : useAfterCursor && normalizedAfter?.kind === 'legacy'
        ? `cursor_boundary as (
      select coalesce(
        (
          select cursor_tx.ix
          from ${relations.transactions} cursor_tx
          where cursor_tx.offset <= ${normalizedAfter.eventOffset}
          order by cursor_tx.offset desc
          limit 1
        ),
        -1::bigint
      ) as cursor_ix,
      9223372036854775807::bigint as cursor_event_pk,
      ''::text as cursor_contract_id
    )`
        : normalizedBefore?.kind === 'legacy'
          ? `cursor_boundary as (
      select coalesce(
        (
          select cursor_tx.ix
          from ${relations.transactions} cursor_tx
          where cursor_tx.offset >= ${normalizedBefore.eventOffset}
          order by cursor_tx.offset asc
          limit 1
        ),
        9223372036854775807::bigint
      ) as cursor_ix,
      -9223372036854775808::bigint as cursor_event_pk,
      ''::text as cursor_contract_id
    )`
          : null;
  const cursorFilter = useAfterCursor
    ? `(contract_row.created_at_ix, contract_row.create_event_pk, contract_row.contract_id) >
        ((select cursor_ix from cursor_boundary), (select cursor_event_pk from cursor_boundary), (select cursor_contract_id from cursor_boundary))`
    : normalizedBefore
      ? `(contract_row.created_at_ix, contract_row.create_event_pk, contract_row.contract_id) <
        ((select cursor_ix from cursor_boundary), (select cursor_event_pk from cursor_boundary), (select cursor_contract_id from cursor_boundary))`
      : null;
  const whereConditions = [
    'contract_row.archived_at_ix is null',
    'contract_row.created_at_ix is not null',
    'contract_row.create_event_pk is not null',
    cursorFilter,
    filterClause,
  ].filter((value): value is string => Boolean(value));
  const whereClause =
    whereConditions.length > 0
      ? `where ${whereConditions.join('\n      and ')}`
      : '';

  const ctes = [
    cursorBoundary,
    `active_contract_page as materialized (
      select
        contract_row.contract_id,
        contract_row.tpe_pk,
        contract_row.created_at_ix,
        contract_row.create_event_pk
      from ${relations.contracts} contract_row
      ${whereClause}
      order by contract_row.created_at_ix ${orderDirection}, contract_row.create_event_pk ${orderDirection}, contract_row.contract_id ${orderDirection}
      limit ${queryLimit}
    )`,
  ].filter((value): value is string => Boolean(value));

  return `
    with ${ctes.join(',\n')}
    select
      contract_row.contract_id::text as contract_id,
      ${contractTemplateIdentifierExpression('contract_tpe_row')} as template_id,
      ${isoUtcTimestampExpression('tx.effective_at')} as created_record_time,
      tx.offset::text as created_event_offset,
      contract_row.created_at_ix::text as created_at_ix,
      contract_row.create_event_pk::text as create_event_pk
    from active_contract_page contract_row
    join ${relations.contractTpe} contract_tpe_row
      on contract_tpe_row.pk = contract_row.tpe_pk
    join ${relations.transactions} tx
      on tx.ix = contract_row.created_at_ix
    order by contract_row.created_at_ix ${orderDirection}, contract_row.create_event_pk ${orderDirection}, contract_row.contract_id ${orderDirection}
  `;
}

function pqsSearchContractsQuery(
  node: NodeConfig,
  searchQuery: string,
  limit: number,
): string {
  const relations = pqsCoreRelations(node);
  const quotedQuery = escapeSqlLiteral(searchQuery);

  return `
    select
      contract_row.contract_id::text as contract_id,
      ${contractTemplateIdentifierExpression('contract_tpe_row')} as template_id,
      ${isoUtcTimestampExpression('tx.effective_at')} as created_record_time
    from ${relations.contracts} contract_row
    join ${relations.contractTpe} contract_tpe_row
      on contract_tpe_row.pk = contract_row.tpe_pk
    join ${relations.transactions} tx
      on tx.ix = contract_row.created_at_ix
    where contract_row.contract_id like '${quotedQuery}%'
      and contract_row.archived_at_ix is null
    order by tx.effective_at desc nulls last, contract_row.contract_id asc
    limit ${limit}
  `;
}

function pqsPartyRecentContractsQuery(
  node: NodeConfig,
  partyId: string,
  limit: number,
  before?: string,
  after?: string,
): string {
  const relations = pqsCoreRelations(node);
  const witnessMatch = partyWitnessArrayMatchCondition(
    'contract_row.witnesses',
    partyId,
  );
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const queryLimit = limit + 1;
  const sortDirection = normalizedAfter && !normalizedBefore ? 'asc' : 'desc';
  const cursorClause =
    normalizedAfter && !normalizedBefore
      ? `and tx.offset > ${normalizedAfter}`
      : normalizedBefore
        ? `and tx.offset < ${normalizedBefore}`
        : '';

  return `
    select
      contract_row.contract_id::text as contract_id,
      ${contractTemplateIdentifierExpression('contract_tpe_row')} as template_id,
      contract_row.creation_package_id::text as package_id,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time,
      tx.offset::text as created_event_offset
    from ${relations.contracts} contract_row
    join ${relations.contractTpe} contract_tpe_row
      on contract_tpe_row.pk = contract_row.tpe_pk
    join ${relations.transactions} tx
      on tx.ix = contract_row.created_at_ix
    where ${witnessMatch}
      ${cursorClause}
    order by tx.offset ${sortDirection}
    limit ${queryLimit}
  `;
}

function buildQuotedPartyIdentifiers(partyId: string): string[] {
  const trimmed = partyId.trim();

  if (!trimmed) {
    return [];
  }

  const normalized = trimmed.replace(/^p\|/, '');
  const identifiers = new Set([trimmed, normalized]);

  if (normalized) {
    identifiers.add(`p|${normalized}`);
  }

  return Array.from(identifiers).map(
    (identifier) => `'${escapeSqlLiteral(identifier)}'`,
  );
}

function partyWitnessArrayMatchCondition(
  arrayExpression: string,
  partyId: string,
): string {
  const quotedIdentifiers = buildQuotedPartyIdentifiers(partyId);

  if (quotedIdentifiers.length === 0) {
    return 'false';
  }

  return `array[${quotedIdentifiers.join(', ')}]::text[] && ${arrayExpression}::text[]`;
}

function singleUpdateQuery(node: NodeConfig, eventOffset: string): string {
  const relations = pqsCoreRelations(node);
  const normalizedOffset = requireEventOffsetLiteral(eventOffset);

  return `
    select
      tx.transaction_id::text as update_id,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time_iso,
      tx.paid_traffic_cost::text as paid_traffic_cost,
      jsonb_build_object(
        'update_id', tx.transaction_id::text,
        'event_offset', tx.offset::text,
        'record_time', ${isoUtcTimestampExpression('tx.effective_at')}
      ) as meta
    from ${relations.transactions} tx
    where tx.offset = ${normalizedOffset}
    order by tx.offset desc
    limit 1
  `;
}

function singleUpdateByIdQuery(node: NodeConfig, updateId: string): string {
  const relations = pqsCoreRelations(node);
  const quotedUpdateId = `'${escapeSqlLiteral(updateId)}'`;

  return `
    select
      tx.transaction_id::text as update_id,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time_iso,
      tx.paid_traffic_cost::text as paid_traffic_cost,
      jsonb_build_object(
        'update_id', tx.transaction_id::text,
        'event_offset', tx.offset::text,
        'record_time', ${isoUtcTimestampExpression('tx.effective_at')}
      ) as meta
    from ${relations.transactions} tx
    where tx.transaction_id::text = ${quotedUpdateId}
    order by tx.offset desc
    limit 1
  `;
}

function pqsTrafficPurchasesQuery(
  node: NodeConfig,
  limit: number,
  before?: string,
  after?: string,
  filters: TrafficPurchaseQueryFilters = {},
  fetchAllMatchingRows = false,
): string {
  const relations = pqsCoreRelations(node);
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const normalizedMinDate = normalizeTrafficDateFilter(filters.minDate);
  const normalizedMaxDate = normalizeTrafficDateFilter(filters.maxDate);
  const useAfterCursor = Boolean(normalizedAfter && !normalizedBefore);
  const cursorClause = useAfterCursor
    ? `and tx.offset > ${normalizedAfter}`
    : normalizedBefore
      ? `and tx.offset < ${normalizedBefore}`
      : '';
  const orderClause = useAfterCursor ? 'asc' : 'desc';
  const filterClauses = [
    normalizedMinDate
      ? `tx.effective_at >= '${normalizedMinDate}'::date`
      : null,
    normalizedMaxDate
      ? `tx.effective_at < ('${normalizedMaxDate}'::date + interval '1 day')`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => `and ${value}`)
    .join('\n      ');

  return `
    select
      tx.transaction_id::text as update_id,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time,
      package_row.id::text as package_id,
      ${contractTemplateIdentifierExpression('contract_tpe_row')} as template_id,
      exercise_tpe_row.choice::text as choice,
      exercise_row.argument as exercise_argument,
      exercise_row.result as exercise_result
    from ${relations.exercises} exercise_row
    join ${relations.exerciseTpe} exercise_tpe_row
      on exercise_tpe_row.pk = exercise_row.tpe_pk
    join ${relations.contractTpe} contract_tpe_row
      on contract_tpe_row.pk = exercise_row.contract_tpe_pk
    join ${relations.transactions} tx
      on tx.ix = exercise_row.exercised_at_ix
    left join ${relations.packages} package_row
      on package_row.pk = exercise_row.package_pk
    where contract_tpe_row.module_name = 'Splice.AmuletRules'
      and contract_tpe_row.entity_name = 'AmuletRules'
      and exercise_tpe_row.choice::text like '%AmuletRules_BuyMemberTraffic'
      ${cursorClause}
    ${filterClauses}
    order by tx.offset ${orderClause}
    ${fetchAllMatchingRows ? '' : `limit ${limit + 1}`}
  `;
}

function normalizeTrafficDateFilter(value?: string): string | null {
  const normalized = value?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function normalizeTrafficNumericFilter(value?: string): string | null {
  const normalized = value?.trim() ?? '';
  return /^\d+(?:\.\d+)?$/.test(normalized) ? normalized : null;
}

function compareNonNegativeDecimalValues(left: string, right: string): number {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  const normalizedLeftInteger = leftInteger.replace(/^0+(?=\d)/, '');
  const normalizedRightInteger = rightInteger.replace(/^0+(?=\d)/, '');

  if (normalizedLeftInteger.length !== normalizedRightInteger.length) {
    return normalizedLeftInteger.length > normalizedRightInteger.length
      ? 1
      : -1;
  }
  if (normalizedLeftInteger !== normalizedRightInteger) {
    return normalizedLeftInteger > normalizedRightInteger ? 1 : -1;
  }

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const normalizedLeftFraction = leftFraction.padEnd(fractionLength, '0');
  const normalizedRightFraction = rightFraction.padEnd(fractionLength, '0');
  if (normalizedLeftFraction === normalizedRightFraction) {
    return 0;
  }

  return normalizedLeftFraction > normalizedRightFraction ? 1 : -1;
}

function matchesTrafficPurchaseAmountFilters(
  purchase: NodeTrafficPurchase,
  filters: TrafficPurchaseQueryFilters,
): boolean {
  const purchasedMin = normalizeTrafficNumericFilter(filters.purchasedMin);
  const purchasedMax = normalizeTrafficNumericFilter(filters.purchasedMax);
  const paidMin = normalizeTrafficNumericFilter(filters.paidMin);
  const paidMax = normalizeTrafficNumericFilter(filters.paidMax);

  if ((purchasedMin || purchasedMax) && !purchase.purchasedTraffic) {
    return false;
  }
  if ((paidMin || paidMax) && !purchase.amuletPaid) {
    return false;
  }

  if (
    purchasedMin &&
    compareNonNegativeDecimalValues(purchase.purchasedTraffic!, purchasedMin) <
      0
  ) {
    return false;
  }
  if (
    purchasedMax &&
    compareNonNegativeDecimalValues(purchase.purchasedTraffic!, purchasedMax) >
      0
  ) {
    return false;
  }
  if (
    paidMin &&
    compareNonNegativeDecimalValues(purchase.amuletPaid!, paidMin) < 0
  ) {
    return false;
  }
  if (
    paidMax &&
    compareNonNegativeDecimalValues(purchase.amuletPaid!, paidMax) > 0
  ) {
    return false;
  }

  return true;
}

function updateEventsByUpdateIdsQuery(
  node: NodeConfig,
  updateIds: string[],
): string {
  const relations = pqsCoreRelations(node);
  const quotedIds = updateIds
    .map((updateId) => `'${escapeSqlLiteral(updateId)}'`)
    .join(', ');
  const contractTemplateId =
    contractTemplateIdentifierExpression('contract_tpe_row');
  const exerciseTemplateId = contractTemplateIdentifierExpression(
    'exercise_contract_tpe_row',
  );

  return `
    select
      update_id,
      event_kind,
      event_id,
      contract_id,
      template_id,
      package_id,
      choice,
      witnesses,
      contract_instance,
      exercise_argument,
      exercise_result,
      raw
    from (
      select
        tx.transaction_id::text as update_id,
        'create'::text as event_kind,
        event_row.event_id::text as event_id,
        contract_row.contract_id::text as contract_id,
        ${contractTemplateId} as template_id,
        coalesce(contract_row.creation_package_id, package_row.id)::text as package_id,
        null::text as choice,
        contract_row.witnesses as witnesses,
        contract_row.payload as contract_instance,
        null::jsonb as exercise_argument,
        null::jsonb as exercise_result,
        jsonb_build_object(
          'source_table', '__contracts',
          'transaction_id', tx.transaction_id::text,
          'event_offset', tx.offset::text,
          'event_id', event_row.event_id,
          'contract_id', contract_row.contract_id,
          'template_id', ${contractTemplateId}
        ) as raw
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.created_at_ix = tx.ix
      left join ${relations.events} event_row
        on event_row.pk = contract_row.create_event_pk
      left join ${relations.contractTpe} contract_tpe_row
        on contract_tpe_row.pk = contract_row.tpe_pk
      left join ${relations.packages} package_row
        on package_row.pk = contract_row.package_pk
      where tx.transaction_id in (${quotedIds})

      union all

      select
        tx.transaction_id::text as update_id,
        case
          when exercise_tpe_row.consuming then 'consuming_exercise'::text
          else 'non_consuming_exercise'::text
        end as event_kind,
        event_row.event_id::text as event_id,
        exercise_row.contract_id::text as contract_id,
        ${exerciseTemplateId} as template_id,
        package_row.id::text as package_id,
        exercise_tpe_row.choice::text as choice,
        exercise_row.witnesses as witnesses,
        null::jsonb as contract_instance,
        exercise_row.argument as exercise_argument,
        exercise_row.result as exercise_result,
        jsonb_build_object(
          'source_table', '__exercises',
          'transaction_id', tx.transaction_id::text,
          'event_offset', tx.offset::text,
          'event_id', event_row.event_id,
          'contract_id', exercise_row.contract_id,
          'template_id', ${exerciseTemplateId},
          'choice', exercise_tpe_row.choice
        ) as raw
      from ${relations.transactions} tx
      join ${relations.exercises} exercise_row
        on exercise_row.exercised_at_ix = tx.ix
      left join ${relations.events} event_row
        on event_row.pk = exercise_row.exercise_event_pk
      left join ${relations.contractTpe} exercise_contract_tpe_row
        on exercise_contract_tpe_row.pk = exercise_row.contract_tpe_pk
      left join ${relations.exerciseTpe} exercise_tpe_row
        on exercise_tpe_row.pk = exercise_row.tpe_pk
      left join ${relations.packages} package_row
        on package_row.pk = exercise_row.package_pk
      where tx.transaction_id in (${quotedIds})
    ) update_events
    order by update_id asc nulls last, event_id asc nulls last, event_kind asc, contract_id asc, template_id asc
  `;
}

function updateEventsQuery(node: NodeConfig, updateId: string): string {
  return updateEventsByUpdateIdsQuery(node, [updateId]);
}

function rewardCouponInstanceQuery(node: NodeConfig, updateId: string): string {
  const relations = pqsCoreRelations(node);
  const quotedId = `'${escapeSqlLiteral(normalizeByteaHex(updateId))}'`;
  const contractTemplateId =
    contractTemplateIdentifierExpression('contract_tpe_row');

  return `
    select
      coupon_contract_id,
      contract_instance
    from (
      select
        contract_row.contract_id::text as coupon_contract_id,
        contract_row.payload as contract_instance,
        coalesce(contract_row.create_event_pk, 0) as sort_event_pk
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.created_at_ix = tx.ix
      join ${relations.contractTpe} contract_tpe_row
        on contract_tpe_row.pk = contract_row.tpe_pk
      where tx.transaction_id = ${quotedId}
        and ${contractTemplateId} = 'Splice.Amulet:SvRewardCoupon'
    ) reward_coupon_events
    order by sort_event_pk desc
    limit 1
  `;
}

function contractDetailsQuery(node: NodeConfig, contractIds: string[]): string {
  const relations = pqsCoreRelations(node);
  const quotedIds = contractIds
    .map((contractId) => `'${escapeSqlLiteral(normalizeByteaHex(contractId))}'`)
    .join(', ');
  const contractTemplateId =
    contractTemplateIdentifierExpression('contract_tpe_row');

  return `
    with selected_contract as (
      select
        contract_row.contract_id::text as contract_id,
        ${contractTemplateId} as template_id,
        coalesce(contract_row.creation_package_id, package_row.id)::text as package_id,
        contract_row.payload as contract_instance,
        contract_row.created_at_ix,
        contract_row.archived_at_ix
      from ${relations.contracts} contract_row
      left join ${relations.contractTpe} contract_tpe_row
        on contract_tpe_row.pk = contract_row.tpe_pk
      left join ${relations.packages} package_row
        on package_row.pk = contract_row.package_pk
      where contract_row.contract_id in (${quotedIds})
    )
    select
      contract_row.contract_id,
      contract_row.template_id,
      contract_row.package_id,
      contract_row.contract_instance,
      created_tx.transaction_id::text as created_update_id,
      created_tx.offset::text as created_event_offset,
      ${isoUtcTimestampExpression('created_tx.effective_at')} as created_record_time,
      archived_tx.transaction_id::text as archived_update_id,
      archived_tx.offset::text as archived_event_offset,
      ${isoUtcTimestampExpression('archived_tx.effective_at')} as archived_record_time
    from selected_contract contract_row
    left join ${relations.transactions} created_tx
      on created_tx.ix = contract_row.created_at_ix
    left join ${relations.transactions} archived_tx
      on archived_tx.ix = contract_row.archived_at_ix
  `;
}

function contractDetailQuery(node: NodeConfig, contractId: string): string {
  return contractDetailsQuery(node, [contractId]);
}

function tokenRowsQuery(
  node: NodeConfig,
  limit: number,
  templateTypePks: readonly number[],
): string {
  const relations = pqsCoreRelations(node);
  const normalizedLimit =
    Number.isFinite(limit) && Number(limit) > 0
      ? Math.trunc(limit)
      : TOKEN_TRANSFER_CACHE_LIMIT;
  const normalizedTemplateTypePks = templateTypePks.filter(
    (pk) => Number.isSafeInteger(pk) && pk > 0,
  );
  const contractTemplateId =
    contractTemplateIdentifierExpression('contract_tpe_row');
  const templateFilterClause = normalizedTemplateTypePks.length
    ? `contract_row.tpe_pk in (${normalizedTemplateTypePks.join(', ')})`
    : 'false';

  return `
    select
      contract_id,
      update_id,
      event_offset,
      record_time,
      template_id,
      package_id,
      contract_instance
    from (
      select
        contract_row.contract_id::text as contract_id,
        tx.transaction_id::text as update_id,
        tx.offset::text as event_offset,
        ${isoUtcTimestampExpression('tx.effective_at')} as record_time,
        ${contractTemplateId} as template_id,
        coalesce(contract_row.creation_package_id, package_row.id)::text as package_id,
        contract_row.payload as contract_instance
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.created_at_ix = tx.ix
      join ${relations.contractTpe} contract_tpe_row
        on contract_tpe_row.pk = contract_row.tpe_pk
      left join ${relations.packages} package_row
        on package_row.pk = contract_row.package_pk
      where ${templateFilterClause}
    ) token_transfer_rows
    order by event_offset::numeric desc
    limit ${normalizedLimit}
  `;
}

function templateTypePksQuery(
  node: NodeConfig,
  templateIds: readonly string[],
): string {
  const relations = pqsCoreRelations(node);
  const normalizedTemplateIds = normalizeTemplateFilters([...templateIds]);
  const clausesFor = (alias: string) => normalizedTemplateIds.flatMap(
    (templateId) => {
      const separatorIndex = templateId.lastIndexOf(':');
      if (separatorIndex <= 0 || separatorIndex === templateId.length - 1) {
        return [];
      }

      const moduleName = templateId.slice(0, separatorIndex);
      const entityName = templateId.slice(separatorIndex + 1);
      return [
        `(${alias}.module_name = '${escapeSqlLiteral(moduleName)}'
        and ${alias}.entity_name = '${escapeSqlLiteral(entityName)}')`,
      ];
    },
  );
  const contractClauses = clausesFor('contract_tpe_row');
  const exerciseClauses = clausesFor('exercise_tpe_row');

  return `
    select 'contract'::text as type_source, contract_tpe_row.pk::text as pk
    from ${relations.contractTpe} contract_tpe_row
    where ${contractClauses.length > 0 ? contractClauses.join('\n      or ') : 'false'}

    union all

    select 'exercise'::text as type_source, exercise_tpe_row.pk::text as pk
    from ${relations.exerciseTpe} exercise_tpe_row
    where ${exerciseClauses.length > 0 ? exerciseClauses.join('\n      or ') : 'false'}
    order by type_source, pk
  `;
}

function tokenTemplateTypesQuery(node: NodeConfig): string {
  const relations = pqsCoreRelations(node);
  const exactTemplateClauses = TOKEN_DISCOVERY_TEMPLATE_IDS.map(
    (templateId) => {
      const separatorIndex = templateId.lastIndexOf(':');
      const moduleName = templateId.slice(0, separatorIndex);
      const entityName = templateId.slice(separatorIndex + 1);

      return `(contract_tpe_row.module_name = '${escapeSqlLiteral(moduleName)}'
        and contract_tpe_row.entity_name = '${escapeSqlLiteral(entityName)}')`;
    },
  ).join('\n      or ');

  return `
    select
      contract_tpe_row.pk::text as pk,
      contract_tpe_row.module_name::text as module_name,
      contract_tpe_row.entity_name::text as entity_name
    from ${relations.contractTpe} contract_tpe_row
    where ${exactTemplateClauses}
      or (
        contract_tpe_row.module_name like '%.CIP112'
        and contract_tpe_row.entity_name is not null
      )
  `;
}

function nativeAmuletSupportQuery(node: NodeConfig): string {
  const relations = pqsCoreRelations(node);
  const templateIds = NATIVE_AMULET_SUPPORT_TEMPLATE_IDS.map(
    (templateId) => `'${escapeSqlLiteral(templateId)}'`,
  ).join(',\n        ');
  const templateId = contractTemplateIdentifierExpression('contract_tpe_row');

  return `
    select ${templateId} as template_id
    from ${relations.contractTpe} contract_tpe_row
    where ${templateId} in (
        ${templateIds}
      )
    limit 1
  `;
}

function recentCip112MovementUpdateIdsQuery(
  node: NodeConfig,
  limit: number,
): string {
  const relations = pqsCoreRelations(node);
  const normalizedLimit =
    Number.isFinite(limit) && Number(limit) > 0
      ? Math.trunc(limit)
      : TOKEN_TRANSFER_CACHE_LIMIT;
  const contractTemplateId =
    contractTemplateIdentifierExpression('contract_tpe_row');
  const exerciseTemplateId = contractTemplateIdentifierExpression(
    'exercise_contract_tpe_row',
  );

  return `
    /* cip112_movement_update_ids */
    with relevant_updates as (
    select
      tx.transaction_id::text as update_id,
      tx.offset::text as event_offset,
      ${isoUtcTimestampExpression('tx.effective_at')} as record_time
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.created_at_ix = tx.ix
      join ${relations.contractTpe} contract_tpe_row
        on contract_tpe_row.pk = contract_row.tpe_pk
      where ${contractTemplateId} like '${escapeSqlLiteral(CIP112_TEMPLATE_ID_LIKE_PATTERN)}'

      union all

      select
        tx.transaction_id::text as update_id,
        tx.offset::text as event_offset,
        ${isoUtcTimestampExpression('tx.effective_at')} as record_time
      from ${relations.transactions} tx
      join ${relations.contracts} contract_row
        on contract_row.archived_at_ix = tx.ix
      join ${relations.contractTpe} contract_tpe_row
        on contract_tpe_row.pk = contract_row.tpe_pk
      where ${contractTemplateId} like '${escapeSqlLiteral(CIP112_TEMPLATE_ID_LIKE_PATTERN)}'

      union all

      select
        tx.transaction_id::text as update_id,
        tx.offset::text as event_offset,
        ${isoUtcTimestampExpression('tx.effective_at')} as record_time
      from ${relations.transactions} tx
      join ${relations.exercises} exercise_row
        on exercise_row.exercised_at_ix = tx.ix
      join ${relations.contractTpe} exercise_contract_tpe_row
        on exercise_contract_tpe_row.pk = exercise_row.contract_tpe_pk
      where ${exerciseTemplateId} like '${escapeSqlLiteral(CIP112_TEMPLATE_ID_LIKE_PATTERN)}'
    )
    select
      update_id,
      max(event_offset::numeric)::text as event_offset,
      max(record_time) as record_time
    from relevant_updates
    group by update_id
    order by max(event_offset::numeric) desc
    limit ${normalizedLimit}
  `;
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function normalizeEventOffsetCursor(value?: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/^0+(?=\d)/, '');
}

function normalizeActiveContractCursorPart(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = normalizeEventOffsetCursor(String(value));
  if (
    normalized === null ||
    BigInt(normalized) > 9223372036854775807n
  ) {
    return null;
  }
  return normalized;
}

function normalizeActiveContractIdCursorPart(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function encodeActiveContractCursor(row: ActiveContractRow): string | null {
  const eventOffset = normalizeActiveContractCursorPart(
    row.created_event_offset,
  );
  if (eventOffset === null) {
    return null;
  }

  const createdAtIx = normalizeActiveContractCursorPart(row.created_at_ix);
  const createEventPk = normalizeActiveContractCursorPart(row.create_event_pk);
  const contractId = normalizeActiveContractIdCursorPart(row.contract_id);
  if (createdAtIx === null || createEventPk === null || contractId === null) {
    // Compatibility for older PQS-shaped test doubles and pre-compound API
    // cursors. Real supported PQS schemas always return both event keys.
    return eventOffset;
  }

  return `acs1.${Buffer.from(
    JSON.stringify({
      eventOffset,
      createdAtIx,
      createEventPk,
      contractId,
    } satisfies ActiveContractCursor),
    'utf8',
  ).toString('base64url')}`;
}

function decodeActiveContractCursor(
  cursor?: string,
): DecodedActiveContractCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  if (cursor.startsWith('acs1.')) {
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor.slice('acs1.'.length), 'base64url').toString('utf8'),
      ) as Partial<ActiveContractCursor>;
      const eventOffset = normalizeActiveContractCursorPart(
        decoded.eventOffset,
      );
      const createdAtIx = normalizeActiveContractCursorPart(
        decoded.createdAtIx,
      );
      const createEventPk = normalizeActiveContractCursorPart(
        decoded.createEventPk,
      );
      const contractId = normalizeActiveContractIdCursorPart(decoded.contractId);
      if (eventOffset && createdAtIx && createEventPk && contractId) {
        return {
          kind: 'compound',
          value: { eventOffset, createdAtIx, createEventPk, contractId },
        };
      }
      if (eventOffset) {
        return { kind: 'legacy', eventOffset };
      }
    } catch {
      return null;
    }
    return null;
  }

  const eventOffset = normalizeEventOffsetCursor(cursor);
  return eventOffset ? { kind: 'legacy', eventOffset } : null;
}

function requireEventOffsetLiteral(value: string): string {
  const normalizedOffset = normalizeEventOffsetCursor(value);
  if (
    normalizedOffset === null ||
    BigInt(normalizedOffset) > 9223372036854775807n
  ) {
    throw new Error('Invalid event offset');
  }

  return normalizedOffset;
}

function utcCacheDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function normalizeByteaHex(value: string): string {
  return value.startsWith('\\x') ? value.slice(2) : value;
}

@Injectable()
export class PqsSummaryService {
  private readonly observedTokensByNode = new Map<
    string,
    CachedNodeObservedTokens
  >();
  private readonly tokenTemplateTypesByNode = new Map<
    string,
    CachedNodeTokenTemplateTypes
  >();
  private readonly grpcObservedTokensByNode = new Map<
    string,
    CachedNodeObservedTokens
  >();
  private readonly grpcObservedTokenRefreshesByNode = new Map<
    string,
    Promise<TokenSummary[]>
  >();
  private readonly tokenHoldersByNode = new Map<
    string,
    CachedNodeTokenHolders
  >();
  private readonly tokenTransfersByNode = new Map<
    string,
    CachedNodeTokenTransfers
  >();
  private readonly latestTrafficPurchaseRefreshes = new Map<
    string,
    Promise<NodeTrafficPurchase | null>
  >();

  constructor(
    private readonly managerFactory: PqsManagerFactory,
    @Optional() private readonly damlValueDecoder?: DamlValueDecoderService,
    @Optional() private readonly packageCacheService?: PackageCacheService,
    @Optional()
    private readonly packageRegistryService?: PackageRegistryService,
    @Optional() private readonly nodeConfigService?: NodeConfigService,
    @Optional() private readonly grpcOperationsService?: GrpcOperationsService,
    @Optional() private readonly packageSyncService?: PackageSyncService,
    @Optional()
    private readonly trafficCostEstimateService?: TrafficCostEstimateService,
  ) {}

  async fetchSummary(node: NodeConfig): Promise<LedgerSummary> {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query<SummaryRow>(summaryQuery(node));
    const row = result.rows[0] ?? this.defaultRow();

    return {
      ledgerLabel: node.ledgerLabel ?? node.label,
      pqsDatabase: row.pqs_database,
      activeContractCount: Number(row.active_contract_count ?? 0),
      latestOffset: row.latest_offset ?? null,
      latestEventAt: row.latest_event_at ?? null,
      totalUpdateCount: Number(row.total_update_count ?? 0),
    };
  }

  async fetchTrafficPurchases(
    node: NodeConfig,
    options: {
      limit?: number;
      before?: string;
      after?: string;
      minDate?: string;
      maxDate?: string;
      purchasedMin?: string;
      purchasedMax?: string;
      paidMin?: string;
      paidMax?: string;
    } = {},
  ): Promise<NodeTrafficPurchasesResponse> {
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const client = await this.managerFactory.getRawExecutor(node);
    const useAfterCursor = Boolean(options.after && !options.before);
    const normalizedFilters: TrafficPurchaseQueryFilters = {
      minDate: normalizeTrafficDateFilter(options.minDate) ?? undefined,
      maxDate: normalizeTrafficDateFilter(options.maxDate) ?? undefined,
      purchasedMin:
        normalizeTrafficNumericFilter(options.purchasedMin) ?? undefined,
      purchasedMax:
        normalizeTrafficNumericFilter(options.purchasedMax) ?? undefined,
      paidMin: normalizeTrafficNumericFilter(options.paidMin) ?? undefined,
      paidMax: normalizeTrafficNumericFilter(options.paidMax) ?? undefined,
    };
    const hasAmountFilters = Boolean(
      normalizedFilters.purchasedMin ||
      normalizedFilters.purchasedMax ||
      normalizedFilters.paidMin ||
      normalizedFilters.paidMax,
    );
    const result = await client.query(
      pqsTrafficPurchasesQuery(
        node,
        limit,
        options.before,
        options.after,
        normalizedFilters,
        hasAmountFilters,
      ),
    );
    const rows = (result.rows as TrafficPurchaseRow[]) ?? [];
    const decodedPurchases = await Promise.all(
      rows.map(async (row) => {
        const decoded = await this.decodeExerciseData(node, {
          packageId: this.normalizePackageIdentifier(row.package_id ?? null),
          templateId: this.normalizeTemplateIdentifier(row.template_id ?? null),
          rawChoice: row.choice ?? null,
          exerciseArgument: row.exercise_argument ?? null,
          exerciseResult: row.exercise_result ?? null,
        });

        return {
          updateId: row.update_id,
          eventOffset: String(row.event_offset),
          recordTime: row.record_time ?? null,
          purchasedTraffic: this.readTrafficPurchaseField(
            decoded,
            'trafficAmount',
            'argument',
          ),
          amuletPaid: this.readTrafficPurchaseField(decoded, 'amuletPaid'),
        };
      }),
    );
    const matchingPurchases = hasAmountFilters
      ? decodedPurchases.filter((purchase) =>
          matchesTrafficPurchaseAmountFilters(purchase, normalizedFilters),
        )
      : decodedPurchases;
    const hasMoreInQuery = matchingPurchases.length > limit;
    const pagePurchases = matchingPurchases.slice(0, limit);
    const purchases = useAfterCursor
      ? [...pagePurchases].reverse()
      : pagePurchases;

    return {
      nodeId: node.id,
      label: node.label,
      limit,
      nextBefore:
        (useAfterCursor || hasMoreInQuery) && purchases.length > 0
          ? (purchases[purchases.length - 1]?.eventOffset ?? null)
          : null,
      nextAfter: useAfterCursor
        ? hasMoreInQuery
          ? (purchases[0]?.eventOffset ?? null)
          : null
        : options.before && purchases.length > 0
          ? (purchases[0]?.eventOffset ?? null)
          : null,
      purchases,
    };
  }

  async fetchGlobalTrafficPurchases(
    nodes: NodeConfig[],
    limit = 30,
    options: {
      before?: string;
      after?: string;
      nodeIds?: string[];
      minDate?: string;
      maxDate?: string;
      purchasedMin?: string;
      purchasedMax?: string;
      paidMin?: string;
      paidMax?: string;
    } = {},
  ): Promise<GlobalTrafficPurchasesResponse> {
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : 30;
    const beforeCursor = decodeGlobalTrafficCursor(options.before);
    const afterCursor =
      beforeCursor === null ? decodeGlobalTrafficCursor(options.after) : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const selectedNodeIds = options.nodeIds;
    const eligibleNodes =
      selectedNodeIds === undefined
        ? nodes
        : nodes.filter((node) => selectedNodeIds.includes(node.id));
    const emptyResponse = (): GlobalTrafficPurchasesResponse => ({
      limit: normalizedLimit,
      nextBefore: null,
      nextAfter: null,
      purchases: [],
      current: [],
      historyStatus: [],
    });

    if (eligibleNodes.length === 0) {
      return emptyResponse();
    }

    const pageSize = Math.max(normalizedLimit * 2, normalizedLimit + 1);
    const nodeStates = eligibleNodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      exhausted: false,
    }));
    const historyStatus = new Map<string, GlobalTrafficHistoryStatus>();
    const mergedPurchasesByKey = new Map<string, GlobalTrafficPurchase>();
    const filterPurchases = (
      purchases: GlobalTrafficPurchase[],
    ): GlobalTrafficPurchase[] =>
      purchases.filter((purchase) => {
        if (
          beforeCursor !== null &&
          compareGlobalTrafficPurchases(purchase, beforeCursor) <= 0
        ) {
          return false;
        }
        if (
          afterCursor !== null &&
          compareGlobalTrafficPurchases(purchase, afterCursor) >= 0
        ) {
          return false;
        }
        return true;
      });

    let filteredPurchases: GlobalTrafficPurchase[] = [];
    let hasMoreInDirection = false;

    while (true) {
      const nodesToFetch = nodeStates.filter((state) => !state.exhausted);
      if (nodesToFetch.length === 0) {
        break;
      }

      const settled = await Promise.allSettled(
        nodesToFetch.map((state) =>
          this.fetchTrafficPurchases(state.node, {
            limit: pageSize,
            before: state.nextBefore,
            minDate: options.minDate,
            maxDate: options.maxDate,
            purchasedMin: options.purchasedMin,
            purchasedMax: options.purchasedMax,
            paidMin: options.paidMin,
            paidMax: options.paidMax,
          }),
        ),
      );

      settled.forEach((result, index) => {
        const state = nodesToFetch[index];
        if (!state) {
          return;
        }

        if (result.status === 'rejected') {
          state.exhausted = true;
          historyStatus.set(state.node.id, {
            nodeId: state.node.id,
            label: state.node.label,
            status: 'pqs_error',
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown PQS error',
          });
          return;
        }

        historyStatus.set(state.node.id, {
          nodeId: state.node.id,
          label: state.node.label,
          status: 'ok',
          error: null,
        });
        for (const purchase of result.value.purchases) {
          mergedPurchasesByKey.set(`${state.node.id}:${purchase.updateId}`, {
            ...purchase,
            nodeId: state.node.id,
            label: state.node.label,
          });
        }
        state.nextBefore = result.value.nextBefore ?? undefined;
        state.exhausted = result.value.nextBefore === null;
      });

      const sortedPurchases = Array.from(mergedPurchasesByKey.values()).sort(
        compareGlobalTrafficPurchases,
      );
      filteredPurchases = filterPurchases(sortedPurchases);
      hasMoreInDirection = filteredPurchases.length > normalizedLimit;

      if (hasMoreInDirection || nodeStates.every((state) => state.exhausted)) {
        break;
      }
    }

    const purchases = filteredPurchases.slice(0, normalizedLimit);
    const current: GlobalTrafficCurrentEntry[] = await Promise.all(
      eligibleNodes.map(async (node) => {
        if (node.mode !== 'pqs_with_grpc' || !this.grpcOperationsService) {
          return {
            nodeId: node.id,
            label: node.label,
            mode: node.mode,
            status: 'grpc_not_configured' as const,
            states: [],
            error: null,
          };
        }

        try {
          return {
            nodeId: node.id,
            label: node.label,
            mode: node.mode,
            status: 'ok' as const,
            states: await this.grpcOperationsService.fetchTrafficStates(node),
            error: null,
          };
        } catch (error) {
          return {
            nodeId: node.id,
            label: node.label,
            mode: node.mode,
            status: 'grpc_error' as const,
            states: [],
            error:
              error instanceof Error ? error.message : 'Unknown gRPC error',
          };
        }
      }),
    );

    return {
      limit: normalizedLimit,
      nextBefore:
        purchases.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalTrafficCursor(purchases[purchases.length - 1])
          : null,
      nextAfter:
        purchases.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalTrafficCursor(purchases[0])
              : null
            : beforeCursor
              ? encodeGlobalTrafficCursor(purchases[0])
              : null,
      purchases,
      current,
      historyStatus: eligibleNodes.map(
        (node) =>
          historyStatus.get(node.id) ?? {
            nodeId: node.id,
            label: node.label,
            status: 'pqs_error' as const,
            error: 'No PQS response',
          },
      ),
    };
  }

  async search(query: string): Promise<SearchResultsResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        query: '',
        updates: this.emptySearchGroup<SearchUpdateResult>(),
        contracts: this.emptySearchGroup<SearchContractResult>(),
        parties: this.emptySearchGroup<SearchPartyResult>(),
        packages: {
          packageIds: this.emptySearchGroup<SearchPackageIdResult>(),
          packageNames: this.emptySearchGroup<SearchPackageNameResult>(),
        },
      };
    }

    const nodes = this.nodeConfigService?.list() ?? [];
    const updates = await this.searchUpdates(nodes, trimmedQuery);
    const contracts = await this.searchContracts(nodes, trimmedQuery);
    const parties = await this.searchParties(nodes, trimmedQuery);
    const packages = await this.searchPackages(trimmedQuery);

    return {
      query: trimmedQuery,
      updates,
      contracts,
      parties,
      packages,
    };
  }

  private async latestTrafficPurchase(
    node: NodeConfig,
  ): Promise<NodeTrafficPurchase | null> {
    if (!this.trafficCostEstimateService) {
      return null;
    }

    const packageCacheService = this.packageCacheService;
    if (!packageCacheService) {
      try {
        const response = await this.fetchTrafficPurchases(node, { limit: 1 });
        return response.purchases[0] ?? null;
      } catch {
        return null;
      }
    }

    const cacheDay = utcCacheDay();
    const cachedPurchase = packageCacheService.getNodeTrafficPurchase(
      node.id,
      cacheDay,
    );
    if (cachedPurchase) {
      return cachedPurchase.purchase;
    }

    const refreshKey = `${node.id}:${cacheDay}`;
    const existingRefresh = this.latestTrafficPurchaseRefreshes.get(refreshKey);
    if (existingRefresh) {
      return existingRefresh;
    }

    const refresh = this.fetchTrafficPurchases(node, { limit: 1 })
      .then((response) => {
        const purchase = response.purchases[0] ?? null;
        packageCacheService.storeNodeTrafficPurchase({
          nodeId: node.id,
          cacheDay,
          purchase,
          cachedAt: new Date().toISOString(),
        });
        return purchase;
      })
      .catch(() => {
        return null;
      });
    this.latestTrafficPurchaseRefreshes.set(refreshKey, refresh);
    void refresh.finally(() => {
      if (this.latestTrafficPurchaseRefreshes.get(refreshKey) === refresh) {
        this.latestTrafficPurchaseRefreshes.delete(refreshKey);
      }
    });

    return refresh;
  }

  private async estimateTraffic(
    paidTrafficCost: string | null | undefined,
    purchase: NodeTrafficPurchase | null,
  ): Promise<TrafficCostEstimate | null> {
    if (!this.trafficCostEstimateService || !purchase) {
      return null;
    }

    try {
      const estimateDetails = this.trafficCostEstimateService.estimateDetails;
      if (typeof estimateDetails === 'function') {
        return await estimateDetails.call(
          this.trafficCostEstimateService,
          paidTrafficCost,
          purchase,
        );
      }

      const usd = await this.trafficCostEstimateService.estimate(
        paidTrafficCost,
        purchase,
      );
      return usd ? { usd, gapDays: null } : null;
    } catch {
      return null;
    }
  }

  async fetchRecentUpdates(
    node: NodeConfig,
    options:
      | number
      | {
          limit?: number;
          before?: string;
          after?: string;
          parties?: string[];
          templates?: string[];
          partyMode?: string;
          mode?: string;
          hideSplice?: boolean;
        } = 30,
  ): Promise<NodeRecentUpdatesResponse> {
    const client = await this.managerFactory.getRawExecutor(node);
    const normalizedLimit =
      typeof options === 'number'
        ? Number.isFinite(options) && options > 0
          ? Math.trunc(options)
          : 30
        : Number.isFinite(options.limit) && Number(options.limit) > 0
          ? Math.trunc(Number(options.limit))
          : 30;
    const before = typeof options === 'object' ? options.before : undefined;
    const after = typeof options === 'object' ? options.after : undefined;
    const parties = typeof options === 'object' ? options.parties : undefined;
    const templates =
      typeof options === 'object' ? options.templates : undefined;
    const partyMode =
      typeof options === 'object'
        ? (options.partyMode ?? options.mode)
        : undefined;
    const hideSplice =
      typeof options === 'object' ? options.hideSplice === true : false;
    const useAfterCursor = Boolean(after && !before);
    const query = client.query.bind(client);
    const normalizedTemplates = normalizeTemplateFilters(templates);
    const templateTypePks =
      normalizedTemplates.length > 0
        ? await this.resolveTemplateTypePks(node, query, normalizedTemplates)
        : undefined;
    const rawMetaRows = await this.queryRecentUpdateMetaRows(
      node,
      query,
      normalizedLimit,
      before,
      after,
      parties,
      templateTypePks,
      partyMode,
      hideSplice,
    );
    const hasMoreInQuery = rawMetaRows.length > normalizedLimit;
    const trimmedMetaRows = rawMetaRows.slice(0, normalizedLimit);
    const orderedUpdates = (
      useAfterCursor ? [...trimmedMetaRows].reverse() : trimmedMetaRows
    ).flatMap((row) => {
      if (typeof row.update_id !== 'string') {
        return [];
      }

      return [
        {
          eventOffset: this.extractEventOffset(row),
          rawUpdateId: row.update_id,
          updateId: this.normalizeUpdateId(row.update_id),
          recordTime: row.record_time ?? null,
          paidTrafficCost: row.paid_traffic_cost ?? null,
        },
      ];
    });

    if (orderedUpdates.length === 0) {
      return {
        nodeId: node.id,
        label: node.label,
        limit: normalizedLimit,
        nextBefore: null,
        nextAfter: null,
        updates: [],
      };
    }

    const partiesByUpdateId = await this.fetchPartiesByUpdateId(
      node,
      query,
      orderedUpdates.map((update) => update.rawUpdateId),
    );
    const latestPurchase = await this.latestTrafficPurchase(node);
    const trafficEstimates = await Promise.all(
      orderedUpdates.map((update) =>
        this.estimateTraffic(update.paidTrafficCost, latestPurchase),
      ),
    );

    return {
      nodeId: node.id,
      label: node.label,
      limit: normalizedLimit,
      nextBefore:
        useAfterCursor || hasMoreInQuery
          ? (orderedUpdates[orderedUpdates.length - 1]?.eventOffset ?? null)
          : null,
      nextAfter: useAfterCursor
        ? hasMoreInQuery
          ? (orderedUpdates[0]?.eventOffset ?? null)
          : null
        : before
          ? (orderedUpdates[0]?.eventOffset ?? null)
          : null,
      updates: orderedUpdates.map((update, index) => ({
        eventOffset: update.eventOffset,
        updateId: update.updateId,
        recordTime: update.recordTime,
        parties: partiesByUpdateId.get(update.updateId) ?? [],
        estimatedTrafficUsd: trafficEstimates[index]?.usd ?? null,
        ...(trafficEstimates[index]
          ? { estimatedTrafficUsdGapDays: trafficEstimates[index].gapDays }
          : {}),
      })),
    };
  }

  async fetchGlobalRecentUpdates(
    nodes: NodeConfig[],
    limit = 30,
    options?: {
      before?: string;
      after?: string;
      parties?: string[];
      templates?: string[];
      partyMode?: string;
      mode?: string;
      hideSplice?: boolean;
      nodeIds?: string[];
    },
  ): Promise<GlobalRecentUpdatesResponse> {
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0
        ? Math.trunc(Number(limit))
        : 30;
    const beforeCursor = decodeGlobalUpdateCursor(options?.before);
    const afterCursor =
      beforeCursor === null ? decodeGlobalUpdateCursor(options?.after) : null;
    const parties = options?.parties;
    const templates = options?.templates;
    const partyMode = options?.partyMode ?? options?.mode;
    const hideSplice = options?.hideSplice === true;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    // One extra row is enough to establish whether a node has another page.
    // Fetching twice the requested global page from every node makes the home
    // feed needlessly expensive, especially when each row also loads parties
    // and traffic-cost metadata before the global merge.
    const pageSize = normalizedLimit + 1;
    const eligibleNodes =
      options?.nodeIds === undefined
        ? nodes
        : nodes.filter((node) => options.nodeIds?.includes(node.id));
    const nodeStates = eligibleNodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      oldestFetched: null as GlobalUpdateCursor | null,
      exhausted: false,
    }));
    const mergedUpdatesByKey = new Map<string, GlobalMergedUpdate>();

    const filterUpdates = (
      updates: GlobalMergedUpdate[],
    ): GlobalMergedUpdate[] => {
      if (beforeCursor !== null) {
        return updates.filter(
          (update) => compareGlobalMergedUpdates(update, beforeCursor) > 0,
        );
      }

      if (afterCursor !== null) {
        return updates.filter(
          (update) => compareGlobalMergedUpdates(update, afterCursor) < 0,
        );
      }

      return updates;
    };

    let filteredUpdates: GlobalMergedUpdate[] = [];
    let hasMoreInDirection = false;

    while (true) {
      const nodesToFetch = nodeStates.filter((state) => !state.exhausted);

      if (nodesToFetch.length === 0) {
        break;
      }

      const settled = await Promise.allSettled(
        nodesToFetch.map((state) =>
          this.fetchRecentUpdates(state.node, {
            limit: pageSize,
            parties,
            templates,
            partyMode,
            hideSplice,
            before: state.nextBefore,
          }),
        ),
      );

      const successfulResponses: Array<{
        state: (typeof nodeStates)[number];
        response: Awaited<ReturnType<PqsSummaryService['fetchRecentUpdates']>>;
      }> = [];

      settled.forEach((result, index) => {
        const state = nodesToFetch[index];

        if (!state) {
          return;
        }

        if (result.status !== 'fulfilled') {
          state.exhausted = true;
          return;
        }

        successfulResponses.push({
          state,
          response: result.value,
        });
      });

      if (successfulResponses.length === 0) {
        throw settled.find((result) => result.status === 'rejected')?.reason;
      }

      successfulResponses.forEach(({ response, state }) => {
        for (const update of response.updates) {
          const cursor: GlobalUpdateCursor = {
            recordTime: update.recordTime,
            nodeId: state.node.id,
            eventOffset: update.eventOffset,
            updateId: update.updateId,
          };

          if (
            state.oldestFetched === null ||
            compareGlobalMergedUpdates(cursor, state.oldestFetched) > 0
          ) {
            state.oldestFetched = cursor;
          }
        }

        for (const update of response.updates) {
          mergedUpdatesByKey.set(
            `${state.node.id}:${update.eventOffset}:${update.updateId}`,
            {
              nodeId: state.node.id,
              label: state.node.label,
              eventOffset: update.eventOffset,
              updateId: update.updateId,
              recordTime: update.recordTime,
              parties: update.parties,
              estimatedTrafficUsd: update.estimatedTrafficUsd ?? null,
              ...(update.estimatedTrafficUsdGapDays !== undefined
                ? {
                    estimatedTrafficUsdGapDays:
                      update.estimatedTrafficUsdGapDays,
                  }
                : {}),
            },
          );
        }

        state.nextBefore = response.nextBefore ?? undefined;
        state.exhausted = response.nextBefore === null;
      });

      const sortedUpdates = Array.from(mergedUpdatesByKey.values()).sort(
        compareGlobalMergedUpdates,
      );
      filteredUpdates = filterUpdates(sortedUpdates);
      hasMoreInDirection = filteredUpdates.length > normalizedLimit;

      const reachedAfterCursor =
        useAfterCursor &&
        afterCursor !== null &&
        nodeStates.every(
          (state) =>
            state.exhausted ||
            (state.oldestFetched !== null &&
              compareGlobalMergedUpdates(state.oldestFetched, afterCursor) >=
                0),
        );

      if (
        (useAfterCursor ? reachedAfterCursor : hasMoreInDirection) ||
        nodeStates.every((state) => state.exhausted)
      ) {
        break;
      }
    }

    const updates = useAfterCursor
      ? filteredUpdates.slice(-normalizedLimit)
      : filteredUpdates.slice(0, normalizedLimit);

    return {
      limit: normalizedLimit,
      nextBefore:
        updates.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalUpdateCursor(updates[updates.length - 1])
          : null,
      nextAfter:
        updates.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalUpdateCursor(updates[0])
              : null
            : beforeCursor
              ? encodeGlobalUpdateCursor(updates[0])
              : null,
      updates,
    };
  }

  private emptySearchGroup<T>(): SearchResultGroup<T> {
    return {
      items: [],
      displayedCount: 0,
      truncated: false,
      status: 'ok',
      warnings: [],
    };
  }

  private finalizeSearchGroup<T>(options: {
    items: T[];
    totalCount?: number;
    status?: SearchResultGroup<T>['status'];
    warnings?: string[];
  }): SearchResultGroup<T> {
    const totalCount = options.totalCount ?? options.items.length;
    return {
      items: options.items,
      displayedCount: options.items.length,
      truncated: totalCount > options.items.length,
      status: options.status ?? 'ok',
      warnings: options.warnings ?? [],
    };
  }

  private resolveNodeSearchStatus<T>(
    settled: PromiseSettledResult<T>[],
    subject: string,
    nodes: NodeConfig[],
  ): {
    status: SearchResultGroup<unknown>['status'];
    warnings: string[];
    hasSuccess: boolean;
  } {
    const warnings = settled.flatMap((result, index) =>
      result.status === 'rejected'
        ? [
            `Failed to search ${subject} on ${nodes[index]?.label ?? nodes[index]?.id ?? 'unknown node'}`,
          ]
        : [],
    );
    const hasSuccess = settled.some((result) => result.status === 'fulfilled');

    return {
      status: warnings.length === 0 ? 'ok' : hasSuccess ? 'partial' : 'failed',
      warnings,
      hasSuccess,
    };
  }

  private isExactMatch(
    query: string,
    values: Array<string | null | undefined>,
  ): boolean {
    return values.some((value) => typeof value === 'string' && value === query);
  }

  private hasPrefixMatch(
    query: string,
    values: Array<string | null | undefined>,
  ): boolean {
    return values.some(
      (value) => typeof value === 'string' && value.startsWith(query),
    );
  }

  private async searchUpdates(
    nodes: NodeConfig[],
    query: string,
  ): Promise<SearchResultGroup<SearchUpdateResult>> {
    if (nodes.length === 0) {
      return this.emptySearchGroup<SearchUpdateResult>();
    }

    const settled = await Promise.allSettled(
      nodes.map((node) =>
        this.searchUpdatesForNode(node, query, SEARCH_GROUP_LIMIT + 1),
      ),
    );
    const deduped = new Map<string, SearchMatchedUpdate>();

    for (const result of settled) {
      if (result.status !== 'fulfilled') {
        continue;
      }

      for (const item of result.value) {
        const key = `${item.nodeId}:${item.eventOffset}`;
        const existing = deduped.get(key);
        if (!existing || (item.exact && !existing.exact)) {
          deduped.set(key, item);
        }
      }
    }

    const ordered = Array.from(deduped.values()).sort(compareSearchUpdates);
    const { status, warnings } = this.resolveNodeSearchStatus(
      settled,
      'updates',
      nodes,
    );

    return this.finalizeSearchGroup<SearchUpdateResult>({
      items: ordered
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(({ exact: _exact, ...item }) => item),
      totalCount: ordered.length,
      status,
      warnings,
    });
  }

  private async searchUpdatesForNode(
    node: NodeConfig,
    query: string,
    limit: number,
  ): Promise<SearchMatchedUpdate[]> {
    const client = await this.managerFactory.getRawExecutor(node);
    const rows = await this.querySearchUpdateMetaRows(
      node,
      client.query.bind(client),
      query,
      limit,
    );
    const dedupedRows = new Map<string, UpdateMetaRow>();

    for (const row of rows) {
      const eventOffset = this.extractEventOffset(row);
      if (!dedupedRows.has(eventOffset)) {
        dedupedRows.set(eventOffset, row);
      }
    }

    const rawRows = Array.from(dedupedRows.values());
    const rawUpdateIds = rawRows
      .map((row) => row.update_id)
      .filter((updateId): updateId is string => typeof updateId === 'string');
    const partiesByUpdateId =
      rawUpdateIds.length > 0
        ? await this.fetchPartiesByUpdateId(
            node,
            client.query.bind(client),
            rawUpdateIds,
          )
        : new Map<string, string[]>();

    return rawRows
      .map((row) => {
        if (typeof row.update_id !== 'string') {
          return null;
        }

        const normalizedUpdateId = this.normalizeUpdateId(row.update_id);
        const eventOffset = this.extractEventOffset(row);
        const exact = this.isExactMatch(query, [
          eventOffset,
          normalizedUpdateId,
        ]);
        const matches =
          exact ||
          this.hasPrefixMatch(query, [eventOffset, normalizedUpdateId]);

        if (!matches) {
          return null;
        }

        return {
          nodeId: node.id,
          label: node.label,
          eventOffset,
          updateId: normalizedUpdateId,
          recordTime: row.record_time ?? null,
          parties: partiesByUpdateId.get(normalizedUpdateId) ?? [],
          exact,
        } satisfies SearchMatchedUpdate;
      })
      .filter((item): item is SearchMatchedUpdate => item !== null);
  }

  private async searchContracts(
    nodes: NodeConfig[],
    query: string,
  ): Promise<SearchResultGroup<SearchContractResult>> {
    if (nodes.length === 0) {
      return this.emptySearchGroup<SearchContractResult>();
    }

    const settled = await Promise.allSettled(
      nodes.map((node) =>
        this.searchContractsForNode(node, query, SEARCH_GROUP_LIMIT + 1),
      ),
    );
    const deduped = new Map<string, SearchMatchedContract>();

    for (const result of settled) {
      if (result.status !== 'fulfilled') {
        continue;
      }

      for (const item of result.value) {
        deduped.set(`${item.nodeId}:${item.contractId}`, item);
      }
    }

    const ordered = Array.from(deduped.values()).sort(compareSearchContracts);
    const { status, warnings } = this.resolveNodeSearchStatus(
      settled,
      'contracts',
      nodes,
    );

    return this.finalizeSearchGroup<SearchContractResult>({
      items: ordered
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(({ exact: _exact, ...item }) => item),
      totalCount: ordered.length,
      status,
      warnings,
    });
  }

  private async searchContractsForNode(
    node: NodeConfig,
    query: string,
    limit: number,
  ): Promise<SearchMatchedContract[]> {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      pqsSearchContractsQuery(node, query, limit),
    );
    const rows = (result.rows as ActiveContractRow[]) ?? [];

    return rows
      .filter((row) => this.hasPrefixMatch(query, [row.contract_id]))
      .map((row) => ({
        nodeId: node.id,
        label: node.label,
        contractId: row.contract_id,
        templateId: this.normalizeTemplateIdentifier(row.template_id),
        createdRecordTime: row.created_record_time ?? null,
        exact: this.isExactMatch(query, [row.contract_id]),
      }));
  }

  private async searchParties(
    nodes: NodeConfig[],
    query: string,
  ): Promise<SearchResultGroup<SearchPartyResult>> {
    if (nodes.length === 0) {
      return this.emptySearchGroup<SearchPartyResult>();
    }

    const normalizedQuery = this.normalizePartyIdentifier(query);
    const settled = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        parties: await this.fetchActivePartiesForNode(node),
      })),
    );
    const merged = new Map<string, SearchMatchedParty>();

    for (const result of settled) {
      if (result.status !== 'fulfilled') {
        continue;
      }

      for (const partyId of result.value.parties) {
        if (!partyId.startsWith(normalizedQuery)) {
          continue;
        }

        const existing = merged.get(partyId);
        if (existing) {
          existing.nodeIds = Array.from(
            new Set([...existing.nodeIds, result.value.node.id]),
          ).sort();
          continue;
        }

        merged.set(partyId, {
          partyId,
          nodeIds: [result.value.node.id],
          exact: partyId === normalizedQuery,
        });
      }
    }

    const ordered = Array.from(merged.values()).sort(compareSearchParties);
    const { status, warnings } = this.resolveNodeSearchStatus(
      settled,
      'parties',
      nodes,
    );

    return this.finalizeSearchGroup<SearchPartyResult>({
      items: ordered
        .slice(0, SEARCH_GROUP_LIMIT)
        .map(({ exact: _exact, ...item }) => item),
      totalCount: ordered.length,
      status,
      warnings,
    });
  }

  private async searchPackages(query: string): Promise<{
    packageIds: SearchResultGroup<SearchPackageIdResult>;
    packageNames: SearchResultGroup<SearchPackageNameResult>;
  }> {
    const packages = this.packageCacheService?.listPackages() ?? [];
    const packageIdMatches = packages
      .filter((pkg) => pkg.packageId.startsWith(query))
      .map((pkg) => ({
        packageId: pkg.packageId,
        name: pkg.name,
        version: pkg.version,
        exact: pkg.packageId === query,
      }))
      .sort(compareSearchPackageIds);

    const groupedNames = new Map<string, SearchMatchedPackageName>();
    for (const pkg of packages) {
      if (!pkg.name || !pkg.name.startsWith(query)) {
        continue;
      }

      const existing = groupedNames.get(pkg.name);
      if (existing) {
        existing.packages.push({
          packageId: pkg.packageId,
          version: pkg.version,
        });
        continue;
      }

      groupedNames.set(pkg.name, {
        name: pkg.name,
        packages: [{ packageId: pkg.packageId, version: pkg.version }],
        exact: pkg.name === query,
      });
    }

    const packageNameMatches = Array.from(groupedNames.values())
      .map((entry) => ({
        ...entry,
        packages: [...entry.packages].sort(
          (left, right) =>
            (right.version ?? '').localeCompare(left.version ?? '') ||
            left.packageId.localeCompare(right.packageId),
        ),
      }))
      .sort(compareSearchPackageNames);

    return {
      packageIds: this.finalizeSearchGroup<SearchPackageIdResult>({
        items: packageIdMatches
          .slice(0, SEARCH_GROUP_LIMIT)
          .map(({ exact: _exact, ...item }) => item),
        totalCount: packageIdMatches.length,
      }),
      packageNames: this.finalizeSearchGroup<SearchPackageNameResult>({
        items: packageNameMatches
          .slice(0, SEARCH_GROUP_LIMIT)
          .map(({ exact: _exact, ...item }) => item),
        totalCount: packageNameMatches.length,
      }),
    };
  }

  private async querySearchUpdateMetaRows(
    node: NodeConfig,
    queryFn: (sql: string) => Promise<{ rows: unknown[] }>,
    searchQuery: string,
    limit: number,
  ): Promise<UpdateMetaRow[]> {
    const result = await queryFn(
      pqsSearchUpdatesQuery(node, searchQuery, limit),
    );
    return (result.rows as UpdateMetaRow[]) ?? [];
  }

  private async resolveTemplateTypePks(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    templateIds: readonly string[],
  ): Promise<TemplateTypePks> {
    const result = await query(templateTypePksQuery(node, templateIds));
    const contract: bigint[] = [];
    const exercise: bigint[] = [];

    for (const row of result.rows as TemplateTypePkRow[]) {
      const value = row.pk?.toString();
      if (!value || !/^\d+$/.test(value)) {
        continue;
      }

      const templateTypePk = BigInt(value);
      if (templateTypePk <= 0n) {
        continue;
      }

      if (row.type_source === 'exercise') {
        exercise.push(templateTypePk);
      } else {
        contract.push(templateTypePk);
      }
    }

    return {
      contract: normalizeTemplateTypePks(contract),
      exercise: normalizeTemplateTypePks(exercise),
    };
  }

  private async queryRecentUpdateMetaRows(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    limit: number,
    before?: string,
    after?: string,
    parties?: string[],
    templateTypePks?: TemplateTypePks,
    mode?: string,
    hideSplice?: boolean,
  ): Promise<UpdateMetaRow[]> {
    let candidateLimit = limit + 1;
    const candidateDirection =
      normalizeEventOffsetCursor(after) && !normalizeEventOffsetCursor(before)
        ? 'asc'
        : 'desc';

    for (;;) {
      const result = await query(
        pqsRecentUpdatesQuery(
          node,
          limit,
          before,
          after,
          parties,
          templateTypePks,
          mode,
          hideSplice,
          candidateLimit,
        ),
      );
      const rows = (result.rows as UpdateMetaRow[]) ?? [];
      const updates = rows.filter(
        (row): row is UpdateMetaRow & { update_id: string } =>
          typeof row.update_id === 'string',
      );
      const candidateFrontierValue = rows.find(
        (row) =>
          row.candidate_frontier_ix !== null &&
          row.candidate_frontier_ix !== undefined,
      )?.candidate_frontier_ix;
      const candidateFrontierIx =
        candidateFrontierValue === null || candidateFrontierValue === undefined
          ? null
          : BigInt(String(candidateFrontierValue));

      if (candidateFrontierIx === null) {
        return updates;
      }

      if (updates.length >= limit + 1) {
        const pageBoundaryValue = updates[limit - 1]?.update_ix;
        if (pageBoundaryValue === null || pageBoundaryValue === undefined) {
          throw new Error(
            'PQS recent update query omitted update index metadata at the page boundary',
          );
        }
        const pageBoundaryIx = BigInt(String(pageBoundaryValue));
        const frontierCouldOutrankBoundary =
          candidateDirection === 'asc'
            ? candidateFrontierIx < pageBoundaryIx
            : candidateFrontierIx > pageBoundaryIx;

        if (!frontierCouldOutrankBoundary) {
          return updates;
        }
      }

      candidateLimit *= 2;
    }
  }

  async fetchNodeContracts(
    node: NodeConfig,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
      parties?: string[];
      templates?: string[];
      partyMode?: string;
      hideSplice?: boolean;
    },
  ): Promise<NodeContractsResponse> {
    const client = await this.managerFactory.getRawExecutor(node);
    const normalizedLimit =
      typeof options?.limit === 'number' &&
      Number.isFinite(options.limit) &&
      options.limit > 0
        ? Math.trunc(options.limit)
        : 30;
    const before = options?.before;
    const after = options?.after;
    const parties = options?.parties;
    const templates = options?.templates;
    const partyMode = options?.partyMode;
    const hideSplice = options?.hideSplice === true;
    const useAfterCursor = Boolean(
      decodeActiveContractCursor(after) && !decodeActiveContractCursor(before),
    );
    const query = client.query.bind(client);
    const normalizedTemplates = normalizeTemplateFilters(templates);
    const templateTypePks =
      normalizedTemplates.length > 0
        ? await this.resolveTemplateTypePks(node, query, normalizedTemplates)
        : undefined;
    const result = await query(
      pqsActiveContractsQuery(
        node,
        normalizedLimit,
        before,
        after,
        parties,
        templateTypePks?.contract,
        partyMode,
        hideSplice,
      ),
    );
    const rawRows = (result.rows as ActiveContractRow[]) ?? [];
    const hasMoreInQuery = rawRows.length > normalizedLimit;
    const trimmedRows = rawRows.slice(0, normalizedLimit);
    const orderedContracts = (
      useAfterCursor ? [...trimmedRows].reverse() : trimmedRows
    ).map((row) => ({
      contractId: row.contract_id,
      templateId: this.normalizeTemplateIdentifier(row.template_id),
      createdRecordTime: row.created_record_time ?? null,
      cursor: encodeActiveContractCursor(row),
    }));

    return {
      nodeId: node.id,
      label: node.label,
      limit: normalizedLimit,
      nextBefore:
        orderedContracts.length > 0 && (useAfterCursor || hasMoreInQuery)
          ? (orderedContracts[orderedContracts.length - 1]
              ?.cursor ?? null)
          : null,
      nextAfter:
        orderedContracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInQuery
              ? (orderedContracts[0]?.cursor ?? null)
              : null
            : before
              ? (orderedContracts[0]?.cursor ?? null)
              : null,
      contracts: orderedContracts.map((contract) => ({
        contractId: contract.contractId,
        templateId: contract.templateId,
        createdRecordTime: contract.createdRecordTime,
      })),
    };
  }

  async fetchActivityBuckets(
    node: NodeConfig,
    days = 30,
    bucketMinutes = 15,
  ): Promise<
    Array<{
      timestamp: string;
      activityValue: number;
      latestOffset: string | null;
    }>
  > {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      pqsActivityBucketsQuery(node, days, bucketMinutes),
    );
    const rows = (result.rows as ActivityBucketRow[]) ?? [];

    return rows
      .filter(
        (row): row is ActivityBucketRow & { bucket_timestamp: string } =>
          typeof row.bucket_timestamp === 'string',
      )
      .map((row) => ({
        timestamp: row.bucket_timestamp,
        activityValue: Number(row.activity_value ?? 0),
        latestOffset: row.latest_offset ?? null,
      }));
  }

  async fetchPackageDetail(packageId: string): Promise<PackageDetailResponse> {
    const metadata =
      this.packageCacheService?.getPackageMetadata(packageId) ?? null;
    if (!metadata) {
      throw new Error('Package not found');
    }

    const seenOnNodes = (
      this.packageCacheService?.listNodesForPackage(packageId) ?? []
    ).map((row) => ({
      nodeId: row.nodeId,
      packageName: row.packageName,
      packageVersion: row.packageVersion,
      seenAt: row.seenAt,
    }));

    const inspection = this.packageRegistryService
      ? await this.packageRegistryService.inspectPackage(packageId)
      : { ok: false as const, reason: 'missing_package' as const };

    if (!inspection.ok) {
      return {
        packageId: metadata.packageId,
        name: metadata.name,
        version: metadata.version,
        uploadedAt: metadata.uploadedAt,
        packageSize: metadata.packageSize,
        status:
          inspection.reason === 'missing_package'
            ? 'not_available'
            : 'invalid_package',
        seenOnNodes,
        moduleCount: 0,
        templateCount: 0,
        dataTypeCount: 0,
        modules: [],
        templates: [],
        dataTypes: [],
      };
    }

    return {
      packageId: metadata.packageId,
      name: metadata.name,
      version: metadata.version,
      uploadedAt: metadata.uploadedAt,
      packageSize: metadata.packageSize,
      status: 'decoded',
      seenOnNodes,
      moduleCount: inspection.definition.moduleCount,
      templateCount: inspection.definition.templateCount,
      dataTypeCount: inspection.definition.dataTypeCount,
      modules: [...inspection.definition.modules].sort((left, right) =>
        left.localeCompare(right),
      ),
      templates: [...inspection.definition.templates].sort((left, right) =>
        left.templateId.localeCompare(right.templateId),
      ),
      dataTypes: [...inspection.definition.dataTypes].sort((left, right) =>
        left.typeId.localeCompare(right.typeId),
      ),
    };
  }

  async fetchPackageSummary(
    packageId: string,
  ): Promise<PackageDetailSummaryResponse> {
    const { metadata, inspection } =
      await this.inspectPackageDetailSection(packageId);

    if (!inspection.ok) {
      return {
        packageId: metadata.packageId,
        name: metadata.name,
        version: metadata.version,
        uploadedAt: metadata.uploadedAt,
        packageSize: metadata.packageSize,
        status: this.packageDetailStatus(inspection),
        moduleCount: 0,
        templateCount: 0,
        dataTypeCount: 0,
      };
    }

    return {
      packageId: metadata.packageId,
      name: metadata.name,
      version: metadata.version,
      uploadedAt: metadata.uploadedAt,
      packageSize: metadata.packageSize,
      status: 'decoded',
      moduleCount: inspection.definition.moduleCount,
      templateCount: inspection.definition.templateCount,
      dataTypeCount: inspection.definition.dataTypeCount,
    };
  }

  async fetchPackageNodes(
    packageId: string,
  ): Promise<PackageDetailNodesResponse> {
    this.getPackageMetadataOrThrow(packageId);

    return {
      packageId,
      seenOnNodes: (
        this.packageCacheService?.listNodesForPackage(packageId) ?? []
      ).map((row) => ({
        nodeId: row.nodeId,
        packageName: row.packageName,
        packageVersion: row.packageVersion,
        seenAt: row.seenAt,
      })),
    };
  }

  async fetchPackageModules(
    packageId: string,
  ): Promise<PackageDetailModulesResponse> {
    const { inspection } = await this.inspectPackageDetailSection(packageId);

    return {
      packageId,
      status: this.packageDetailStatus(inspection),
      modules: inspection.ok ? inspection.definition.modules : [],
    };
  }

  async fetchPackageTemplates(
    packageId: string,
  ): Promise<PackageDetailTemplatesResponse> {
    const { inspection } = await this.inspectPackageDetailSection(packageId);

    return {
      packageId,
      status: this.packageDetailStatus(inspection),
      templates: inspection.ok ? inspection.definition.templates : [],
    };
  }

  async fetchPackageDataTypes(
    packageId: string,
  ): Promise<PackageDetailDataTypesResponse> {
    const { inspection } = await this.inspectPackageDetailSection(packageId);

    return {
      packageId,
      status: this.packageDetailStatus(inspection),
      dataTypes: inspection.ok ? inspection.definition.dataTypes : [],
    };
  }

  async fetchPackageModule(
    packageId: string,
    moduleName: string,
  ): Promise<PackageModuleDetailResponse> {
    const { metadata, inspection } =
      await this.inspectPackageDetailSection(packageId);

    return {
      packageId: metadata.packageId,
      name: metadata.name,
      version: metadata.version,
      uploadedAt: metadata.uploadedAt,
      packageSize: metadata.packageSize,
      status: this.packageDetailStatus(inspection),
      moduleName,
      templates: inspection.ok
        ? inspection.definition.templates.filter(
            (template) => template.moduleName === moduleName,
          )
        : [],
      dataTypes: inspection.ok
        ? inspection.definition.dataTypes.filter(
            (dataType) => dataType.moduleName === moduleName,
          )
        : [],
    };
  }

  async fetchPackageTemplate(
    packageId: string,
    templateId: string,
  ): Promise<PackageTemplateDetailResponse> {
    const { metadata, inspection } =
      await this.inspectPackageDetailSection(packageId);

    return {
      packageId: metadata.packageId,
      name: metadata.name,
      version: metadata.version,
      uploadedAt: metadata.uploadedAt,
      packageSize: metadata.packageSize,
      status: this.packageDetailStatus(inspection),
      template: inspection.ok
        ? (inspection.definition.templates.find(
            (template) => template.templateId === templateId,
          ) ?? null)
        : null,
    };
  }

  private getPackageMetadataOrThrow(packageId: string) {
    const metadata =
      this.packageCacheService?.getPackageMetadata(packageId) ?? null;
    if (!metadata) {
      throw new Error('Package not found');
    }

    return metadata;
  }

  private async inspectPackageDetailSection(packageId: string) {
    const metadata = this.getPackageMetadataOrThrow(packageId);
    const inspection: PackageRegistryResult<ResolvedPackageInspection> = this
      .packageRegistryService
      ? await this.packageRegistryService.inspectPackage(packageId)
      : { ok: false, reason: 'missing_package' };

    return { metadata, inspection };
  }

  private packageDetailStatus(
    inspection: PackageRegistryResult<ResolvedPackageInspection>,
  ): PackageDetailResponse['status'] {
    if (inspection.ok) {
      return 'decoded';
    }

    return inspection.reason === 'missing_package'
      ? 'not_available'
      : 'invalid_package';
  }

  async fetchPackagesByName(
    packageName: string,
  ): Promise<PackageFamilyResponse> {
    const packages =
      this.packageCacheService?.listPackagesByName(packageName) ?? [];
    if (packages.length === 0) {
      throw new Error('Package family not found');
    }

    return {
      name: packageName,
      packages,
    };
  }

  async fetchNodePackages(node: NodeConfig): Promise<NodePackagesResponse> {
    const rows = this.packageCacheService?.listPackagesForNode(node.id) ?? [];
    const groupedPackages = new Map<
      string,
      Array<{
        packageId: string;
        version: string | null;
        uploadedAt: string | null;
        seenAt: string;
      }>
    >();

    for (const row of rows) {
      const packageName = row.packageName ?? row.packageId;
      const group = groupedPackages.get(packageName) ?? [];
      group.push({
        packageId: row.packageId,
        version: row.packageVersion,
        uploadedAt: row.uploadedAt,
        seenAt: row.seenAt,
      });
      groupedPackages.set(packageName, group);
    }

    return {
      nodeId: node.id,
      label: node.label,
      packagesByName: Array.from(groupedPackages.entries()).map(
        ([packageName, packages]) => ({
          packageName,
          packages,
        }),
      ),
    };
  }

  async fetchTemplates(): Promise<TemplateFilterResponse> {
    const packageIds = (this.packageCacheService?.listPackages() ?? []).map(
      (pkg) => pkg.packageId,
    );
    return this.buildTemplateFilterResponse(packageIds);
  }

  async fetchNodeTemplates(node: NodeConfig): Promise<TemplateFilterResponse> {
    const packageIds = Array.from(
      new Set(
        (this.packageCacheService?.listPackagesForNode(node.id) ?? []).map(
          (pkg) => pkg.packageId,
        ),
      ),
    );
    return this.buildTemplateFilterResponse(packageIds);
  }

  async fetchActiveParties(
    nodes: NodeConfig[],
  ): Promise<ActivePartiesResponse> {
    return {
      nodes: await Promise.all(
        nodes.map(async (node) => this.buildActivePartiesEntry(node)),
      ),
    };
  }

  async fetchRecentActiveParties(
    nodes: NodeConfig[],
    hours = 24,
    now = new Date(),
  ): Promise<RecentActivePartiesResponse> {
    const normalizedHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
    const windowEnd = now.toISOString();
    const windowStart = new Date(
      now.getTime() - normalizedHours * 60 * 60 * 1000,
    ).toISOString();
    const results = await Promise.allSettled(
      nodes.map(async (node) => {
        const client = await this.managerFactory.getRawExecutor(node);
        const result = await client.query(
          pqsRecentActivePartiesQuery(node, windowStart),
        );
        const row = (result.rows as ActivePartiesRow[])[0];
        return this.normalizeParties(row?.parties ?? null);
      }),
    );
    const parties = new Set<string>();
    const successfulNodeCount = results.filter(
      (result): result is PromiseFulfilledResult<string[]> =>
        result.status === 'fulfilled',
    ).length;
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        result.value.forEach((party) => parties.add(party));
      }
    });

    const status =
      failures.length === 0
        ? 'ok'
        : successfulNodeCount > 0
          ? 'partial'
          : 'error';
    const firstFailure = failures[0]?.reason;

    return {
      count: parties.size,
      windowStart,
      windowEnd,
      status,
      error:
        failures.length === 0
          ? null
          : firstFailure instanceof Error
            ? firstFailure.message
            : 'Unable to load recent active parties.',
    };
  }

  private async buildActivePartiesEntry(
    node: NodeConfig,
  ): Promise<ActivePartiesResponse['nodes'][number]> {
    try {
      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        parties: await this.fetchActivePartiesForNode(node),
        activePartiesStatus: 'ok',
        activePartiesError: null,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        label: node.label,
        mode: node.mode,
        parties: [],
        activePartiesStatus: 'pqs_error',
        activePartiesError:
          error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fetchPartySectionData(
    nodes: NodeConfig[],
    partyId: string,
    includeRecentData = true,
  ) {
    const normalizedPartyId = this.normalizePartyIdentifier(partyId);
    const grpcOperationsService = this.grpcOperationsService;
    const activePartiesByNode = (
      await Promise.allSettled(
        nodes.map(async (node) => ({
          node,
          parties: await this.fetchActivePartiesForNode(node),
        })),
      )
    )
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          parties: string[];
        }> => result.status === 'fulfilled',
      )
      .map((result) => result.value);
    const recentUpdatesByNode = includeRecentData
      ? (
          await Promise.allSettled(
            nodes.map(async (node) => ({
              node,
              updates: await this.fetchPartyRecentUpdatesForNode(
                node,
                normalizedPartyId,
                15,
              ),
            })),
          )
        )
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<{
              node: NodeConfig;
              updates: Awaited<
                ReturnType<PqsSummaryService['fetchPartyRecentUpdatesForNode']>
              >;
            }> => result.status === 'fulfilled',
          )
          .map((result) => result.value)
      : [];
    const recentContractsByNode = includeRecentData
      ? (
          await Promise.allSettled(
            nodes.map(async (node) => ({
              node,
              contracts: await this.fetchPartyRecentContractsForNode(
                node,
                normalizedPartyId,
                15,
              ),
            })),
          )
        )
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<{
              node: NodeConfig;
              contracts: Awaited<
                ReturnType<
                  PqsSummaryService['fetchPartyRecentContractsForNode']
                >
              >;
            }> => result.status === 'fulfilled',
          )
          .map((result) => result.value)
      : [];
    const localPartiesByNode = grpcOperationsService
      ? await Promise.all(
          nodes.map(async (node) => {
            try {
              return {
                node,
                parties: await grpcOperationsService.listLocalParties(node),
              };
            } catch {
              return {
                node,
                parties: [] as string[],
              };
            }
          }),
        )
      : [];
    const localPartyPresenceByNodeId = new Map(
      localPartiesByNode.map(({ node, parties }) => [
        node.id,
        parties.includes(normalizedPartyId),
      ]),
    );

    const nodesById = new Map<
      string,
      {
        nodeId: string;
        label: string;
        recentUpdateCount: number;
        recentContractCount: number;
      }
    >();

    for (const { node, updates } of recentUpdatesByNode) {
      if (updates.length === 0) {
        continue;
      }

      const existing = nodesById.get(node.id);
      nodesById.set(node.id, {
        nodeId: node.id,
        label: node.label,
        recentUpdateCount: updates.length,
        recentContractCount: existing?.recentContractCount ?? 0,
      });
    }

    for (const { node, contracts } of recentContractsByNode) {
      if (contracts.length === 0) {
        continue;
      }

      const existing = nodesById.get(node.id);
      nodesById.set(node.id, {
        nodeId: node.id,
        label: node.label,
        recentUpdateCount: existing?.recentUpdateCount ?? 0,
        recentContractCount: contracts.length,
      });
    }

    for (const { node, parties } of activePartiesByNode) {
      if (!parties.includes(normalizedPartyId)) {
        continue;
      }

      const existing = nodesById.get(node.id);
      nodesById.set(node.id, {
        nodeId: node.id,
        label: node.label,
        recentUpdateCount: existing?.recentUpdateCount ?? 0,
        recentContractCount: existing?.recentContractCount ?? 0,
      });
    }

    for (const { node, parties } of localPartiesByNode) {
      if (!parties.includes(normalizedPartyId)) {
        continue;
      }

      const existing = nodesById.get(node.id);
      nodesById.set(node.id, {
        nodeId: node.id,
        label: node.label,
        recentUpdateCount: existing?.recentUpdateCount ?? 0,
        recentContractCount: existing?.recentContractCount ?? 0,
      });
    }

    const recentUpdates = recentUpdatesByNode
      .flatMap(({ updates }) => updates)
      .sort(
        (left, right) =>
          Date.parse(right.recordTime ?? '') -
          Date.parse(left.recordTime ?? ''),
      )
      .slice(0, 15);
    const recentContracts = recentContractsByNode
      .flatMap(({ contracts }) => contracts)
      .sort(
        (left, right) =>
          Date.parse(right.recordTime ?? '') -
          Date.parse(left.recordTime ?? ''),
      )
      .slice(0, 15);
    const observedNodes = Array.from(nodesById.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );

    if (
      observedNodes.length === 0 &&
      recentUpdates.length === 0 &&
      recentContracts.length === 0
    ) {
      throw new Error('Party not found');
    }

    return {
      partyId: normalizedPartyId,
      nodes: observedNodes,
      recentUpdates,
      recentContracts,
      localPartyPresenceByNodeId,
    };
  }

  async fetchPartySummary(
    nodes: NodeConfig[],
    partyId: string,
  ): Promise<PartySummaryResponse> {
    const sectionData = await this.fetchPartySectionData(nodes, partyId);

    return {
      partyId: sectionData.partyId,
      nodeCount: sectionData.nodes.length,
      recentUpdateCount: sectionData.recentUpdates.length,
      recentContractCount: sectionData.recentContracts.length,
    };
  }

  async fetchPartyNodes(
    nodes: NodeConfig[],
    partyId: string,
  ): Promise<PartyNodesResponse> {
    const sectionData = await this.fetchPartySectionData(nodes, partyId);

    return { nodes: sectionData.nodes };
  }

  async fetchPartyTopology(
    nodes: NodeConfig[],
    partyId: string,
  ): Promise<PartyTopologyResponse> {
    const sectionData = await this.fetchPartySectionData(nodes, partyId, false);

    return {
      partyTopologyByNode: await this.fetchPartyTopologyForObservedNodes(
        nodes,
        sectionData.partyId,
        sectionData.nodes,
        sectionData.localPartyPresenceByNodeId,
      ),
    };
  }

  async fetchPartyDetail(
    nodes: NodeConfig[],
    partyId: string,
  ): Promise<PartyDetailResponse> {
    const sectionData = await this.fetchPartySectionData(nodes, partyId);

    return {
      partyId: sectionData.partyId,
      nodeCount: sectionData.nodes.length,
      recentUpdateCount: sectionData.recentUpdates.length,
      recentContractCount: sectionData.recentContracts.length,
      nodes: sectionData.nodes,
      recentUpdates: sectionData.recentUpdates,
      recentContracts: sectionData.recentContracts,
      partyTopologyByNode: await this.fetchPartyTopologyForObservedNodes(
        nodes,
        sectionData.partyId,
        sectionData.nodes,
        sectionData.localPartyPresenceByNodeId,
      ),
    };
  }

  private async fetchPartyTopologyForObservedNodes(
    nodes: NodeConfig[],
    partyId: string,
    observedNodes: PartyDetailResponse['nodes'],
    localPartyPresenceByNodeId: Map<string, boolean>,
  ): Promise<PartyDetailResponse['partyTopologyByNode']> {
    const grpcOperationsService = this.grpcOperationsService;
    if (!grpcOperationsService) {
      return [];
    }

    return (
      await Promise.all(
        observedNodes.map(async (observedNode) => {
          const node = nodes.find(
            (candidate) => candidate.id === observedNode.nodeId,
          );
          if (!node) {
            return null;
          }

          const topology = await grpcOperationsService.fetchPartyTopology(
            node,
            partyId,
          );
          return {
            ...topology,
            isLocalParty:
              localPartyPresenceByNodeId.get(node.id) ??
              topology.isLocalParty ??
              null,
          };
        }),
      )
    )
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  private async fetchNamespaceSectionData(
    nodes: NodeConfig[],
    namespaceId: string,
    includeRecentData = true,
  ) {
    const normalizedNamespaceId = namespaceId.trim();
    const grpcOperationsService = this.grpcOperationsService;
    const activePartiesByNode = (
      await Promise.allSettled(
        nodes.map(async (node) => ({
          node,
          parties: (await this.fetchActivePartiesForNode(node)).filter(
            (partyId) =>
              this.extractNamespaceIdentifier(partyId) ===
              normalizedNamespaceId,
          ),
        })),
      )
    )
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          parties: string[];
        }> => result.status === 'fulfilled',
      )
      .map((result) => result.value);
    const localPartiesByNode = grpcOperationsService
      ? await Promise.all(
          nodes.map(async (node) => {
            try {
              return {
                node,
                parties: (
                  await grpcOperationsService.listLocalParties(node)
                ).filter(
                  (partyId) =>
                    this.extractNamespaceIdentifier(partyId) ===
                    normalizedNamespaceId,
                ),
              };
            } catch {
              return {
                node,
                parties: [] as string[],
              };
            }
          }),
        )
      : [];
    const partiesById = new Map<string, Set<string>>();
    const nodesById = new Map<
      string,
      {
        nodeId: string;
        label: string;
        recentUpdateCount: number;
        recentContractCount: number;
      }
    >();

    for (const { node, parties } of [
      ...activePartiesByNode,
      ...localPartiesByNode,
    ]) {
      for (const partyId of parties) {
        const nodeIds = partiesById.get(partyId) ?? new Set<string>();
        nodeIds.add(node.id);
        partiesById.set(partyId, nodeIds);
        if (!nodesById.has(node.id)) {
          nodesById.set(node.id, {
            nodeId: node.id,
            label: node.label,
            recentUpdateCount: 0,
            recentContractCount: 0,
          });
        }
      }
    }

    const matchingParties = Array.from(partiesById.keys()).sort((left, right) =>
      left.localeCompare(right),
    );

    if (matchingParties.length === 0) {
      throw new Error('Namespace not found');
    }

    const recentUpdatesResponse = includeRecentData
      ? await this.fetchGlobalRecentUpdates(nodes, 15, {
          parties: matchingParties,
          partyMode: 'or',
        })
      : { updates: [] };
    const recentContractsResponse = includeRecentData
      ? await this.fetchGlobalContracts(nodes, 15, {
          parties: matchingParties,
          partyMode: 'or',
        })
      : { contracts: [] };

    for (const update of recentUpdatesResponse.updates) {
      const existing = nodesById.get(update.nodeId);
      nodesById.set(update.nodeId, {
        nodeId: update.nodeId,
        label: update.label,
        recentUpdateCount: (existing?.recentUpdateCount ?? 0) + 1,
        recentContractCount: existing?.recentContractCount ?? 0,
      });

      for (const partyId of update.parties.filter(
        (partyId) =>
          this.extractNamespaceIdentifier(partyId) === normalizedNamespaceId,
      )) {
        const nodeIds = partiesById.get(partyId) ?? new Set<string>();
        nodeIds.add(update.nodeId);
        partiesById.set(partyId, nodeIds);
      }
    }

    for (const contract of recentContractsResponse.contracts) {
      const existing = nodesById.get(contract.nodeId);
      nodesById.set(contract.nodeId, {
        nodeId: contract.nodeId,
        label: contract.label,
        recentUpdateCount: existing?.recentUpdateCount ?? 0,
        recentContractCount: (existing?.recentContractCount ?? 0) + 1,
      });
    }

    const observedNodes = Array.from(nodesById.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
    return {
      namespaceId: normalizedNamespaceId,
      nodes: observedNodes,
      recentUpdates: recentUpdatesResponse.updates,
      recentContracts: recentContractsResponse.contracts,
      matchingParties,
      partiesById,
    };
  }

  async fetchNamespaceSummary(
    nodes: NodeConfig[],
    namespaceId: string,
  ): Promise<NamespaceSummaryResponse> {
    const sectionData = await this.fetchNamespaceSectionData(
      nodes,
      namespaceId,
    );

    return {
      namespaceId: sectionData.namespaceId,
      partyCount: sectionData.matchingParties.length,
      nodeCount: sectionData.nodes.length,
      recentUpdateCount: sectionData.recentUpdates.length,
      recentContractCount: sectionData.recentContracts.length,
    };
  }

  async fetchNamespaceNodes(
    nodes: NodeConfig[],
    namespaceId: string,
  ): Promise<NamespaceNodesResponse> {
    const sectionData = await this.fetchNamespaceSectionData(
      nodes,
      namespaceId,
    );

    return { nodes: sectionData.nodes };
  }

  async fetchNamespaceTopology(
    nodes: NodeConfig[],
    namespaceId: string,
  ): Promise<NamespaceTopologyResponse> {
    const sectionData = await this.fetchNamespaceSectionData(
      nodes,
      namespaceId,
      false,
    );

    return {
      topologyByNode: await this.fetchNamespaceTopologyByNode(
        nodes,
        sectionData.nodes.map((node) => node.nodeId),
        sectionData.partiesById,
      ),
    };
  }

  async fetchNamespaceUpdates(
    nodes: NodeConfig[],
    namespaceId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    },
  ): Promise<NamespaceUpdatesResponse> {
    const sectionData = await this.fetchNamespaceSectionData(
      nodes,
      namespaceId,
      false,
    );

    return this.fetchGlobalRecentUpdates(nodes, options?.limit ?? 30, {
      before: options?.before,
      after: options?.after,
      parties: sectionData.matchingParties,
      partyMode: 'or',
    });
  }

  async fetchNamespaceContracts(
    nodes: NodeConfig[],
    namespaceId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    },
  ): Promise<NamespaceContractsResponse> {
    const sectionData = await this.fetchNamespaceSectionData(
      nodes,
      namespaceId,
      false,
    );
    const contracts = await this.fetchGlobalContracts(
      nodes,
      options?.limit ?? 30,
      {
        before: options?.before,
        after: options?.after,
        parties: sectionData.matchingParties,
        partyMode: 'or',
      },
    );

    return {
      ...contracts,
      contracts: contracts.contracts.map((contract) => ({
        ...contract,
        packageId: null,
        packageName: null,
        packageVersion: null,
      })),
    };
  }

  async fetchNamespaceDetail(
    nodes: NodeConfig[],
    namespaceId: string,
  ): Promise<NamespaceDetailResponse> {
    const sectionData = await this.fetchNamespaceSectionData(
      nodes,
      namespaceId,
    );

    return {
      namespaceId: sectionData.namespaceId,
      partyCount: sectionData.matchingParties.length,
      nodeCount: sectionData.nodes.length,
      recentUpdateCount: sectionData.recentUpdates.length,
      recentContractCount: sectionData.recentContracts.length,
      nodes: sectionData.nodes,
      recentUpdates: sectionData.recentUpdates,
      recentContracts: sectionData.recentContracts.map((contract) => ({
        ...contract,
        packageId: null,
        packageName: null,
        packageVersion: null,
      })),
      topologyByNode: await this.fetchNamespaceTopologyByNode(
        nodes,
        sectionData.nodes.map((node) => node.nodeId),
        sectionData.partiesById,
      ),
    };
  }

  async fetchNamespaceParties(
    nodes: NodeConfig[],
    namespaceId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    },
  ): Promise<NamespacePartiesResponse> {
    const normalizedNamespaceId = namespaceId.trim();
    const matchingParties = new Set<string>();

    const activePartiesByNode = (
      await Promise.allSettled(
        nodes.map(async (node) =>
          (await this.fetchActivePartiesForNode(node)).filter(
            (partyId) =>
              this.extractNamespaceIdentifier(partyId) ===
              normalizedNamespaceId,
          ),
        ),
      )
    )
      .filter(
        (result): result is PromiseFulfilledResult<string[]> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);

    for (const parties of activePartiesByNode) {
      for (const partyId of parties) {
        matchingParties.add(partyId);
      }
    }

    if (this.grpcOperationsService) {
      const localPartiesByNode = await Promise.all(
        nodes.map(async (node) => {
          try {
            return (
              (
                await this.grpcOperationsService?.listLocalParties(node)
              )?.filter(
                (partyId) =>
                  this.extractNamespaceIdentifier(partyId) ===
                  normalizedNamespaceId,
              ) ?? []
            );
          } catch {
            return [] as string[];
          }
        }),
      );

      for (const parties of localPartiesByNode) {
        for (const partyId of parties) {
          matchingParties.add(partyId);
        }
      }
    }

    const orderedParties = Array.from(matchingParties).sort((left, right) =>
      left.localeCompare(right),
    );
    if (orderedParties.length === 0) {
      throw new Error('Namespace not found');
    }

    const normalizedLimit =
      typeof options?.limit === 'number' &&
      Number.isFinite(options.limit) &&
      options.limit > 0
        ? Math.trunc(options.limit)
        : 30;

    const pagedParties = this.paginateNamespacePartyIds(orderedParties, {
      limit: normalizedLimit,
      before: options?.before,
      after: options?.after,
    });

    return {
      namespaceId: normalizedNamespaceId,
      partyCount: orderedParties.length,
      limit: normalizedLimit,
      nextBefore: pagedParties.nextBefore,
      nextAfter: pagedParties.nextAfter,
      parties: pagedParties.items.map((partyId) => ({
        partyId,
      })),
    };
  }

  async fetchPartyUpdates(
    nodes: NodeConfig[],
    partyId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
      templates?: string[];
      partyMode?: string;
      hideSplice?: boolean;
      nodeIds?: string[];
    },
  ): Promise<GlobalRecentUpdatesResponse> {
    return this.fetchGlobalRecentUpdates(nodes, options?.limit ?? 30, {
      before: options?.before,
      after: options?.after,
      parties: [this.normalizePartyIdentifier(partyId)],
      templates: options?.templates,
      partyMode: options?.partyMode,
      hideSplice: options?.hideSplice,
      nodeIds: options?.nodeIds,
    });
  }

  async fetchGlobalContracts(
    nodes: NodeConfig[],
    limit = 30,
    options?: {
      before?: string;
      after?: string;
      parties?: string[];
      templates?: string[];
      partyMode?: string;
      hideSplice?: boolean;
      nodeIds?: string[];
    },
  ): Promise<GlobalContractsResponse> {
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : 30;
    const beforeCursor = decodeGlobalContractCursor(options?.before);
    const afterCursor =
      beforeCursor === null ? decodeGlobalContractCursor(options?.after) : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const pageSize = Math.max(normalizedLimit * 2, normalizedLimit + 1);
    const selectedNodeIds = options?.nodeIds;
    const eligibleNodes =
      selectedNodeIds === undefined
        ? nodes
        : nodes.filter((node) => selectedNodeIds.includes(node.id));
    const nodeStates = eligibleNodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      exhausted: false,
    }));
    const mergedContractsByKey = new Map<
      string,
      GlobalContractsResponse['contracts'][number]
    >();
    const activePartyFilters = normalizePartyFilters(options?.parties);
    const activeTemplateFilters = normalizeTemplateFilters(options?.templates);
    const partyMode = normalizePartyFilterMode(options?.partyMode);
    const hideSplice = options?.hideSplice === true;

    const filterContracts = (
      contracts: GlobalContractsResponse['contracts'],
    ): GlobalContractsResponse['contracts'] =>
      contracts.filter((contract) => {
        if (
          beforeCursor !== null &&
          compareGlobalMergedContracts(contract, beforeCursor) <= 0
        ) {
          return false;
        }

        if (
          afterCursor !== null &&
          compareGlobalMergedContracts(contract, afterCursor) >= 0
        ) {
          return false;
        }

        const normalizedTemplateId = this.normalizeTemplateIdentifier(
          contract.templateId,
        );
        if (
          activeTemplateFilters.length > 0 &&
          (!normalizedTemplateId ||
            !activeTemplateFilters.includes(normalizedTemplateId))
        ) {
          return false;
        }

        if (hideSplice && normalizedTemplateId?.startsWith('Splice.')) {
          return false;
        }

        return true;
      });

    let filteredContracts: GlobalContractsResponse['contracts'] = [];
    let hasMoreInDirection = false;

    while (true) {
      const nodesToFetch = nodeStates.filter((state) => !state.exhausted);

      if (nodesToFetch.length === 0) {
        break;
      }

      const settled = await Promise.allSettled(
        nodesToFetch.map((state) =>
          this.fetchNodeContracts(state.node, {
            limit: pageSize,
            before: state.nextBefore,
            parties:
              activePartyFilters.length > 0 ? activePartyFilters : undefined,
            templates:
              activeTemplateFilters.length > 0
                ? activeTemplateFilters
                : undefined,
            partyMode,
            hideSplice,
          }),
        ),
      );

      const successfulResponses: Array<{
        state: (typeof nodeStates)[number];
        response: Awaited<ReturnType<PqsSummaryService['fetchNodeContracts']>>;
      }> = [];

      settled.forEach((result, index) => {
        const state = nodesToFetch[index];

        if (!state) {
          return;
        }

        if (result.status !== 'fulfilled') {
          state.exhausted = true;
          return;
        }

        successfulResponses.push({
          state,
          response: result.value,
        });
      });

      if (successfulResponses.length === 0) {
        throw settled.find((result) => result.status === 'rejected')?.reason;
      }

      successfulResponses.forEach(({ response, state }) => {
        for (const contract of response.contracts) {
          mergedContractsByKey.set(`${state.node.id}:${contract.contractId}`, {
            nodeId: state.node.id,
            label: state.node.label,
            contractId: contract.contractId,
            templateId: contract.templateId,
            recordTime: contract.createdRecordTime,
          });
        }

        state.nextBefore = response.nextBefore ?? undefined;
        state.exhausted = response.nextBefore === null;
      });

      const sortedContracts = Array.from(mergedContractsByKey.values()).sort(
        compareGlobalMergedContracts,
      );
      filteredContracts = filterContracts(sortedContracts);
      hasMoreInDirection = filteredContracts.length > normalizedLimit;

      if (hasMoreInDirection || nodeStates.every((state) => state.exhausted)) {
        break;
      }
    }

    const contracts = filteredContracts.slice(0, normalizedLimit);

    return {
      limit: normalizedLimit,
      nextBefore:
        contracts.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalContractCursor(contracts[contracts.length - 1])
          : null,
      nextAfter:
        contracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalContractCursor(contracts[0])
              : null
            : beforeCursor
              ? encodeGlobalContractCursor(contracts[0])
              : null,
      contracts,
    };
  }

  async fetchPartyContracts(
    nodes: NodeConfig[],
    partyId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
      templates?: string[];
      hideSplice?: boolean;
      nodeIds?: string[];
    },
  ): Promise<PartyContractsResponse> {
    const normalizedPartyId = this.normalizePartyIdentifier(partyId);
    const normalizedLimit =
      typeof options?.limit === 'number' &&
      Number.isFinite(options.limit) &&
      options.limit > 0
        ? Math.trunc(options.limit)
        : 30;
    const beforeCursor = decodeGlobalContractCursor(options?.before);
    const afterCursor =
      beforeCursor === null ? decodeGlobalContractCursor(options?.after) : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const pageSize = Math.max(normalizedLimit * 2, normalizedLimit + 1);
    const eligibleNodes =
      options?.nodeIds === undefined
        ? nodes
        : nodes.filter((node) => options.nodeIds?.includes(node.id));
    const nodeStates = eligibleNodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      exhausted: false,
    }));
    const mergedContractsByKey = new Map<string, GlobalMergedContract>();
    const activeTemplateFilters = normalizeTemplateFilters(options?.templates);
    const hideSplice = options?.hideSplice === true;

    const filterContracts = (
      contracts: GlobalMergedContract[],
    ): GlobalMergedContract[] => {
      return contracts.filter((contract) => {
        if (
          beforeCursor !== null &&
          compareGlobalMergedContracts(contract, beforeCursor) <= 0
        ) {
          return false;
        }

        if (
          afterCursor !== null &&
          compareGlobalMergedContracts(contract, afterCursor) >= 0
        ) {
          return false;
        }

        const normalizedTemplateId = this.normalizeTemplateIdentifier(
          contract.templateId,
        );
        if (
          activeTemplateFilters.length > 0 &&
          (!normalizedTemplateId ||
            !activeTemplateFilters.includes(normalizedTemplateId))
        ) {
          return false;
        }

        if (hideSplice && normalizedTemplateId?.startsWith('Splice.')) {
          return false;
        }

        return true;
      });
    };

    let filteredContracts: GlobalMergedContract[] = [];
    let hasMoreInDirection = false;

    while (true) {
      const nodesToFetch = nodeStates.filter((state) => !state.exhausted);

      if (nodesToFetch.length === 0) {
        break;
      }

      const settled = await Promise.allSettled(
        nodesToFetch.map((state) =>
          this.fetchPartyContractsForNode(state.node, normalizedPartyId, {
            limit: pageSize,
            before: state.nextBefore,
          }),
        ),
      );

      const successfulResponses: Array<{
        state: (typeof nodeStates)[number];
        response: Awaited<
          ReturnType<PqsSummaryService['fetchPartyContractsForNode']>
        >;
      }> = [];

      settled.forEach((result, index) => {
        const state = nodesToFetch[index];

        if (!state) {
          return;
        }

        if (result.status !== 'fulfilled') {
          state.exhausted = true;
          return;
        }

        successfulResponses.push({
          state,
          response: result.value,
        });
      });

      if (successfulResponses.length === 0) {
        throw settled.find((result) => result.status === 'rejected')?.reason;
      }

      successfulResponses.forEach(({ response, state }) => {
        for (const contract of response.contracts) {
          mergedContractsByKey.set(
            `${contract.nodeId}:${contract.contractId}`,
            contract,
          );
        }

        state.nextBefore = response.nextBefore ?? undefined;
        state.exhausted = response.nextBefore === null;
      });

      const sortedContracts = Array.from(mergedContractsByKey.values()).sort(
        compareGlobalMergedContracts,
      );
      filteredContracts = filterContracts(sortedContracts);
      hasMoreInDirection = filteredContracts.length > normalizedLimit;

      if (hasMoreInDirection || nodeStates.every((state) => state.exhausted)) {
        break;
      }
    }

    const contracts = filteredContracts.slice(0, normalizedLimit);

    return {
      limit: normalizedLimit,
      nextBefore:
        contracts.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalContractCursor(contracts[contracts.length - 1])
          : null,
      nextAfter:
        contracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalContractCursor(contracts[0])
              : null
            : beforeCursor
              ? encodeGlobalContractCursor(contracts[0])
              : null,
      contracts,
    };
  }

  async fetchTokens(
    nodes: NodeConfig[],
    limit = 30,
    options?: {
      before?: string;
      after?: string;
      names?: string[];
      excludeNames?: string[];
      issuers?: string[];
    },
  ): Promise<TokensResponse> {
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        observedTokens: await this.loadCachedObservedTokens(node),
      })),
    );
    const successfulTokens = refreshResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          observedTokens: LoadedNodeObservedTokens;
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value.observedTokens.tokens);
    const refreshing = refreshResults.some(
      (result) =>
        result.status === 'fulfilled' && result.value.observedTokens.refreshing,
    );

    if (successfulTokens.length === 0) {
      const firstFailure = refreshResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    const dedupedTokens = new Map<string, TokenSummary>();
    for (const token of successfulTokens) {
      if (!dedupedTokens.has(token.tokenId)) {
        dedupedTokens.set(token.tokenId, token);
      }
    }

    const filteredTokens = this.filterTokens(
      Array.from(dedupedTokens.values()),
      options,
    );

    return {
      ...this.paginateTokens(
        filteredTokens.sort(compareGlobalTokens),
        limit,
        options,
      ),
      refreshing,
    };
  }

  async fetchLatestTokenTransfers(
    nodes: NodeConfig[],
    limit = 30,
    options?: {
      before?: string;
      after?: string;
      fromParties?: string[];
      toParties?: string[];
      movementTypes?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): Promise<TokenTransfersResponse> {
    const mergedTransfers = this.filterTokenTransfers(
      await this.loadMergedTokenTransfers(nodes),
      options,
    );

    return this.paginateTokenTransfers(mergedTransfers, limit, options);
  }

  async fetchTokenTransfers(
    nodes: NodeConfig[],
    tokenId: string,
    limit = 30,
    options?: {
      before?: string;
      after?: string;
      fromParties?: string[];
      toParties?: string[];
      movementTypes?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): Promise<TokenTransfersResponse> {
    const normalizedTokenId = this.normalizeTokenId(tokenId);
    await this.findObservedToken(nodes, normalizedTokenId);
    const mergedTransfers = this.filterTokenTransfers(
      await this.loadMergedTokenTransfers(nodes),
      options,
    );
    const directTransfers = mergedTransfers.filter(
      (transfer) => transfer.tokenId === normalizedTokenId,
    );

    if (directTransfers.length > 0) {
      return this.paginateTokenTransfers(directTransfers, limit, options);
    }

    const recoveredTransfers = this.filterTokenTransfers(
      await this.recoverTokenTransfersFromActiveHolders(
        nodes,
        normalizedTokenId,
      ),
      options,
    );

    return this.paginateTokenTransfers(recoveredTransfers, limit, options);
  }

  async fetchTokenTransferDetail(
    nodes: NodeConfig[],
    transferId: string,
  ): Promise<TokenTransferSummary> {
    const normalizedTransferId = this.normalizeUpdateId(transferId);
    const transfer = (await this.loadMergedTokenTransfers(nodes))
      .sort(compareGlobalTokenTransfers)
      .find(
        (entry) =>
          entry.rowId === normalizedTransferId ||
          entry.updateId === normalizedTransferId,
      );

    if (!transfer) {
      throw new Error('Token transfer not found');
    }

    return transfer;
  }

  async fetchTokenDetail(
    nodes: NodeConfig[],
    tokenId: string,
  ): Promise<TokenDetailResponse> {
    const normalizedTokenId = this.normalizeTokenId(tokenId);
    const token = await this.findObservedToken(nodes, normalizedTokenId);
    const transfersResponse = await this.fetchTokenTransfers(
      nodes,
      normalizedTokenId,
      30,
    );

    return {
      token,
      transfers: transfersResponse.transfers,
    };
  }

  async fetchTokenHolders(
    nodes: NodeConfig[],
    tokenId: string,
    limit = 30,
    options?: { before?: string; after?: string },
  ): Promise<TokenHoldersResponse> {
    const normalizedTokenId = this.normalizeTokenId(tokenId);
    await this.findObservedToken(nodes, normalizedTokenId);
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        holders: await this.loadCachedTokenHolders(node),
      })),
    );
    const successfulHolders = refreshResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          holders: NodeTokenHolderObservation[];
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value.holders)
      .filter((holder) => holder.tokenId === normalizedTokenId);

    if (successfulHolders.length === 0) {
      const firstFailure = refreshResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    return this.paginateTokenHolders(
      normalizedTokenId,
      this.mergeTokenHolders(successfulHolders),
      limit,
      options,
    );
  }

  private paginateTokenHolders(
    tokenId: string,
    holders: TokenHolderSummary[],
    limit = 30,
    options?: { before?: string; after?: string },
  ): TokenHoldersResponse {
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0
        ? Math.trunc(Number(limit))
        : 30;
    const beforeCursor = decodeGlobalTokenHolderCursor(options?.before);
    const afterCursor =
      beforeCursor === null
        ? decodeGlobalTokenHolderCursor(options?.after)
        : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const filteredHolders = holders.filter((holder) => {
      if (beforeCursor !== null) {
        return compareGlobalTokenHolders(holder, beforeCursor) > 0;
      }

      if (afterCursor !== null) {
        return compareGlobalTokenHolders(holder, afterCursor) < 0;
      }

      return true;
    });
    const hasMoreInDirection = filteredHolders.length > normalizedLimit;
    const pagedHolders = filteredHolders.slice(0, normalizedLimit);

    return {
      tokenId,
      limit: normalizedLimit,
      nextBefore:
        pagedHolders.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalTokenHolderCursor(pagedHolders[pagedHolders.length - 1])
          : null,
      nextAfter:
        pagedHolders.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalTokenHolderCursor(pagedHolders[0])
              : null
            : beforeCursor
              ? encodeGlobalTokenHolderCursor(pagedHolders[0])
              : null,
      holders: pagedHolders,
    };
  }

  private paginateTokens(
    tokens: TokenSummary[],
    limit = 30,
    options?: { before?: string; after?: string },
  ): TokensResponse {
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0
        ? Math.trunc(Number(limit))
        : 30;
    const beforeCursor = decodeGlobalTokenCursor(options?.before);
    const afterCursor =
      beforeCursor === null ? decodeGlobalTokenCursor(options?.after) : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const filteredTokens = tokens.filter((token) => {
      if (beforeCursor !== null) {
        return compareGlobalTokens(token, beforeCursor) > 0;
      }

      if (afterCursor !== null) {
        return compareGlobalTokens(token, afterCursor) < 0;
      }

      return true;
    });
    const hasMoreInDirection = filteredTokens.length > normalizedLimit;
    const pagedTokens = filteredTokens.slice(0, normalizedLimit);

    return {
      limit: normalizedLimit,
      nextBefore:
        pagedTokens.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalTokenCursor(pagedTokens[pagedTokens.length - 1])
          : null,
      nextAfter:
        pagedTokens.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalTokenCursor(pagedTokens[0])
              : null
            : beforeCursor
              ? encodeGlobalTokenCursor(pagedTokens[0])
              : null,
      refreshing: false,
      tokens: pagedTokens,
    };
  }

  private filterTokens(
    tokens: TokenSummary[],
    options?: {
      names?: string[];
      excludeNames?: string[];
      issuers?: string[];
    },
  ): TokenSummary[] {
    const activeNameFilters = normalizeTokenTextFilters(options?.names);
    const activeExcludedNameFilters = normalizeTokenTextFilters(
      options?.excludeNames,
    );
    const activeIssuerFilters = normalizeTokenIssuerFilters(options?.issuers);

    if (
      activeNameFilters.length === 0 &&
      activeExcludedNameFilters.length === 0 &&
      activeIssuerFilters.length === 0
    ) {
      return tokens;
    }

    return tokens.filter((token) => {
      const tokenName = token.name.trim().toLowerCase();
      const tokenSymbol = token.symbol?.trim().toLowerCase() ?? '';
      const matchesNameFilter =
        activeNameFilters.length === 0 ||
        activeNameFilters.some(
          (filterValue) =>
            tokenName.includes(filterValue) ||
            tokenSymbol.includes(filterValue),
        );

      if (!matchesNameFilter) {
        return false;
      }

      const matchesExcludedNameFilter = activeExcludedNameFilters.some(
        (filterValue) =>
          tokenName.includes(filterValue) || tokenSymbol.includes(filterValue),
      );

      if (matchesExcludedNameFilter) {
        return false;
      }

      if (activeIssuerFilters.length === 0) {
        return true;
      }

      return (
        token.issuer !== null && activeIssuerFilters.includes(token.issuer)
      );
    });
  }

  private async loadMergedTokenTransfers(
    nodes: NodeConfig[],
  ): Promise<TokenTransferSummary[]> {
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        transfers: await this.loadCachedTokenTransfers(node),
      })),
    );
    const successfulRefreshes = refreshResults.filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        node: NodeConfig;
        transfers: NodeTokenTransferObservation[];
      }> => result.status === 'fulfilled',
    );
    const successfulTransfers = successfulRefreshes
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          transfers: NodeTokenTransferObservation[];
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value.transfers);

    if (successfulRefreshes.length === 0) {
      const firstFailure = refreshResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    return this.mergeTokenTransfers(successfulTransfers);
  }

  private async recoverTokenTransfersFromActiveHolders(
    nodes: NodeConfig[],
    tokenId: string,
  ): Promise<TokenTransferSummary[]> {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        holders: await this.loadCachedTokenHolders(node),
      })),
    );
    const candidateHolders = refreshResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          holders: NodeTokenHolderObservation[];
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value.holders)
      .filter(
        (holder) => holder.tokenId === tokenId && holder.contractId !== null,
      );

    const recoveredTransfers: NodeTokenTransferObservation[] = [];
    const seenContracts = new Set<string>();
    const contractIdsByNode = new Map<string, string[]>();

    for (const holder of candidateHolders) {
      if (!nodeById.has(holder.nodeId) || !holder.contractId) {
        continue;
      }

      const dedupeKey = `${holder.nodeId}\u0000${holder.contractId}`;
      if (seenContracts.has(dedupeKey)) {
        continue;
      }
      seenContracts.add(dedupeKey);
      const nodeContractIds = contractIdsByNode.get(holder.nodeId);
      if (nodeContractIds) {
        nodeContractIds.push(holder.contractId);
      } else {
        contractIdsByNode.set(holder.nodeId, [holder.contractId]);
      }
    }

    for (const [nodeId, contractIds] of contractIdsByNode) {
      const node = nodeById.get(nodeId);
      if (!node) {
        continue;
      }

      const client = await this.managerFactory.getRawExecutor(node);
      const contractRows = await this.fetchContractDetailsByIds(
        node,
        client.query.bind(client),
        contractIds,
      );
      const eventsByUpdateId = await this.fetchEventsByUpdateIds(
        node,
        client.query.bind(client),
        contractRows
          .map((contractRow) => contractRow.created_update_id)
          .filter(
            (updateId): updateId is string => typeof updateId === 'string',
          ),
      );

      for (const contractRow of contractRows) {
        if (typeof contractRow.created_update_id !== 'string') {
          continue;
        }

        const events =
          eventsByUpdateId.get(contractRow.created_update_id) ?? [];
        const inferredTransfers = this.extractCip112TokenMovements(
          node,
          {
            update_id: contractRow.created_update_id,
            event_offset: contractRow.created_event_offset,
            record_time: contractRow.created_record_time,
          },
          events,
          {
            canonicalShareTokenId: tokenId,
          },
        ).filter((transfer) => transfer.tokenId === tokenId);

        recoveredTransfers.push(...inferredTransfers);
      }
    }

    return this.mergeTokenTransfers(recoveredTransfers);
  }

  private paginateTokenTransfers(
    transfers: TokenTransferSummary[],
    limit = 30,
    options?: {
      before?: string;
      after?: string;
      fromParties?: string[];
      toParties?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): TokenTransfersResponse {
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0
        ? Math.trunc(Number(limit))
        : 30;
    const beforeCursor = decodeGlobalTokenTransferCursor(options?.before);
    const afterCursor =
      beforeCursor === null
        ? decodeGlobalTokenTransferCursor(options?.after)
        : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const filteredTransfers = transfers
      .sort(compareGlobalTokenTransfers)
      .filter((transfer) => {
        if (beforeCursor !== null) {
          return compareGlobalTokenTransfers(transfer, beforeCursor) > 0;
        }

        if (afterCursor !== null) {
          return compareGlobalTokenTransfers(transfer, afterCursor) < 0;
        }

        return true;
      });

    const hasMoreInDirection = filteredTransfers.length > normalizedLimit;
    const pagedTransfers = filteredTransfers.slice(0, normalizedLimit);

    return {
      limit: normalizedLimit,
      nextBefore:
        pagedTransfers.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalTokenTransferCursor(
              pagedTransfers[pagedTransfers.length - 1],
            )
          : null,
      nextAfter:
        pagedTransfers.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalTokenTransferCursor(pagedTransfers[0])
              : null
            : beforeCursor
              ? encodeGlobalTokenTransferCursor(pagedTransfers[0])
              : null,
      transfers: pagedTransfers,
    };
  }

  private filterTokenTransfers(
    transfers: TokenTransferSummary[],
    options?: {
      fromParties?: string[];
      toParties?: string[];
      movementTypes?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): TokenTransferSummary[] {
    const activeFromParties = normalizePartyFilters(options?.fromParties);
    const activeToParties = normalizePartyFilters(options?.toParties);
    const activeMovementTypes = this.normalizeTokenTransferMovementTypeFilters(
      options?.movementTypes,
    );
    const amountGt = options?.amountGt?.trim() || null;
    const amountLt = options?.amountLt?.trim() || null;

    if (
      activeFromParties.length === 0 &&
      activeToParties.length === 0 &&
      activeMovementTypes.length === 0 &&
      amountGt === null &&
      amountLt === null
    ) {
      return transfers;
    }

    return transfers.filter((transfer) => {
      const matchesFrom =
        activeFromParties.length === 0 ||
        (transfer.sender !== null &&
          activeFromParties.includes(transfer.sender));
      const matchesTo =
        activeToParties.length === 0 ||
        (transfer.receiver !== null &&
          activeToParties.includes(transfer.receiver));
      const matchesMovementType =
        activeMovementTypes.length === 0 ||
        activeMovementTypes.includes(
          this.effectiveTokenTransferMovementType(transfer).toLowerCase(),
        );
      const matchesAmountGt =
        amountGt === null ||
        (transfer.amount !== null &&
          this.compareNumericStrings(transfer.amount, amountGt) > 0);
      const matchesAmountLt =
        amountLt === null ||
        (transfer.amount !== null &&
          this.compareNumericStrings(transfer.amount, amountLt) < 0);

      return (
        matchesFrom &&
        matchesTo &&
        matchesMovementType &&
        matchesAmountGt &&
        matchesAmountLt
      );
    });
  }

  async fetchUpdateDetail(
    node: NodeConfig,
    eventOffset: string,
  ): Promise<NodeUpdateDetailResponse> {
    return this.fetchUpdateDetailWithQuery(
      node,
      singleUpdateQuery(node, eventOffset),
    );
  }

  async fetchUpdateDetailById(
    node: NodeConfig,
    updateId: string,
  ): Promise<NodeUpdateDetailResponse> {
    return this.fetchUpdateDetailWithQuery(
      node,
      singleUpdateByIdQuery(node, updateId),
    );
  }

  private async fetchUpdateDetailWithQuery(
    node: NodeConfig,
    detailQuery: string,
  ): Promise<NodeUpdateDetailResponse> {
    const client = await this.managerFactory.getRawExecutor(node);
    const detailResult = await client.query(detailQuery);
    const detailRows = (detailResult.rows as UpdateDetailRow[]) ?? [];
    const detailRow = detailRows[0];

    if (!detailRow) {
      throw new Error('Update not found');
    }

    const rawUpdateId = this.extractRawUpdateId(detailRow);
    const matchedEventOffset = this.extractEventOffset(detailRow);
    const canonicalUpdateId = this.normalizeUpdateId(rawUpdateId);
    const partiesByUpdateId = await this.fetchPartiesByUpdateId(
      node,
      client.query.bind(client),
      [rawUpdateId],
    );
    const events = await this.fetchEventsByUpdateId(
      node,
      client.query.bind(client),
      rawUpdateId,
    );
    const exerciseData = this.shouldResolveRewardCoupon(events)
      ? await this.fetchRewardCouponDetails(
          node,
          client.query.bind(client),
          rawUpdateId,
        )
      : null;
    const latestPurchase = await this.latestTrafficPurchase(node);
    const trafficEstimate = await this.estimateTraffic(
      detailRow.paid_traffic_cost,
      latestPurchase,
    );

    return {
      nodeId: node.id,
      label: node.label,
      eventOffset: matchedEventOffset,
      updateId: canonicalUpdateId,
      recordTime: this.extractIsoRecordTime(detailRow),
      parties: partiesByUpdateId.get(canonicalUpdateId) ?? [],
      estimatedTrafficUsd: trafficEstimate?.usd ?? null,
      ...(trafficEstimate
        ? { estimatedTrafficUsdGapDays: trafficEstimate.gapDays }
        : {}),
      meta: this.extractMeta(detailRow),
      events: this.attachRewardCouponDetails(events, exerciseData),
    };
  }

  async fetchContractDetail(
    node: NodeConfig,
    contractId: string,
  ): Promise<NodeContractDetailResponse> {
    const query = await this.managerFactory.getPqsQuery(node);
    const row = await query.contracts.findUnique({
      where: { contractId },
      include: { createdTransaction: true, archivedTransaction: true },
    });

    if (!row) {
      throw new Error('Contract not found');
    }

    const templateId = `${row.templateId.moduleName}:${row.templateId.entityName}`;
    const packageId = row.packageId ?? row.templateId.packageId;
    const packageMetadata =
      packageId && this.packageCacheService
        ? this.packageCacheService.getPackage(packageId)
        : null;

    return {
      nodeId: node.id,
      label: node.label,
      contractId: row.contractId,
      templateId,
      packageId,
      packageName: packageMetadata?.name ?? null,
      packageVersion: packageMetadata?.version ?? null,
      createdUpdateId: row.createdTransaction?.transactionId ?? null,
      createdEventOffset:
        row.createdTransaction?.offset ?? row.createdEventOffset,
      createdRecordTime:
        row.createdTransaction?.effectiveAt?.toISOString() ?? null,
      archivedUpdateId: row.archivedTransaction?.transactionId ?? null,
      archivedEventOffset:
        row.archivedTransaction?.offset ?? row.archivedEventOffset,
      archivedRecordTime:
        row.archivedTransaction?.effectiveAt?.toISOString() ?? null,
      contractData: await this.decodeContractData(
        node,
        packageId,
        templateId,
        row.payload,
      ),
    };
  }

  private async fetchPartyRecentUpdatesForNode(
    node: NodeConfig,
    partyId: string,
    limit: number,
  ): Promise<PartyDetailResponse['recentUpdates']> {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      pqsPartyRecentUpdatesQuery(node, partyId, limit),
    );
    const rows = (result.rows as UpdateMetaRow[]) ?? [];

    const rawUpdateIds = rows
      .map((row) => row.update_id)
      .filter((updateId): updateId is string => typeof updateId === 'string');
    const partiesByUpdateId =
      rawUpdateIds.length > 0
        ? await this.fetchPartiesByUpdateId(
            node,
            client.query.bind(client),
            rawUpdateIds,
          )
        : new Map<string, string[]>();
    const latestPurchase = await this.latestTrafficPurchase(node);

    const updates = await Promise.all(
      rows.map(async (row) => {
        if (typeof row.update_id !== 'string') {
          return null;
        }

        const updateId = this.normalizeUpdateId(row.update_id);
        const trafficEstimate = await this.estimateTraffic(
          row.paid_traffic_cost,
          latestPurchase,
        );

        return {
          nodeId: node.id,
          label: node.label,
          eventOffset: this.extractEventOffset(row),
          updateId,
          recordTime:
            typeof row.record_time === 'string' ? row.record_time : null,
          parties: partiesByUpdateId.get(updateId) ?? [],
          estimatedTrafficUsd: trafficEstimate?.usd ?? null,
          ...(trafficEstimate
            ? { estimatedTrafficUsdGapDays: trafficEstimate.gapDays }
            : {}),
        };
      }),
    );

    return updates.filter(
      (update): update is NonNullable<typeof update> => update !== null,
    );
  }

  private async fetchPartyRecentContractsForNode(
    node: NodeConfig,
    partyId: string,
    limit: number,
  ): Promise<PartyDetailResponse['recentContracts']> {
    const response = await this.fetchPartyContractsForNode(node, partyId, {
      limit,
    });
    return response.contracts;
  }

  private async fetchPartyContractsForNode(
    node: NodeConfig,
    partyId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    },
  ): Promise<{
    nextBefore: string | null;
    nextAfter: string | null;
    contracts: GlobalMergedContract[];
  }> {
    const client = await this.managerFactory.getRawExecutor(node);
    const normalizedLimit =
      typeof options?.limit === 'number' &&
      Number.isFinite(options.limit) &&
      options.limit > 0
        ? Math.trunc(options.limit)
        : 30;
    const before = options?.before;
    const after = options?.after;
    const useAfterCursor = Boolean(after && !before);
    const result = await client.query(
      pqsPartyRecentContractsQuery(
        node,
        partyId,
        normalizedLimit,
        before,
        after,
      ),
    );
    const rows = (result.rows as PartyContractRow[]) ?? [];

    const hasMoreInQuery = rows.length > normalizedLimit;
    const trimmedRows = rows.slice(0, normalizedLimit);
    const orderedContracts = (
      useAfterCursor ? [...trimmedRows].reverse() : trimmedRows
    )
      .filter(
        (row): row is PartyContractRow & { contract_id: string } =>
          typeof row.contract_id === 'string',
      )
      .map((row) => {
        const packageId = this.normalizePackageIdentifier(
          row.package_id ?? null,
        );
        const packageMetadata =
          packageId && this.packageCacheService
            ? this.packageCacheService.getPackage(packageId)
            : null;

        return {
          nodeId: node.id,
          label: node.label,
          contractId: row.contract_id,
          templateId: this.normalizeTemplateIdentifier(row.template_id),
          packageId,
          packageName: packageMetadata?.name ?? null,
          packageVersion: packageMetadata?.version ?? null,
          recordTime:
            typeof row.record_time === 'string' ? row.record_time : null,
          createdEventOffset: this.normalizeOptionalScalar(
            row.created_event_offset,
          ),
        };
      });

    return {
      nextBefore:
        orderedContracts.length > 0 && (useAfterCursor || hasMoreInQuery)
          ? (orderedContracts[orderedContracts.length - 1]
              ?.createdEventOffset ?? null)
          : null,
      nextAfter:
        orderedContracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInQuery
              ? (orderedContracts[0]?.createdEventOffset ?? null)
              : null
            : before
              ? (orderedContracts[0]?.createdEventOffset ?? null)
              : null,
      contracts: orderedContracts.map(
        ({ createdEventOffset: _, ...contract }) => contract,
      ),
    };
  }

  private async fetchActivePartiesForNode(node: NodeConfig): Promise<string[]> {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(pqsActivePartiesQuery(node));
    const row = (result.rows as ActivePartiesRow[])[0];
    return this.normalizeParties(row?.parties ?? null);
  }

  private async fetchPartiesByUpdateId(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    updateIds: string[],
  ): Promise<Map<string, string[]>> {
    if (updateIds.length === 0) {
      return new Map();
    }

    try {
      const result = await query(pqsRecentUpdatePartiesQuery(node, updateIds));
      const rows = (result.rows as UpdatePartiesRow[]) ?? [];

      return new Map(
        rows.map((row) => [
          this.normalizeUpdateId(row.update_id),
          this.normalizeParties(row.parties),
        ]),
      );
    } catch {
      return new Map();
    }
  }

  private async loadCachedObservedTokens(
    node: NodeConfig,
  ): Promise<LoadedNodeObservedTokens> {
    const grpcTokens = this.loadGrpcObservedTokens(node);
    const pqsTokens = await this.loadCachedPqsObservedTokens(node);

    if (pqsTokens.length === 0 && grpcTokens) {
      try {
        return {
          refreshing: false,
          tokens: this.mergePqsFirst(pqsTokens, await grpcTokens.promise),
        };
      } catch (error) {
        if (grpcTokens.cachedTokens.length > 0) {
          return {
            refreshing: false,
            tokens: this.mergePqsFirst(pqsTokens, grpcTokens.cachedTokens),
          };
        }
        throw error;
      }
    }

    return {
      refreshing: grpcTokens?.refreshing ?? false,
      tokens: this.mergePqsFirst(pqsTokens, grpcTokens?.cachedTokens ?? []),
    };
  }

  private async loadCachedPqsObservedTokens(
    node: NodeConfig,
  ): Promise<TokenSummary[]> {
    const cached = this.observedTokensByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.tokens;
    }

    const [pqsTokens, builtinTokens] = await Promise.all([
      this.fetchObservedTokensForNode(node, TOKEN_TRANSFER_CACHE_LIMIT),
      this.fetchBuiltinTokensForNode(node),
    ]);
    const tokens = this.mergePqsFirst(pqsTokens, builtinTokens);
    this.observedTokensByNode.set(node.id, {
      cachedAt: Date.now(),
      tokens,
    });
    return tokens;
  }

  private loadGrpcObservedTokens(node: NodeConfig): {
    cachedTokens: TokenSummary[];
    promise: Promise<TokenSummary[]>;
    refreshing: boolean;
  } | null {
    if (
      node.mode !== 'pqs_with_grpc' ||
      this.grpcOperationsService === undefined
    ) {
      return null;
    }

    const cached = this.grpcObservedTokensByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return {
        cachedTokens: cached.tokens,
        promise: Promise.resolve(cached.tokens),
        refreshing: false,
      };
    }

    const inFlight = this.grpcObservedTokenRefreshesByNode.get(node.id);
    if (inFlight) {
      return {
        cachedTokens: cached?.tokens ?? [],
        promise: inFlight,
        refreshing: true,
      };
    }

    const refresh = this.grpcOperationsService
      .fetchHoldingV2Tokens(node)
      .then((tokens) => {
        const sortedTokens = [...tokens].sort(compareGlobalTokens);
        this.grpcObservedTokensByNode.set(node.id, {
          cachedAt: Date.now(),
          tokens: sortedTokens,
        });
        return sortedTokens;
      })
      .finally(() => {
        this.grpcObservedTokenRefreshesByNode.delete(node.id);
      });
    this.grpcObservedTokenRefreshesByNode.set(node.id, refresh);
    void refresh.catch(() => undefined);

    return {
      cachedTokens: cached?.tokens ?? [],
      promise: refresh,
      refreshing: true,
    };
  }

  private mergePqsFirst(
    pqsTokens: TokenSummary[],
    grpcTokens: TokenSummary[],
  ): TokenSummary[] {
    const dedupedTokens = new Map<string, TokenSummary>();
    for (const token of [...pqsTokens, ...grpcTokens]) {
      if (!dedupedTokens.has(token.tokenId)) {
        dedupedTokens.set(token.tokenId, token);
      }
    }

    return Array.from(dedupedTokens.values()).sort(compareGlobalTokens);
  }

  private async fetchBuiltinTokensForNode(
    node: NodeConfig,
  ): Promise<TokenSummary[]> {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(nativeAmuletSupportQuery(node));
    const rows = Array.isArray(result.rows) ? result.rows : [];

    const hasNativeAmuletSupport = rows.some((row) => {
      if (!row || typeof row !== 'object') {
        return false;
      }

      const templateId = (row as { template_id?: unknown }).template_id;
      return (
        typeof templateId === 'string' &&
        NATIVE_AMULET_SUPPORT_TEMPLATE_IDS.includes(
          this.normalizeTemplateIdentifier(
            templateId,
          ) as (typeof NATIVE_AMULET_SUPPORT_TEMPLATE_IDS)[number],
        )
      );
    });

    if (!hasNativeAmuletSupport) {
      return [];
    }

    return [
      {
        tokenId: CANTON_COIN_TOKEN_ID,
        name: CANTON_COIN_TOKEN_NAME,
        symbol: null,
        issuer: null,
        source: 'pqs',
      },
    ];
  }

  private async fetchObservedTokensForNode(
    node: NodeConfig,
    limit: number,
    options?: { includeCip112?: boolean },
  ): Promise<TokenSummary[]> {
    const includeCip112 = options?.includeCip112 ?? true;
    const templateTypePks = await this.resolveTokenTemplateTypePks(
      node,
      includeCip112
        ? TOKEN_DISCOVERY_TEMPLATE_IDS
        : TOKEN_DISCOVERY_NON_CIP112_TEMPLATE_IDS,
      includeCip112
        ? TOKEN_DISCOVERY_TEMPLATE_PATTERNS
        : TOKEN_DISCOVERY_NON_CIP112_TEMPLATE_PATTERNS,
    );
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      tokenRowsQuery(node, limit, templateTypePks),
    );
    const rows = (result.rows as TokenTransferRow[]) ?? [];
    const dedupedTokens = new Map<string, TokenSummary>();

    for (const row of rows) {
      const token = await this.normalizeObservedTokenRow(node, row);
      if (token && !dedupedTokens.has(token.tokenId)) {
        dedupedTokens.set(token.tokenId, token);
      }
    }

    return Array.from(dedupedTokens.values()).sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.tokenId.localeCompare(right.tokenId),
    );
  }

  private async resolveTokenTemplateTypePks(
    node: NodeConfig,
    templateIds: readonly string[],
    templatePatterns: readonly string[],
  ): Promise<number[]> {
    const templateTypes = await this.loadCachedTokenTemplateTypes(node);
    const includeCip112 = templatePatterns.includes(
      CIP112_TEMPLATE_ID_LIKE_PATTERN,
    );
    const requestedTemplateIds = new Set(templateIds);

    return templateTypes
      .filter(
        (templateType) =>
          requestedTemplateIds.has(templateType.templateId) ||
          (includeCip112 && templateType.isCip112),
      )
      .map((templateType) => templateType.pk);
  }

  private async loadCachedTokenTemplateTypes(
    node: NodeConfig,
  ): Promise<TokenTemplateType[]> {
    const cached = this.tokenTemplateTypesByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.templateTypes;
    }

    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query<TokenTemplateTypeRow>(
      tokenTemplateTypesQuery(node),
    );
    const templateTypes = (result.rows ?? []).flatMap((row) => {
      const pk = Number(row.pk);
      if (
        !Number.isSafeInteger(pk) ||
        pk <= 0 ||
        typeof row.module_name !== 'string' ||
        typeof row.entity_name !== 'string'
      ) {
        return [];
      }

      return [
        {
          pk,
          templateId: `${row.module_name}:${row.entity_name}`,
          isCip112: row.module_name.endsWith('.CIP112'),
        },
      ];
    });
    this.tokenTemplateTypesByNode.set(node.id, {
      cachedAt: Date.now(),
      templateTypes,
    });
    return templateTypes;
  }

  private async findObservedToken(
    nodes: NodeConfig[],
    tokenId: string,
  ): Promise<TokenSummary> {
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        tokens: (await this.loadCachedObservedTokens(node)).tokens,
      })),
    );
    const successfulTokens = refreshResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          tokens: TokenSummary[];
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value.tokens);

    if (successfulTokens.length === 0) {
      const firstFailure = refreshResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    let token = successfulTokens.find(
      (candidate) => candidate.tokenId === tokenId,
    );

    if (!token) {
      const grpcFallbacks = await Promise.allSettled(
        nodes.map(async (node) => {
          const grpcTokens = this.loadGrpcObservedTokens(node);
          return grpcTokens ? grpcTokens.promise : [];
        }),
      );
      token = grpcFallbacks
        .filter(
          (result): result is PromiseFulfilledResult<TokenSummary[]> =>
            result.status === 'fulfilled',
        )
        .flatMap((result) => result.value)
        .find((candidate) => candidate.tokenId === tokenId);
    }

    if (!token) {
      throw new Error('Token not found');
    }

    return token;
  }

  private async normalizeObservedTokenRow(
    node: NodeConfig,
    row: TokenTransferRow,
  ): Promise<TokenSummary | null> {
    const templateId = this.normalizeTemplateIdentifier(row.template_id);

    if (
      templateId === CANTON_COIN_TRANSFER_TEMPLATE_ID ||
      templateId === CANTON_COIN_AMULET_TEMPLATE_ID
    ) {
      return {
        tokenId: CANTON_COIN_TOKEN_ID,
        name: CANTON_COIN_TOKEN_NAME,
        symbol: null,
        issuer: null,
        source: 'pqs',
      };
    }

    if (!this.isSupportedObservedTokenTemplate(templateId)) {
      return null;
    }

    const decoded = await this.decodeContractData(
      node,
      this.normalizePackageIdentifier(row.package_id),
      templateId,
      row.contract_instance,
    );

    return this.extractObservedTokenSummary(templateId, decoded);
  }

  private async loadCachedTokenHolders(
    node: NodeConfig,
  ): Promise<NodeTokenHolderObservation[]> {
    const cached = this.tokenHoldersByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.holders;
    }

    const useGrpcHoldingViews =
      node.mode === 'pqs_with_grpc' && this.grpcOperationsService !== undefined;
    const [pqsHolders, grpcHolders] = await Promise.all([
      this.fetchTokenHoldersForNode(node, TOKEN_TRANSFER_CACHE_LIMIT, {
        includeCip112: !useGrpcHoldingViews,
      }),
      useGrpcHoldingViews
        ? this.grpcOperationsService.fetchHoldingV2TokenHolders(node)
        : Promise.resolve([] as GrpcTokenHolderObservation[]),
    ]);
    const holders = [
      ...pqsHolders,
      ...grpcHolders.map((holder) => ({
        contractId: holder.contractId,
        nodeId: holder.nodeId,
        label: holder.label,
        tokenId: holder.tokenId,
        partyId: holder.partyId,
        amount: holder.amount,
      })),
    ];
    this.tokenHoldersByNode.set(node.id, {
      cachedAt: Date.now(),
      holders,
    });
    return holders;
  }

  private async fetchTokenHoldersForNode(
    node: NodeConfig,
    limit: number,
    options?: { includeCip112?: boolean },
  ): Promise<NodeTokenHolderObservation[]> {
    const includeCip112 = options?.includeCip112 ?? true;
    const templateTypePks = await this.resolveTokenTemplateTypePks(
      node,
      includeCip112
        ? TOKEN_HOLDER_TEMPLATE_IDS
        : TOKEN_HOLDER_NON_CIP112_TEMPLATE_IDS,
      includeCip112
        ? TOKEN_HOLDER_TEMPLATE_PATTERNS
        : TOKEN_HOLDER_NON_CIP112_TEMPLATE_PATTERNS,
    );
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      tokenRowsQuery(node, limit, templateTypePks),
    );
    const rows = (result.rows as TokenTransferRow[]) ?? [];
    const holders: NodeTokenHolderObservation[] = [];

    for (const row of rows) {
      const holder = await this.normalizeTokenHolderRow(node, row);
      if (holder) {
        holders.push(holder);
      }
    }

    return holders;
  }

  private async normalizeTokenHolderRow(
    node: NodeConfig,
    row: TokenTransferRow,
  ): Promise<NodeTokenHolderObservation | null> {
    const templateId = this.normalizeTemplateIdentifier(row.template_id);
    const decoded = await this.decodeContractData(
      node,
      this.normalizePackageIdentifier(row.package_id),
      templateId,
      row.contract_instance,
    );

    if (decoded?.status !== 'decoded' || !this.isRecordValue(decoded.value)) {
      return null;
    }

    if (
      templateId === CIP56_HOLDING_TEMPLATE_ID ||
      this.isCip112TemplateId(templateId)
    ) {
      const tokenSummary = this.extractObservedTokenSummary(
        templateId,
        decoded,
      );
      const partyId = this.readScalarField(decoded.value, 'owner');
      if (!tokenSummary || !partyId) {
        return null;
      }

      return {
        contractId: this.normalizeOptionalScalar(row.contract_id),
        nodeId: node.id,
        label: node.label,
        tokenId: tokenSummary.tokenId,
        partyId,
        amount: this.readScalarField(decoded.value, 'amount'),
      };
    }

    if (templateId === CANTON_COIN_AMULET_TEMPLATE_ID) {
      const partyId = this.readScalarField(decoded.value, 'owner');
      if (!partyId) {
        return null;
      }

      return {
        contractId: this.normalizeOptionalScalar(row.contract_id),
        nodeId: node.id,
        label: node.label,
        tokenId: CANTON_COIN_TOKEN_ID,
        partyId,
        amount: this.readNestedScalarField(decoded.value, [
          'amount',
          'initialAmount',
        ]),
      };
    }

    return null;
  }

  private async loadCachedTokenTransfers(
    node: NodeConfig,
  ): Promise<NodeTokenTransferObservation[]> {
    const cached = this.tokenTransfersByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.transfers;
    }

    const transfers = await this.fetchTokenTransfersForNode(
      node,
      TOKEN_TRANSFER_CACHE_LIMIT,
    );
    this.tokenTransfersByNode.set(node.id, {
      cachedAt: Date.now(),
      transfers,
    });
    return transfers;
  }

  private async fetchTokenTransfersForNode(
    node: NodeConfig,
    limit: number,
  ): Promise<NodeTokenTransferObservation[]> {
    const templateTypePks = await this.resolveTokenTemplateTypePks(
      node,
      TOKEN_TRANSFER_TEMPLATE_IDS,
      [],
    );
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      tokenRowsQuery(node, limit, templateTypePks),
    );
    const rows = (result.rows as TokenTransferRow[]) ?? [];
    const transfers: NodeTokenTransferObservation[] = [];

    for (const row of rows) {
      const transfer = await this.normalizeTokenTransferRow(node, row);
      if (transfer) {
        transfers.push(transfer);
      }
    }

    const inferredTransfers = await this.fetchInferredCip112TransfersForNode(
      node,
      limit,
    );
    return [...transfers, ...inferredTransfers].sort(
      compareGlobalTokenTransfers,
    );
  }

  private async normalizeTokenTransferRow(
    node: NodeConfig,
    row: TokenTransferRow,
  ): Promise<NodeTokenTransferObservation | null> {
    const templateId = this.normalizeTemplateIdentifier(row.template_id);
    const decoded = await this.decodeContractData(
      node,
      this.normalizePackageIdentifier(row.package_id),
      templateId,
      row.contract_instance,
    );
    const decodedTransfer = this.extractTokenMovement(templateId, decoded);
    if (!decodedTransfer) {
      return null;
    }

    return {
      nodeId: node.id,
      label: node.label,
      tokenId: decodedTransfer.tokenId,
      tokenName: decodedTransfer.tokenName,
      amount: decodedTransfer.amount,
      sender: decodedTransfer.sender,
      receiver: decodedTransfer.receiver,
      eventOffset: this.normalizeOptionalScalar(row.event_offset) ?? '',
      updateId: this.normalizeUpdateId(row.update_id),
      recordTime: typeof row.record_time === 'string' ? row.record_time : null,
    };
  }

  private async fetchInferredCip112TransfersForNode(
    node: NodeConfig,
    limit: number,
  ): Promise<NodeTokenTransferObservation[]> {
    const client = await this.managerFactory.getRawExecutor(node);
    const result = await client.query(
      recentCip112MovementUpdateIdsQuery(node, limit),
    );
    const rows = (result.rows as Cip112MovementUpdateRow[]) ?? [];
    const transfers: NodeTokenTransferObservation[] = [];
    const rawUpdateIds = rows
      .map((row) => (typeof row.update_id === 'string' ? row.update_id : null))
      .filter((updateId): updateId is string =>
        Boolean(updateId && this.isHexTokenMovementUpdateId(updateId)),
      );
    const eventsByUpdateId = await this.fetchEventsByUpdateIds(
      node,
      client.query.bind(client),
      rawUpdateIds,
    );

    for (const row of rows) {
      const rawUpdateId =
        typeof row.update_id === 'string' ? row.update_id : null;
      if (!rawUpdateId || !this.isHexTokenMovementUpdateId(rawUpdateId)) {
        continue;
      }

      const events = eventsByUpdateId.get(rawUpdateId) ?? [];
      transfers.push(...this.extractCip112TokenMovements(node, row, events));
    }

    return transfers;
  }

  private extractCip112TokenMovements(
    node: NodeConfig,
    update: Cip112MovementUpdateRow,
    events: NodeUpdateDetailEvent[],
    options?: {
      canonicalShareTokenId?: string | null;
    },
  ): NodeTokenTransferObservation[] {
    const standardTransfers = this.extractStandardCip112TokenMovements(
      node,
      update,
      events,
      options,
    );
    if (standardTransfers.length > 0) {
      return standardTransfers;
    }

    return this.inferCip112TokenMovements(node, update, events, options);
  }

  private extractStandardCip112TokenMovements(
    node: NodeConfig,
    update: Cip112MovementUpdateRow,
    events: NodeUpdateDetailEvent[],
    options?: {
      canonicalShareTokenId?: string | null;
    },
  ): NodeTokenTransferObservation[] {
    const createTokensById = new Map<string, TokenSummary>();

    for (const event of events) {
      if (
        event.eventKind !== 'create' ||
        !this.isCip112TemplateId(event.templateId) ||
        event.createData?.status !== 'decoded'
      ) {
        continue;
      }

      const token = this.extractObservedTokenSummary(
        event.templateId,
        event.createData,
      );
      if (token) {
        createTokensById.set(token.tokenId, token);
      }
    }

    const transfers: NodeTokenTransferObservation[] = [];
    const eventLogExercises = events.filter(
      (event) =>
        event.eventKind === 'non_consuming_exercise' &&
        (event.choice === 'HoldingsChange' ||
          event.choice === 'EventLog_HoldingsChange') &&
        event.exerciseData?.argument.status === 'decoded' &&
        this.isRecordValue(event.exerciseData.argument.value),
    );

    for (const event of eventLogExercises) {
      const argument = event.exerciseData?.argument;
      if (
        !argument ||
        argument.status !== 'decoded' ||
        !this.isRecordValue(argument.value)
      ) {
        continue;
      }

      const account = this.findRecordField(argument.value, 'account');
      const transferLegs = this.readListField(
        argument.value,
        'transferLegSides',
      );
      const admin = this.readScalarField(argument.value, 'admin');
      if (!account || !admin || transferLegs.length === 0) {
        continue;
      }

      for (const leg of transferLegs) {
        if (!this.isRecordValue(leg)) {
          continue;
        }

        const side = this.readConstructorField(leg, 'side');
        if (side !== 'SenderSide') {
          continue;
        }

        const transferLegId = this.readScalarField(leg, 'transferLegId');
        const amount = this.readScalarField(leg, 'amount');
        const instrumentId = this.readScalarField(leg, 'instrumentId');
        const otherSideAccount = this.findRecordField(leg, 'otherside');
        if (!transferLegId || !instrumentId || !otherSideAccount) {
          continue;
        }

        const token = this.resolveEventLogTokenSummary(
          admin,
          instrumentId,
          createTokensById,
          options?.canonicalShareTokenId ?? null,
        );
        const movementType = this.classifyEventLogMovementType(
          account,
          otherSideAccount,
          admin,
          instrumentId,
        );

        transfers.push({
          rowId: this.buildTokenTransferLegRowId(
            typeof update.update_id === 'string'
              ? this.normalizeUpdateId(update.update_id)
              : '',
            event.eventId,
            transferLegId,
            movementType,
          ),
          movementType,
          source: 'pqs',
          nodeId: node.id,
          label: node.label,
          tokenId: token.tokenId,
          tokenName: token.name,
          amount,
          sender: this.readAccountParty(account),
          receiver: this.readAccountParty(otherSideAccount),
          eventOffset: this.normalizeOptionalScalar(update.event_offset) ?? '',
          updateId:
            typeof update.update_id === 'string'
              ? this.normalizeUpdateId(update.update_id)
              : '',
          recordTime:
            typeof update.record_time === 'string' ? update.record_time : null,
        });
      }
    }

    return transfers;
  }

  private inferCip112TokenMovements(
    node: NodeConfig,
    update: Cip112MovementUpdateRow,
    events: NodeUpdateDetailEvent[],
    options?: {
      canonicalShareTokenId?: string | null;
    },
  ): NodeTokenTransferObservation[] {
    const createEvents = events.filter(
      (event) =>
        event.eventKind === 'create' &&
        this.isCip112TemplateId(event.templateId) &&
        event.createData?.status === 'decoded' &&
        this.isRecordValue(event.createData.value),
    );
    const transferExercises = events.filter(
      (event) =>
        event.eventKind === 'consuming_exercise' &&
        this.isCip112TemplateId(event.templateId) &&
        typeof event.choice === 'string' &&
        event.choice.startsWith('Transfer'),
    );
    const mintExercises = events.filter(
      (event) =>
        event.eventKind === 'non_consuming_exercise' &&
        this.isCip112TemplateId(event.templateId) &&
        typeof event.choice === 'string' &&
        event.choice.startsWith('Mint'),
    );

    const transfers: NodeTokenTransferObservation[] = [];
    const shareOwnerFallback = createEvents
      .filter((event) => this.isShareLikeCip112Template(event.templateId))
      .map((event) =>
        event.createData?.status === 'decoded' &&
        this.isRecordValue(event.createData.value)
          ? this.readScalarField(event.createData.value, 'owner')
          : null,
      )
      .find((owner): owner is string => Boolean(owner));
    const shouldEmitCreateMovements =
      transferExercises.length > 0 ||
      (transferExercises.length === 0 && mintExercises.length === 0);

    if (shouldEmitCreateMovements) {
      for (const event of createEvents) {
        const movementType = 'Create';
        const transfer = this.buildInferredCip112Movement(
          node,
          update,
          event,
          movementType,
          !this.isShareLikeCip112Template(event.templateId)
            ? shareOwnerFallback
            : null,
          options?.canonicalShareTokenId,
        );
        if (transfer) {
          transfers.push(transfer);
        }
      }
    }

    if (mintExercises.length > 0) {
      for (const event of createEvents) {
        if (this.isShareLikeCip112Template(event.templateId)) {
          continue;
        }

        const transfer = this.buildInferredCip112Movement(
          node,
          update,
          event,
          'Mint',
        );
        if (transfer) {
          transfers.push(transfer);
        }
      }
    }

    return transfers;
  }

  private buildInferredCip112Movement(
    node: NodeConfig,
    update: Cip112MovementUpdateRow,
    event: NodeUpdateDetailEvent,
    movementType: 'Create' | 'Mint',
    receiverFallback: string | null = null,
    canonicalShareTokenId: string | null = null,
  ): NodeTokenTransferObservation | null {
    if (event.createData?.status !== 'decoded') {
      return null;
    }

    const record = event.createData.value;
    if (!this.isRecordValue(record)) {
      return null;
    }

    const token = this.extractObservedTokenSummary(
      event.templateId,
      event.createData,
    );
    if (!token) {
      return null;
    }
    const tokenId =
      canonicalShareTokenId && this.isShareLikeCip112Template(event.templateId)
        ? canonicalShareTokenId
        : token.tokenId;

    return {
      rowId: this.buildTokenMovementRowId(
        typeof update.update_id === 'string'
          ? update.update_id
          : this.normalizeUpdateId(''),
        event.eventId,
        event.templateId,
        movementType,
      ),
      movementType,
      source: INFERRED_HOLDING_V2_SOURCE,
      nodeId: node.id,
      label: node.label,
      tokenId,
      tokenName: token.name,
      amount: this.readScalarField(record, 'amount'),
      sender:
        movementType === 'Mint' ? this.readScalarField(record, 'issuer') : null,
      receiver: this.readScalarField(record, 'owner') ?? receiverFallback,
      eventOffset: this.normalizeOptionalScalar(update.event_offset) ?? '',
      updateId:
        typeof update.update_id === 'string'
          ? this.normalizeUpdateId(update.update_id)
          : '',
      recordTime:
        typeof update.record_time === 'string' ? update.record_time : null,
    };
  }

  private mergeTokenTransfers(
    transfers: NodeTokenTransferObservation[],
  ): TokenTransferSummary[] {
    const deduped = new Map<string, TokenTransferSummary>();

    for (const transfer of transfers) {
      const key = this.buildTokenTransferDedupKey(transfer);
      const existing = deduped.get(key);
      const observedNode = {
        nodeId: transfer.nodeId,
        label: transfer.label,
        eventOffset: transfer.eventOffset,
      };

      if (!existing) {
        deduped.set(key, {
          rowId: transfer.rowId,
          movementType: transfer.movementType,
          source: transfer.source,
          tokenId: transfer.tokenId,
          tokenName: transfer.tokenName,
          amount: transfer.amount,
          sender: transfer.sender,
          receiver: transfer.receiver,
          updateId: transfer.updateId,
          recordTime: transfer.recordTime,
          nodes: [observedNode],
        });
        continue;
      }

      if (!existing.nodes.some((node) => node.nodeId === observedNode.nodeId)) {
        existing.nodes.push(observedNode);
      }
    }

    return Array.from(deduped.values()).map((transfer) => ({
      ...transfer,
      nodes: [...transfer.nodes].sort((left, right) =>
        left.label.localeCompare(right.label),
      ),
    }));
  }

  private mergeTokenHolders(
    holders: NodeTokenHolderObservation[],
  ): TokenHolderSummary[] {
    const merged = new Map<
      string,
      TokenHolderSummary & {
        observedContractIds: Set<string>;
      }
    >();

    for (const holder of holders) {
      const holderKey = `${holder.tokenId}\u0000${holder.partyId}`;
      const existing = merged.get(holderKey);
      const observedNode = {
        nodeId: holder.nodeId,
        label: holder.label,
      };
      const dedupeContractId =
        holder.contractId ??
        JSON.stringify([
          holder.tokenId,
          holder.partyId,
          holder.amount ?? '',
          holder.nodeId,
        ]);

      if (!existing) {
        merged.set(holderKey, {
          partyId: holder.partyId,
          amount: holder.amount,
          nodes: [observedNode],
          observedContractIds: new Set([dedupeContractId]),
        });
        continue;
      }

      if (!existing.nodes.some((node) => node.nodeId === observedNode.nodeId)) {
        existing.nodes.push(observedNode);
      }

      if (!existing.observedContractIds.has(dedupeContractId)) {
        existing.amount = this.addNumericStrings(
          existing.amount,
          holder.amount,
        );
        existing.observedContractIds.add(dedupeContractId);
      }
    }

    return Array.from(merged.values())
      .map(({ observedContractIds: _observedContractIds, ...holder }) => ({
        ...holder,
        nodes: [...holder.nodes].sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
      }))
      .sort((left, right) => {
        const amountComparison = this.compareNumericStrings(
          left.amount,
          right.amount,
        );
        if (amountComparison !== 0) {
          return -amountComparison;
        }

        return left.partyId.localeCompare(right.partyId);
      });
  }

  private buildTokenTransferDedupKey(transfer: {
    rowId?: string;
    tokenId: string;
    amount: string | null;
    sender: string | null;
    receiver: string | null;
    updateId: string;
    recordTime: string | null;
  }): string {
    if (transfer.rowId) {
      return transfer.rowId;
    }

    return JSON.stringify([
      transfer.updateId,
      transfer.tokenId,
      transfer.amount ?? '',
      transfer.sender ?? '',
      transfer.receiver ?? '',
      transfer.recordTime ?? '',
    ]);
  }

  private normalizeTokenId(tokenId: string): string {
    return tokenId.trim();
  }

  private normalizeTokenTransferMovementTypeFilters(
    movementTypes: readonly string[] | null | undefined,
  ): string[] {
    return Array.from(
      new Set(
        (movementTypes ?? [])
          .map((movementType) => movementType.trim().toLowerCase())
          .filter((movementType) => movementType.length > 0),
      ),
    );
  }

  private effectiveTokenTransferMovementType(
    transfer: TokenTransferSummary,
  ): string {
    const normalizedMovementType = transfer.movementType?.trim();
    return normalizedMovementType && normalizedMovementType.length > 0
      ? normalizedMovementType
      : 'Transfer';
  }

  private isCip112TemplateId(templateId: string | null): boolean {
    return typeof templateId === 'string' && templateId.includes('.CIP112:');
  }

  private isSupportedObservedTokenTemplate(templateId: string | null): boolean {
    return (
      templateId === CIP56_HOLDING_TEMPLATE_ID ||
      templateId === CIP56_TRANSFER_TEMPLATE_ID ||
      this.isCip112TemplateId(templateId)
    );
  }

  private isShareLikeCip112Template(templateId: string | null): boolean {
    return (
      typeof templateId === 'string' &&
      templateId.includes('.ShareToken.CIP112:')
    );
  }

  private isHexTokenMovementUpdateId(updateId: string): boolean {
    return /^[0-9a-f]+$/i.test(updateId);
  }

  private buildTokenMovementRowId(
    updateId: string,
    eventId: string | null,
    templateId: string | null,
    movementType: string,
  ): string {
    return [updateId, eventId ?? '', templateId ?? '', movementType].join(':');
  }

  private buildTokenTransferLegRowId(
    updateId: string,
    eventId: string | null,
    transferLegId: string,
    movementType: string,
  ): string {
    return [updateId, eventId ?? '', transferLegId, movementType].join(':');
  }

  private resolveEventLogTokenSummary(
    admin: string,
    instrumentId: string,
    tokensById: Map<string, TokenSummary>,
    canonicalShareTokenId: string | null,
  ): TokenSummary {
    const fallbackToken = this.buildObservedTokenSummary(
      instrumentId,
      admin,
      this.isNativeAmuletIntrinsicId(instrumentId)
        ? CANTON_COIN_TOKEN_NAME
        : instrumentId,
      null,
    );
    const tokenId =
      canonicalShareTokenId &&
      fallbackToken.tokenId ===
        this.normalizeShareLikeIntrinsicTokenId(instrumentId)
        ? canonicalShareTokenId
        : fallbackToken.tokenId;

    return (
      tokensById.get(tokenId) ??
      tokensById.get(fallbackToken.tokenId) ?? {
        ...fallbackToken,
        tokenId,
      }
    );
  }

  private classifyEventLogMovementType(
    senderAccount: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    receiverAccount: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    admin: string,
    instrumentId: string,
  ): 'Mint' | 'Burn' | 'Transfer' {
    if (
      this.isSyntheticEventLogAccount(
        senderAccount,
        admin,
        `${instrumentId}:mint`,
      )
    ) {
      return 'Mint';
    }

    if (
      this.isSyntheticEventLogAccount(
        receiverAccount,
        admin,
        `${instrumentId}:burn`,
      )
    ) {
      return 'Burn';
    }

    return 'Transfer';
  }

  private isSyntheticEventLogAccount(
    account: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    provider: string,
    expectedId: string,
  ): boolean {
    return (
      this.readOptionalScalarField(account, 'owner') === null &&
      this.readOptionalScalarField(account, 'provider') === provider &&
      this.readScalarField(account, 'id') === expectedId
    );
  }

  private compareNumericStrings(
    left: string | null,
    right: string | null,
  ): number {
    const leftValue = left === null ? Number.NEGATIVE_INFINITY : Number(left);
    const rightValue =
      right === null ? Number.NEGATIVE_INFINITY : Number(right);
    const leftValid = Number.isFinite(leftValue);
    const rightValid = Number.isFinite(rightValue);

    if (leftValid && rightValid && leftValue !== rightValue) {
      return leftValue - rightValue;
    }

    if (leftValid !== rightValid) {
      return leftValid ? 1 : -1;
    }

    return (left ?? '').localeCompare(right ?? '');
  }

  private addNumericStrings(
    left: string | null,
    right: string | null,
  ): string | null {
    if (left === null) {
      return right;
    }

    if (right === null) {
      return left;
    }

    const scale = Math.max(this.numericScale(left), this.numericScale(right));
    const factor = 10n ** BigInt(scale);
    const leftValue = this.parseScaledDecimal(left, scale);
    const rightValue = this.parseScaledDecimal(right, scale);
    const sum = leftValue + rightValue;
    const negative = sum < 0n;
    const absolute = negative ? -sum : sum;
    const whole = absolute / factor;
    const fractional = absolute % factor;

    if (scale === 0) {
      return `${negative ? '-' : ''}${whole.toString()}`;
    }

    return `${negative ? '-' : ''}${whole.toString()}.${fractional.toString().padStart(scale, '0')}`;
  }

  private numericScale(value: string): number {
    const normalized = value.trim();
    const decimalIndex = normalized.indexOf('.');
    return decimalIndex === -1 ? 0 : normalized.length - decimalIndex - 1;
  }

  private parseScaledDecimal(value: string, scale: number): bigint {
    const normalized = value.trim();
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [wholePart, fractionalPart = ''] = unsigned.split('.');
    const paddedFractional = `${fractionalPart}${'0'.repeat(scale)}`.slice(
      0,
      scale,
    );
    const digits = `${wholePart || '0'}${paddedFractional}`;
    const parsed = BigInt(digits || '0');

    return negative ? -parsed : parsed;
  }

  private normalizeUpdateId(updateId: string | null | undefined): string {
    if (typeof updateId !== 'string') {
      return '';
    }

    return updateId.startsWith('\\x') ? updateId.slice(2) : updateId;
  }

  private extractTokenMovement(
    templateId: string | null,
    decoded: NodeDecodeState<NodeDecodedDamlValue> | null,
  ): {
    tokenId: string;
    tokenName: string;
    sender: string | null;
    receiver: string | null;
    amount: string | null;
  } | null {
    if (
      !decoded ||
      decoded.status !== 'decoded' ||
      !this.isRecordValue(decoded.value)
    ) {
      return null;
    }

    if (templateId === CANTON_COIN_TRANSFER_TEMPLATE_ID) {
      const transferRecord = this.findRecordField(decoded.value, 'transfer');
      if (!transferRecord) {
        return null;
      }

      return {
        tokenId: CANTON_COIN_TOKEN_ID,
        tokenName: CANTON_COIN_TOKEN_NAME,
        sender: this.readScalarField(transferRecord, 'sender'),
        receiver: this.readScalarField(transferRecord, 'receiver'),
        amount: this.readScalarField(transferRecord, 'amount'),
      };
    }

    if (templateId === CANTON_COIN_AMULET_TEMPLATE_ID) {
      return {
        tokenId: CANTON_COIN_TOKEN_ID,
        tokenName: CANTON_COIN_TOKEN_NAME,
        sender: this.readScalarField(decoded.value, 'dso'),
        receiver: this.readScalarField(decoded.value, 'owner'),
        amount: this.readNestedScalarField(decoded.value, [
          'amount',
          'initialAmount',
        ]),
      };
    }

    if (templateId === CIP56_TRANSFER_TEMPLATE_ID) {
      const tokenSummary = this.extractCip56TokenSummary(decoded);
      if (!tokenSummary) {
        return null;
      }

      return {
        tokenId: tokenSummary.tokenId,
        tokenName: tokenSummary.name,
        sender: this.readScalarField(decoded.value, 'sender'),
        receiver: this.readScalarField(decoded.value, 'receiver'),
        amount: this.readScalarField(decoded.value, 'amount'),
      };
    }

    return null;
  }

  private extractCip56TokenSummary(
    decoded: NodeDecodeState<NodeDecodedDamlValue> | null,
  ): TokenSummary | null {
    if (
      !decoded ||
      decoded.status !== 'decoded' ||
      !this.isRecordValue(decoded.value)
    ) {
      return null;
    }

    const intrinsicId = this.readNestedScalarField(decoded.value, [
      'instrumentId',
      'id',
    ]);
    if (!intrinsicId) {
      return null;
    }

    const issuer = this.readNestedScalarField(decoded.value, [
      'instrumentId',
      'admin',
    ]);
    return this.buildObservedTokenSummary(
      intrinsicId,
      issuer,
      this.readConfiguredDecodedTokenMetadata(decoded.value, 'name') ??
        intrinsicId,
      this.readConfiguredDecodedTokenMetadata(decoded.value, 'symbol'),
    );
  }

  private extractObservedTokenSummary(
    templateId: string | null,
    decoded: NodeDecodeState<NodeDecodedDamlValue> | null,
  ): TokenSummary | null {
    if (!templateId) {
      return null;
    }

    if (this.isCip112TemplateId(templateId)) {
      return this.extractCip112TokenSummary(templateId, decoded);
    }

    return this.extractCip56TokenSummary(decoded);
  }

  private extractCip112TokenSummary(
    templateId: string | null,
    decoded: NodeDecodeState<NodeDecodedDamlValue> | null,
  ): TokenSummary | null {
    if (
      !decoded ||
      decoded.status !== 'decoded' ||
      !this.isRecordValue(decoded.value)
    ) {
      return null;
    }

    const configuredSymbol = this.readConfiguredDecodedTokenMetadata(
      decoded.value,
      'symbol',
    );
    const symbol =
      configuredSymbol ?? this.readScalarField(decoded.value, 'symbol');
    const instrumentIdText = this.readScalarField(
      decoded.value,
      'instrumentIdText',
    );
    const instrumentId = this.readNestedScalarField(decoded.value, [
      'instrumentId',
      'id',
    ]);
    const vaultIdentityId = this.readNestedScalarField(decoded.value, [
      'vaultIdentity',
      'id',
    ]);
    const shareLikeIntrinsicId =
      templateId !== null &&
      this.isShareLikeCip112Template(templateId) &&
      vaultIdentityId
        ? this.normalizeShareLikeIntrinsicTokenId(vaultIdentityId)
        : null;
    const intrinsicId =
      instrumentId ?? shareLikeIntrinsicId ?? symbol ?? instrumentIdText;
    if (!intrinsicId) {
      return null;
    }

    const issuer =
      this.readNestedScalarField(decoded.value, ['instrumentId', 'admin']) ??
      this.readNestedScalarField(decoded.value, ['vaultIdentity', 'admin']) ??
      this.readScalarField(decoded.value, 'vaultParty') ??
      this.readScalarField(decoded.value, 'issuer');
    return this.buildObservedTokenSummary(
      intrinsicId,
      issuer,
      this.readConfiguredDecodedTokenMetadata(decoded.value, 'name') ??
        this.readScalarField(decoded.value, 'name') ??
        instrumentIdText ??
        symbol ??
        intrinsicId,
      symbol,
    );
  }

  private buildObservedTokenSummary(
    intrinsicId: string,
    issuer: string | null,
    fallbackName: string,
    symbol: string | null,
  ): TokenSummary {
    if (this.isNativeAmuletIntrinsicId(intrinsicId)) {
      return {
        tokenId: CANTON_COIN_TOKEN_ID,
        name: CANTON_COIN_TOKEN_NAME,
        symbol: null,
        issuer: null,
        source: 'pqs',
      };
    }

    return {
      tokenId: this.buildObservedTokenId(intrinsicId, issuer),
      name: fallbackName,
      symbol,
      issuer,
      source: 'pqs',
    };
  }

  private buildObservedTokenId(
    intrinsicId: string,
    issuer: string | null,
  ): string {
    const normalizedIntrinsicId = intrinsicId.trim();
    const normalizedIssuer = issuer?.trim() ?? '';

    if (normalizedIssuer.length === 0) {
      return normalizedIntrinsicId;
    }

    return `${normalizedIssuer}::${normalizedIntrinsicId}`;
  }

  private isNativeAmuletIntrinsicId(intrinsicId: string): boolean {
    return intrinsicId.trim() === NATIVE_AMULET_INTRINSIC_ID;
  }

  private normalizeShareLikeIntrinsicTokenId(intrinsicId: string): string {
    const normalizedIntrinsicId = intrinsicId.trim();
    if (normalizedIntrinsicId.endsWith(':share')) {
      return normalizedIntrinsicId;
    }

    return `${normalizedIntrinsicId}:share`;
  }

  private readConfiguredDecodedTokenMetadata(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    field: 'name' | 'symbol',
  ): string | null {
    const keys =
      this.getTokenMetadataConfig()[
        field === 'name' ? 'nameKeys' : 'symbolKeys'
      ];

    for (const key of keys) {
      const metadataValue = this.readTextMapEntryField(
        value,
        ['meta', 'values'],
        key,
      );
      if (metadataValue) {
        return metadataValue;
      }
    }

    return null;
  }

  private getTokenMetadataConfig(): TokenMetadataConfig {
    return (
      this.nodeConfigService?.getTokenMetadataConfig() ?? {
        nameKeys: [...DEFAULT_TOKEN_METADATA_CONFIG.nameKeys],
        symbolKeys: [...DEFAULT_TOKEN_METADATA_CONFIG.symbolKeys],
      }
    );
  }

  private async fetchEventsByUpdateId(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    rawUpdateId: string,
  ): Promise<NodeUpdateDetailEvent[]> {
    const eventsByUpdateId = await this.fetchEventsByUpdateIds(node, query, [
      rawUpdateId,
    ]);
    return eventsByUpdateId.get(rawUpdateId) ?? [];
  }

  private async fetchEventsByUpdateIds(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    rawUpdateIds: string[],
  ): Promise<Map<string, NodeUpdateDetailEvent[]>> {
    if (rawUpdateIds.length === 0) {
      return new Map();
    }

    const result = await query(
      updateEventsByUpdateIdsQuery(node, rawUpdateIds),
    );
    const rows = (result.rows as UpdateEventRow[]) ?? [];
    const onlyRequestedUpdateId =
      rawUpdateIds.length === 1 ? rawUpdateIds[0] : null;
    const normalizedRows = await Promise.all(
      rows.map(async (row) => ({
        updateId:
          typeof row.update_id === 'string'
            ? row.update_id
            : onlyRequestedUpdateId,
        event: await this.normalizeEventRow(node, row),
      })),
    );
    const eventsByUpdateId = new Map<string, NodeUpdateDetailEvent[]>();

    for (const { updateId, event } of normalizedRows) {
      if (!updateId) {
        continue;
      }

      const existingEvents = eventsByUpdateId.get(updateId);
      if (existingEvents) {
        existingEvents.push(event);
      } else {
        eventsByUpdateId.set(updateId, [event]);
      }
    }

    return eventsByUpdateId;
  }

  private async fetchContractDetailsByIds(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    contractIds: string[],
  ): Promise<ContractDetailRow[]> {
    if (contractIds.length === 0) {
      return [];
    }

    const result = await query(contractDetailsQuery(node, contractIds));
    return (result.rows as ContractDetailRow[]) ?? [];
  }

  private shouldResolveRewardCoupon(events: NodeUpdateDetailEvent[]): boolean {
    return events.some((event) => event.choice === 'ReceiveSvRewardCoupon');
  }

  private async fetchRewardCouponDetails(
    node: NodeConfig,
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    rawUpdateId: string,
  ): Promise<NodeExerciseDecodeState | null> {
    try {
      const result = await query(rewardCouponInstanceQuery(node, rawUpdateId));
      const row = (result.rows as RewardCouponInstanceRow[])[0];

      if (!row) {
        return null;
      }

      const decoded = await this.decodeContractData(
        node,
        null,
        'Splice.Amulet:SvRewardCoupon',
        row.contract_instance,
      );
      if (
        !decoded ||
        decoded.status !== 'decoded' ||
        !this.isRecordValue(decoded.value)
      ) {
        return null;
      }

      return {
        argument: { status: 'not_available' },
        result: {
          status: 'decoded',
          value: {
            kind: 'record',
            fields:
              typeof row.coupon_contract_id === 'string'
                ? [
                    ...decoded.value.fields,
                    {
                      label: 'couponContractId',
                      value: {
                        kind: 'contract_id',
                        value: row.coupon_contract_id,
                      },
                    },
                  ]
                : decoded.value.fields,
          },
        },
      };
    } catch {
      return null;
    }
  }

  private extractRawUpdateId(row: UpdateDetailRow): string {
    if (typeof row.update_id === 'string') {
      return row.update_id;
    }

    const meta = row.meta;
    if (meta && typeof meta.update_id === 'string') {
      return meta.update_id;
    }

    throw new Error('Update metadata is missing update_id');
  }

  private extractEventOffset(row: UpdateMetaRow | UpdateDetailRow): string {
    if (typeof row.event_offset === 'string') {
      return row.event_offset;
    }

    if (typeof row.event_offset === 'number') {
      return String(row.event_offset);
    }

    const meta = 'meta' in row ? row.meta : null;
    if (meta && typeof meta.event_offset === 'string') {
      return meta.event_offset;
    }

    if (meta && typeof meta.event_offset === 'number') {
      return String(meta.event_offset);
    }

    throw new Error('Update metadata is missing event_offset');
  }

  private extractIsoRecordTime(row: UpdateDetailRow): string | null {
    if (typeof row.record_time_iso === 'string') {
      return row.record_time_iso;
    }

    return typeof row.record_time === 'string' ? row.record_time : null;
  }

  private extractMeta(row: UpdateDetailRow): NodeUpdateDetailMeta {
    if (row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)) {
      return row.meta as NodeUpdateDetailMeta;
    }

    const { record_time_iso: _recordTimeIso, ...meta } = row;
    return meta as unknown as NodeUpdateDetailMeta;
  }

  private async normalizeEventRow(
    node: NodeConfig,
    row: UpdateEventRow,
  ): Promise<NodeUpdateDetailEvent> {
    const templateId = this.normalizeTemplateIdentifier(row.template_id);
    const packageId = this.normalizePackageIdentifier(row.package_id ?? null);
    const rawChoice = typeof row.choice === 'string' ? row.choice : null;

    return {
      eventKind: row.event_kind,
      eventId: typeof row.event_id === 'string' ? row.event_id : null,
      contractId: typeof row.contract_id === 'string' ? row.contract_id : null,
      packageId,
      templateId,
      choice: this.normalizeChoiceIdentifier(row.choice),
      witnesses: this.normalizeParties(row.witnesses),
      createData:
        row.event_kind === 'create'
          ? await this.decodeContractData(
              node,
              packageId,
              templateId,
              row.contract_instance ?? null,
            )
          : null,
      exerciseData:
        row.event_kind === 'create'
          ? null
          : await this.decodeExerciseData(node, {
              packageId,
              templateId,
              rawChoice,
              exerciseArgument: row.exercise_argument ?? null,
              exerciseResult: row.exercise_result ?? null,
            }),
      raw:
        row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw)
          ? row.raw
          : {},
    };
  }

  private attachRewardCouponDetails(
    events: NodeUpdateDetailEvent[],
    exerciseData: NodeExerciseDecodeState | null,
  ): NodeUpdateDetailEvent[] {
    if (!exerciseData) {
      return events;
    }

    return events.map((event) =>
      event.choice === 'ReceiveSvRewardCoupon'
        ? {
            ...event,
            exerciseData: {
              argument: event.exerciseData?.argument ?? exerciseData.argument,
              result: exerciseData.result,
            },
          }
        : event,
    );
  }

  private decodeRewardCouponContractInstance(
    contractInstance: Buffer,
  ): NodeDecodeState<NodeDecodedDamlValue> | null {
    const contractPayload = this.getFirstLengthDelimitedField(
      contractInstance,
      2,
    );
    const createArgument = contractPayload
      ? this.getFirstLengthDelimitedField(contractPayload, 4)
      : null;
    const rewardCouponRecord = createArgument
      ? this.getFirstLengthDelimitedField(createArgument, 13)
      : null;
    const fields = rewardCouponRecord
      ? this.getAllLengthDelimitedFields(rewardCouponRecord, 1)
      : [];

    if (fields.length < 5) {
      return null;
    }

    const rewardRound = this.unwrapScalarVarint(fields.at(-2) ?? null);
    const rewardAmount = this.unwrapScalarVarint(fields.at(-1) ?? null);

    if (rewardRound === null || rewardAmount === null) {
      return null;
    }

    return {
      status: 'decoded',
      value: {
        kind: 'record',
        fields: [
          { label: 'rewardRound', value: rewardRound },
          { label: 'rewardAmount', value: rewardAmount },
        ],
      },
    };
  }

  private async decodeContractData(
    node: NodeConfig | null,
    packageId: string | null,
    templateId: string | null,
    contractInstance: unknown,
  ): Promise<NodeDecodeState<NodeDecodedDamlValue> | null> {
    if (
      !templateId ||
      contractInstance === null ||
      contractInstance === undefined
    ) {
      return null;
    }

    if (!Buffer.isBuffer(contractInstance)) {
      const decodedJson = this.decodePqsJsonData(contractInstance);
      if (decodedJson) {
        return this.attachDecodedType(
          decodedJson,
          await this.resolveTemplateTypeNode(packageId, templateId),
        );
      }
    }

    if (
      templateId === 'Splice.Amulet:SvRewardCoupon' &&
      Buffer.isBuffer(contractInstance)
    ) {
      return this.decodeRewardCouponContractInstance(contractInstance);
    }

    if (!Buffer.isBuffer(contractInstance) || !this.damlValueDecoder) {
      return null;
    }

    const initialDecode = await this.damlValueDecoder.decodeContractInstance({
      packageId,
      templateId,
      contractInstance,
    });
    return this.retryContractDecodeAfterPackageRefresh(
      node,
      packageId,
      templateId,
      contractInstance,
      initialDecode,
    );
  }

  private async decodeExerciseData(
    node: NodeConfig | null,
    input: {
      packageId: string | null;
      templateId: string | null;
      rawChoice: string | null;
      exerciseArgument: unknown;
      exerciseResult: unknown;
    },
  ): Promise<NodeExerciseDecodeState | null> {
    if (
      !Buffer.isBuffer(input.exerciseArgument) &&
      !Buffer.isBuffer(input.exerciseResult)
    ) {
      const argument = this.decodePqsJsonData(input.exerciseArgument);
      const result = this.decodePqsJsonData(input.exerciseResult);
      const schemas = await this.resolveExerciseTypeNodes(input);

      if (argument || result) {
        return {
          argument: argument
            ? this.attachDecodedType(argument, schemas?.argument ?? null)
            : { status: 'not_available' },
          result: result
            ? this.attachDecodedType(result, schemas?.result ?? null)
            : { status: 'not_available' },
        };
      }
    }

    if (!this.damlValueDecoder) {
      return null;
    }

    if (
      (input.exerciseArgument !== null &&
        input.exerciseArgument !== undefined &&
        !Buffer.isBuffer(input.exerciseArgument)) ||
      (input.exerciseResult !== null &&
        input.exerciseResult !== undefined &&
        !Buffer.isBuffer(input.exerciseResult))
    ) {
      return null;
    }

    const decoderInput = {
      ...input,
      exerciseArgument: input.exerciseArgument ?? null,
      exerciseResult: input.exerciseResult ?? null,
    };
    const initialDecode =
      await this.damlValueDecoder.decodeExerciseValue(decoderInput);
    return this.retryExerciseDecodeAfterPackageRefresh(
      node,
      decoderInput,
      initialDecode,
    );
  }

  private async retryContractDecodeAfterPackageRefresh(
    node: NodeConfig | null,
    packageId: string | null,
    templateId: string | null,
    contractInstance: Buffer | null,
    initialDecode: NodeDecodeState<NodeDecodedDamlValue> | null,
  ): Promise<NodeDecodeState<NodeDecodedDamlValue> | null> {
    const reason =
      initialDecode?.status === 'invalid_data' ? initialDecode.reason : null;
    if (!this.shouldRetryPackageRefresh(node, packageId, reason)) {
      return initialDecode;
    }

    await this.refreshPackageForNode(node!, packageId!);
    return (
      this.damlValueDecoder?.decodeContractInstance({
        packageId,
        templateId,
        contractInstance,
      }) ?? initialDecode
    );
  }

  private async retryExerciseDecodeAfterPackageRefresh(
    node: NodeConfig | null,
    input: {
      packageId: string | null;
      templateId: string | null;
      rawChoice: string | null;
      exerciseArgument: Buffer | null;
      exerciseResult: Buffer | null;
    },
    initialDecode: NodeExerciseDecodeState | null,
  ): Promise<NodeExerciseDecodeState | null> {
    const reason = this.extractPackageRefreshReason(initialDecode);
    if (!this.shouldRetryPackageRefresh(node, input.packageId, reason)) {
      return initialDecode;
    }

    await this.refreshPackageForNode(node!, input.packageId!);
    return this.damlValueDecoder?.decodeExerciseValue(input) ?? initialDecode;
  }

  private extractPackageRefreshReason(
    decoded: NodeExerciseDecodeState | null,
  ): NodeDecodeFailureReason | null {
    const reasons = [
      decoded?.argument.status === 'invalid_data'
        ? decoded.argument.reason
        : null,
      decoded?.result.status === 'invalid_data' ? decoded.result.reason : null,
    ];

    return (
      reasons.find(
        (reason): reason is NodeDecodeFailureReason => reason !== null,
      ) ?? null
    );
  }

  private shouldRetryPackageRefresh(
    node: NodeConfig | null,
    packageId: string | null,
    reason: NodeDecodeFailureReason | null,
  ): boolean {
    return Boolean(
      node &&
      packageId &&
      this.packageSyncService &&
      (reason === 'missing_package' || reason === 'invalid_package'),
    );
  }

  private async refreshPackageForNode(
    node: NodeConfig,
    packageId: string,
  ): Promise<void> {
    await this.packageSyncService?.syncPackagesById(node, [packageId]);
    this.packageRegistryService?.invalidatePackage(packageId);
  }

  private normalizePackageIdentifier(packageId: string | null): string | null {
    if (typeof packageId !== 'string') {
      return null;
    }

    return packageId.replace(/^i\|/, '');
  }

  private decodeKnownContractData(
    templateId: string | null,
    contractInstance: Buffer | null,
  ): NodeDecodeState<NodeDecodedDamlValue> | null {
    if (!Buffer.isBuffer(contractInstance) || !templateId) {
      return null;
    }

    if (templateId === 'Splice.Amulet:SvRewardCoupon') {
      return this.decodeRewardCouponContractInstance(contractInstance);
    }

    return null;
  }

  private isRecordValue(
    value: NodeDecodedDamlValue,
  ): value is Extract<NodeDecodedDamlValue, { kind: 'record' }> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'kind' in value &&
      value.kind === 'record'
    );
  }

  private findRecordField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): Extract<NodeDecodedDamlValue, { kind: 'record' }> | null {
    const field = value.fields.find(
      (candidate) => candidate.label === label,
    )?.value;
    return field && this.isRecordValue(field) ? field : null;
  }

  private readScalarField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): string | null {
    const field = value.fields.find(
      (candidate) => candidate.label === label,
    )?.value;
    if (field === null || field === undefined) {
      return null;
    }

    if (
      typeof field === 'string' ||
      typeof field === 'number' ||
      typeof field === 'boolean'
    ) {
      return String(field);
    }

    if (
      typeof field === 'object' &&
      field !== null &&
      'kind' in field &&
      field.kind === 'contract_id'
    ) {
      return field.value;
    }

    return null;
  }

  private readTrafficPurchaseField(
    decoded: NodeExerciseDecodeState | null,
    label: string,
    source: 'argument' | 'result' = 'result',
  ): string | null {
    const decodedValue =
      source === 'argument' ? decoded?.argument : decoded?.result;
    if (
      !decodedValue ||
      decodedValue.status !== 'decoded' ||
      !this.isRecordValue(decodedValue.value)
    ) {
      return null;
    }

    const normalizedLabel = label.replace(/[_-]/g, '').toLowerCase();
    const field = decodedValue.value.fields.find(
      (candidate) =>
        candidate.label.replace(/[_-]/g, '').toLowerCase() === normalizedLabel,
    )?.value;

    if (
      typeof field === 'string' ||
      typeof field === 'number' ||
      typeof field === 'boolean'
    ) {
      return String(field);
    }

    return null;
  }

  private readNestedScalarField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    path: string[],
  ): string | null {
    let current: NodeDecodedDamlValue | null = value;

    for (let index = 0; index < path.length; index += 1) {
      if (!current || !this.isRecordValue(current)) {
        return null;
      }

      const field: NodeDecodedDamlValue | undefined = current.fields.find(
        (candidate) => candidate.label === path[index],
      )?.value;
      if (field === undefined) {
        return null;
      }

      if (index === path.length - 1) {
        if (
          typeof field === 'string' ||
          typeof field === 'number' ||
          typeof field === 'boolean'
        ) {
          return String(field);
        }

        if (
          typeof field === 'object' &&
          field !== null &&
          'kind' in field &&
          field.kind === 'contract_id'
        ) {
          return field.value;
        }

        return null;
      }

      current = field;
    }

    return null;
  }

  private readOptionalScalarField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): string | null {
    const field = value.fields.find(
      (candidate) => candidate.label === label,
    )?.value;
    if (field === null || field === undefined) {
      return null;
    }

    if (
      typeof field === 'string' ||
      typeof field === 'number' ||
      typeof field === 'boolean'
    ) {
      return String(field);
    }

    if (
      typeof field === 'object' &&
      field !== null &&
      'kind' in field &&
      field.kind === 'contract_id'
    ) {
      return field.value;
    }

    if (
      typeof field !== 'object' ||
      !('kind' in field) ||
      field.kind !== 'optional'
    ) {
      return null;
    }

    const innerValue = field.value;
    if (
      typeof innerValue === 'string' ||
      typeof innerValue === 'number' ||
      typeof innerValue === 'boolean'
    ) {
      return String(innerValue);
    }

    if (
      typeof innerValue === 'object' &&
      innerValue !== null &&
      'kind' in innerValue &&
      innerValue.kind === 'contract_id'
    ) {
      return innerValue.value;
    }

    return null;
  }

  private readConstructorField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): string | null {
    const field = value.fields.find(
      (candidate) => candidate.label === label,
    )?.value;
    if (field === null || field === undefined) {
      return null;
    }

    if (
      typeof field === 'string' ||
      typeof field === 'number' ||
      typeof field === 'boolean'
    ) {
      return String(field);
    }

    if (typeof field !== 'object' || !('kind' in field)) {
      return null;
    }

    if (field.kind === 'enum') {
      return field.constructor;
    }

    if (field.kind === 'variant') {
      return field.constructor;
    }

    return null;
  }

  private readListField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): NodeDecodedDamlValue[] {
    const field = value.fields.find(
      (candidate) => candidate.label === label,
    )?.value;
    if (
      !field ||
      typeof field !== 'object' ||
      !('kind' in field) ||
      field.kind !== 'list'
    ) {
      return [];
    }

    return field.items;
  }

  private readAccountParty(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
  ): string | null {
    return (
      this.readOptionalScalarField(value, 'owner') ??
      this.readOptionalScalarField(value, 'provider')
    );
  }

  private readTextMapEntryField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    path: string[],
    key: string,
  ): string | null {
    let current: NodeDecodedDamlValue | null = value;

    for (const segment of path) {
      if (!current || !this.isRecordValue(current)) {
        return null;
      }

      const field: NodeDecodedDamlValue | undefined = current.fields.find(
        (candidate) => candidate.label === segment,
      )?.value;
      if (field === undefined) {
        return null;
      }

      current = field;
    }

    if (current && this.isRecordValue(current)) {
      const recordEntry = current.fields.find(
        (candidate) => candidate.label === key,
      )?.value;
      if (
        typeof recordEntry === 'string' ||
        typeof recordEntry === 'number' ||
        typeof recordEntry === 'boolean'
      ) {
        return String(recordEntry);
      }
    }

    if (
      !current ||
      typeof current !== 'object' ||
      !('kind' in current) ||
      current.kind !== 'text_map'
    ) {
      return null;
    }

    const entry = current.entries.find(
      (candidate) => candidate.key === key,
    )?.value;
    if (entry === null || entry === undefined) {
      return null;
    }

    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      return String(entry);
    }

    if (
      typeof entry === 'object' &&
      entry !== null &&
      'kind' in entry &&
      entry.kind === 'contract_id'
    ) {
      return entry.value;
    }

    return null;
  }

  private decodePqsJsonData(
    value: unknown,
  ): NodeDecodeState<NodeDecodedDamlValue> | null {
    const decoded = this.decodePqsJsonValue(value);
    return decoded === null
      ? null
      : {
          status: 'decoded',
          value: decoded,
        };
  }

  private attachDecodedType<T>(
    state: NodeDecodeState<T>,
    type: PackageTypeNode | null,
  ): NodeDecodeState<T> {
    return state.status === 'decoded' && type ? { ...state, type } : state;
  }

  private async resolveTemplateTypeNode(
    packageId: string | null,
    templateId: string | null,
  ): Promise<PackageTypeNode | null> {
    if (!this.packageRegistryService || !packageId || !templateId) {
      return null;
    }

    try {
      const templateResult = await this.packageRegistryService.resolveTemplate({
        packageId,
        templateId,
      });

      return templateResult.ok
        ? this.packageRegistryService.buildTemplateTypeNode(
            templateResult.definition,
          )
        : null;
    } catch {
      return null;
    }
  }

  private async resolveExerciseTypeNodes(input: {
    packageId: string | null;
    templateId: string | null;
    rawChoice: string | null;
  }): Promise<{
    argument: PackageTypeNode | null;
    result: PackageTypeNode | null;
  } | null> {
    if (
      !this.packageRegistryService ||
      !input.packageId ||
      !input.templateId ||
      !input.rawChoice
    ) {
      return null;
    }

    const rawChoice = input.rawChoice.replace(/^c\|/, '');
    if (!rawChoice) {
      return null;
    }

    try {
      const shortChoice =
        this.normalizeChoiceIdentifier(rawChoice) ?? rawChoice;
      const templateName = input.templateId.split(':').at(-1);
      const choices = [
        rawChoice,
        templateName ? `${templateName}_${shortChoice}` : null,
        shortChoice,
      ].filter(
        (candidate, index, all): candidate is string =>
          Boolean(candidate) && all.indexOf(candidate) === index,
      );

      let choiceResult: Awaited<
        ReturnType<PackageRegistryService['resolveChoice']>
      > | null = null;
      for (const choice of choices) {
        const result = await this.packageRegistryService.resolveChoice({
          packageId: input.packageId,
          templateId: input.templateId,
          choice,
        });
        if (result.ok) {
          choiceResult = result;
          break;
        }
      }

      if (!choiceResult) {
        return null;
      }

      const packageRef = choiceResult.definition.template.packageRef;
      return {
        argument: this.packageRegistryService.buildTypeNodeForType(
          packageRef,
          choiceResult.definition.templateChoice.argBinder?.type,
        ),
        result: this.packageRegistryService.buildTypeNodeForType(
          packageRef,
          choiceResult.definition.templateChoice.retType,
        ),
      };
    } catch {
      return null;
    }
  }

  private decodePqsJsonValue(value: unknown): NodeDecodedDamlValue | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return {
        kind: 'list',
        items: value
          .map((item) => this.decodePqsJsonValue(item))
          .filter((item): item is NodeDecodedDamlValue => item !== null),
      };
    }

    if (!this.isPlainJsonObject(value)) {
      return null;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return { kind: 'unit' };
    }

    if (
      entries.length === 1 &&
      entries[0][0] === 'number' &&
      (typeof entries[0][1] === 'string' || typeof entries[0][1] === 'number')
    ) {
      const numericValue = Number(entries[0][1]);
      return Number.isFinite(numericValue)
        ? numericValue
        : String(entries[0][1]);
    }

    return {
      kind: 'record',
      fields: entries.map(([label, fieldValue]) => ({
        label,
        value: this.decodePqsJsonValue(fieldValue) ?? { kind: 'unit' },
      })),
    };
  }

  private isPlainJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getFirstLengthDelimitedField(
    message: Buffer,
    fieldNumber: number,
  ): Buffer | null {
    return (
      this.parseProtobufFields(message).find(
        (field) => field.fieldNumber === fieldNumber && field.buffer,
      )?.buffer ?? null
    );
  }

  private getAllLengthDelimitedFields(
    message: Buffer,
    fieldNumber: number,
  ): Buffer[] {
    return this.parseProtobufFields(message)
      .filter(
        (field): field is { fieldNumber: number; buffer: Buffer } =>
          field.fieldNumber === fieldNumber && Boolean(field.buffer),
      )
      .map((field) => field.buffer);
  }

  private unwrapScalarVarint(message: Buffer | null): number | null {
    let current = message;

    while (current) {
      const fields = this.parseProtobufFields(current);
      if (fields.length !== 1) {
        return null;
      }

      const [field] = fields;
      if (typeof field.value === 'number') {
        return field.value;
      }

      current = field.buffer ?? null;
    }

    return null;
  }

  private parseProtobufFields(message: Buffer): Array<{
    fieldNumber: number;
    buffer?: Buffer;
    value?: number;
  }> {
    const fields: Array<{
      fieldNumber: number;
      buffer?: Buffer;
      value?: number;
    }> = [];
    let offset = 0;

    while (offset < message.length) {
      const tag = this.readVarint(message, offset);
      offset = tag.next;

      const fieldNumber = Number(tag.value >> 3n);
      const wireType = Number(tag.value & 0x07n);

      if (wireType === 0) {
        const value = this.readVarint(message, offset);
        offset = value.next;
        fields.push({ fieldNumber, value: Number(value.value) });
        continue;
      }

      if (wireType === 2) {
        const length = this.readVarint(message, offset);
        offset = length.next;
        const end = offset + Number(length.value);
        if (end > message.length) {
          break;
        }

        fields.push({ fieldNumber, buffer: message.subarray(offset, end) });
        offset = end;
        continue;
      }

      if (wireType === 1) {
        offset += 8;
        continue;
      }

      if (wireType === 5) {
        offset += 4;
        continue;
      }

      break;
    }

    return fields;
  }

  private readVarint(
    buffer: Buffer,
    offset: number,
  ): { value: bigint; next: number } {
    let value = 0n;
    let shift = 0n;
    let next = offset;

    while (next < buffer.length) {
      const byte = BigInt(buffer[next]);
      value |= (byte & 0x7fn) << shift;
      next += 1;

      if ((byte & 0x80n) === 0n) {
        return { value, next };
      }

      shift += 7n;
    }

    return { value, next };
  }

  private async buildTemplateFilterResponse(
    packageIds: string[],
  ): Promise<TemplateFilterResponse> {
    const packageMetadata = new Map(
      (this.packageCacheService?.listPackages() ?? []).map((packageRef) => [
        packageRef.packageId,
        packageRef,
      ]),
    );
    const templates = new Map<
      string,
      TemplateFilterResponse['templates'][number]
    >();

    for (const packageId of packageIds) {
      const inspection = this.packageRegistryService
        ? await this.packageRegistryService.inspectPackage(packageId)
        : { ok: false as const, reason: 'missing_package' as const };

      if (!inspection.ok) {
        continue;
      }

      for (const template of inspection.definition.templates) {
        if (template.templateId.trim()) {
          const metadata = packageMetadata.get(packageId);
          templates.set(`${packageId}:${template.templateId}`, {
            templateId: template.templateId,
            packageId,
            packageName: metadata?.name ?? null,
            packageVersion: metadata?.version ?? null,
          });
        }
      }
    }

    return {
      templates: Array.from(templates.values()).sort(
        (left, right) =>
          left.templateId.localeCompare(right.templateId) ||
          left.packageId.localeCompare(right.packageId),
      ),
    };
  }

  private normalizeOptionalScalar(
    value: string | number | null | undefined,
  ): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private async fetchNamespaceTopologyByNode(
    nodes: NodeConfig[],
    observedNodeIds: string[],
    partiesById: Map<string, Set<string>>,
  ): Promise<NamespaceDetailResponse['topologyByNode']> {
    const grpcOperationsService = this.grpcOperationsService;
    if (!grpcOperationsService) {
      return [];
    }

    const observedNodeIdSet = new Set(observedNodeIds);
    const topologyEntries = await Promise.all(
      nodes
        .filter((node) => observedNodeIdSet.has(node.id))
        .map(async (node) => {
          if (node.mode !== 'pqs_with_grpc') {
            return {
              nodeId: node.id,
              label: node.label,
              status: 'grpc_not_configured' as const,
              errorMessage: null,
              partyToParticipants: [],
              partyToKeyMappings: [],
            };
          }

          const nodeParties = Array.from(partiesById.entries())
            .filter(([, nodeIds]) => nodeIds.has(node.id))
            .map(([partyId]) => partyId);

          return this.mergeNamespaceNodeTopologies(
            node,
            await Promise.all(
              nodeParties.map(async (partyId) =>
                grpcOperationsService.fetchPartyTopology(node, partyId),
              ),
            ),
          );
        }),
    );

    return topologyEntries.sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }

  private mergeNamespaceNodeTopologies(
    node: NodeConfig,
    topologies: PartyDetailResponse['partyTopologyByNode'],
  ): PartyDetailResponse['partyTopologyByNode'][number] {
    const successfulTopologies = topologies.filter(
      (entry) => entry.status === 'ok',
    );
    if (successfulTopologies.length > 0) {
      return {
        nodeId: node.id,
        label: node.label,
        status: 'ok',
        errorMessage: null,
        partyToParticipants: this.dedupePartyTopologyParticipants(
          successfulTopologies.flatMap((entry) => entry.partyToParticipants),
        ),
        partyToKeyMappings: this.dedupePartyTopologyKeys(
          successfulTopologies.flatMap((entry) => entry.partyToKeyMappings),
        ),
      };
    }

    const grpcError = topologies.find((entry) => entry.status === 'grpc_error');
    if (grpcError) {
      return {
        nodeId: node.id,
        label: node.label,
        status: 'grpc_error',
        errorMessage: grpcError.errorMessage,
        partyToParticipants: [],
        partyToKeyMappings: [],
      };
    }

    return {
      nodeId: node.id,
      label: node.label,
      status: 'grpc_not_configured',
      errorMessage: null,
      partyToParticipants: [],
      partyToKeyMappings: [],
    };
  }

  private dedupePartyTopologyParticipants(
    participants: PartyDetailResponse['partyTopologyByNode'][number]['partyToParticipants'],
  ): PartyDetailResponse['partyTopologyByNode'][number]['partyToParticipants'] {
    const deduped = new Map<
      string,
      PartyDetailResponse['partyTopologyByNode'][number]['partyToParticipants'][number]
    >();

    for (const participant of participants) {
      const key = [
        participant.participantId ?? '',
        participant.participantUid ?? '',
        participant.permission ?? '',
        participant.threshold ?? '',
        participant.synchronizerIds.join('|'),
      ].join('::');

      if (!deduped.has(key)) {
        deduped.set(key, participant);
      }
    }

    return Array.from(deduped.values());
  }

  private dedupePartyTopologyKeys(
    keyMappings: PartyDetailResponse['partyTopologyByNode'][number]['partyToKeyMappings'],
  ): PartyDetailResponse['partyTopologyByNode'][number]['partyToKeyMappings'] {
    const deduped = new Map<
      string,
      PartyDetailResponse['partyTopologyByNode'][number]['partyToKeyMappings'][number]
    >();

    for (const keyMapping of keyMappings) {
      const key = [
        keyMapping.keyFingerprint ?? '',
        keyMapping.publicKey ?? '',
        keyMapping.purpose ?? '',
        keyMapping.keyType ?? '',
        keyMapping.keyFormat ?? '',
        keyMapping.keySpec ?? '',
        keyMapping.threshold ?? '',
        keyMapping.synchronizerIds.join('|'),
      ].join('::');

      if (!deduped.has(key)) {
        deduped.set(key, keyMapping);
      }
    }

    return Array.from(deduped.values());
  }

  private extractNamespaceIdentifier(partyId: string): string | null {
    const normalizedPartyId = this.normalizePartyIdentifier(partyId);
    const separatorIndex = normalizedPartyId.lastIndexOf('::');

    if (separatorIndex < 0) {
      return null;
    }

    const namespaceId = normalizedPartyId.slice(separatorIndex + 2).trim();
    return namespaceId.length > 0 ? namespaceId : null;
  }

  private paginateNamespacePartyIds(
    partyIds: string[],
    options: {
      limit: number;
      before?: string;
      after?: string;
    },
  ): {
    items: string[];
    nextBefore: string | null;
    nextAfter: string | null;
  } {
    const limit = Math.max(1, Math.trunc(options.limit));

    if (options.after) {
      const endIndex = partyIds.findIndex((value) => value === options.after);
      const normalizedEndIndex = endIndex >= 0 ? endIndex : partyIds.length;
      const startIndex = Math.max(0, normalizedEndIndex - limit);
      const items = partyIds.slice(startIndex, normalizedEndIndex);

      return {
        items,
        nextBefore:
          normalizedEndIndex < partyIds.length && items.length > 0
            ? (items[items.length - 1] ?? null)
            : null,
        nextAfter:
          startIndex > 0 && items.length > 0 ? (items[0] ?? null) : null,
      };
    }

    const startIndex = options.before
      ? (() => {
          const index = partyIds.findIndex((value) => value === options.before);
          return index >= 0 ? index + 1 : 0;
        })()
      : 0;
    const items = partyIds.slice(startIndex, startIndex + limit);

    return {
      items,
      nextBefore:
        startIndex + limit < partyIds.length && items.length > 0
          ? (items[items.length - 1] ?? null)
          : null,
      nextAfter: startIndex > 0 && items.length > 0 ? (items[0] ?? null) : null,
    };
  }

  private normalizeTemplateIdentifier(
    templateId: string | null,
  ): string | null {
    if (typeof templateId !== 'string') {
      return null;
    }

    return templateId.replace(/^t\|#[^:]+:/, '');
  }

  private normalizeChoiceIdentifier(choice: string | null): string | null {
    if (typeof choice !== 'string') {
      return null;
    }

    const normalized = choice.replace(/^c\|/, '');
    const separatorIndex = normalized.lastIndexOf('_');

    return separatorIndex >= 0
      ? normalized.slice(separatorIndex + 1)
      : normalized;
  }

  private normalizeParties(parties: string[] | string | null): string[] {
    if (Array.isArray(parties)) {
      return parties
        .filter((party): party is string => typeof party === 'string')
        .map((party) => this.normalizePartyIdentifier(party))
        .filter(Boolean);
    }

    if (typeof parties !== 'string') {
      return [];
    }

    const trimmed = parties.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return trimmed ? [trimmed] : [];
    }

    return trimmed
      .slice(1, -1)
      .split(',')
      .map((party) =>
        this.normalizePartyIdentifier(party.trim().replace(/^"(.*)"$/, '$1')),
      )
      .filter(Boolean);
  }

  private normalizePartyIdentifier(party: string): string {
    const trimmed = party.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.replace(/^p\|/, '');
  }

  private defaultRow(): SummaryRow {
    return {
      pqs_database: 'unknown',
      active_contract_count: 0,
      latest_offset: null,
      latest_event_at: null,
      total_update_count: 0,
    };
  }
}
