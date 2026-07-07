import { Injectable, Optional } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import { NodeConfigService } from '../config/node-config.service';
import type {
  ActivePartiesResponse,
  GlobalContractsResponse,
  GlobalRecentUpdatesResponse,
  NodeContractsResponse,
  NodeContractDetailResponse,
  NodePackagesResponse,
  PartyDetailResponse,
  LedgerSummary,
  NodeDecodeState,
  NodeDecodedDamlValue,
  NodeExerciseDecodeState,
  PackageDetailResponse,
  PackageFamilyResponse,
  NodeUpdateDetailEvent,
  NodeUpdateDetailMeta,
  NodeUpdateDetailResponse,
  NodeRecentUpdate,
  NodeRecentUpdatesResponse,
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
import { PqsClientFactory } from './pqs-client.factory';
import { DamlValueDecoderService } from '../packages/daml-value-decoder.service';
import { PackageCacheService } from '../packages/package-cache.service';
import { PackageRegistryService } from '../packages/package-registry.service';
import { GrpcOperationsService } from '../grpc/grpc-operations.service';

interface SummaryRow {
  pqs_database: string;
  active_contract_count: number | string | null;
  latest_offset: string | null;
  latest_event_at: string | null;
  total_update_count: number | string | null;
}

interface UpdateMetaRow {
  update_id: string;
  event_offset?: string | number | null;
  record_time: string | null;
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
  meta?: Record<string, unknown> | null;
  [key: string]: unknown;
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
  event_kind: 'create' | 'consuming_exercise' | 'non_consuming_exercise';
  event_id: string | null;
  contract_id: string | null;
  template_id: string | null;
  package_id?: string | null;
  choice: string | null;
  witnesses: string[] | string | null;
  contract_instance?: Buffer | null;
  exercise_argument?: Buffer | null;
  exercise_result?: Buffer | null;
  raw: Record<string, unknown> | null;
}

interface RewardCouponInstanceRow {
  coupon_contract_id: string | null;
  contract_instance: Buffer | null;
}

interface ContractDetailRow {
  contract_id: string;
  template_id: string | null;
  package_id: string | null;
  contract_instance: Buffer | null;
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
}

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
  contract_instance: Buffer | null;
}

interface NodeTokenTransferObservation {
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

interface CachedNodeTokenTransfers {
  cachedAt: number;
  transfers: NodeTokenTransferObservation[];
}

interface CachedNodeObservedTokens {
  cachedAt: number;
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

const SEARCH_GROUP_LIMIT = 25;
const CANTON_COIN_TOKEN_ID = 'canton-coin';
const CANTON_COIN_TOKEN_NAME = 'Canton Coin';
const CANTON_COIN_TRANSFER_TEMPLATE_ID =
  'Splice.AmuletTransferInstruction:AmuletTransferInstruction';
const CANTON_COIN_AMULET_TEMPLATE_ID = 'Splice.Amulet:Amulet';
const CIP56_HOLDING_TEMPLATE_ID = 'Splice.Api.Token.HoldingV1:Holding';
const CIP56_TRANSFER_TEMPLATE_ID = 'Splice.Api.Token.TransferInstructionV1:Transfer';
const TOKEN_DISCOVERY_TEMPLATE_IDS = [
  CANTON_COIN_TRANSFER_TEMPLATE_ID,
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_HOLDING_TEMPLATE_ID,
  CIP56_TRANSFER_TEMPLATE_ID,
] as const;
const TOKEN_HOLDER_TEMPLATE_IDS = [
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_HOLDING_TEMPLATE_ID,
] as const;
const TOKEN_TRANSFER_TEMPLATE_IDS = [
  CANTON_COIN_TRANSFER_TEMPLATE_ID,
  CANTON_COIN_AMULET_TEMPLATE_ID,
  CIP56_TRANSFER_TEMPLATE_ID,
] as const;
const TOKEN_TRANSFER_CACHE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TRANSFER_CACHE_LIMIT = 250;

const ACTIVE_QUERY = `
  select
    current_database() as pqs_database,
    count(*)::int as active_contract_count,
    max(created_at_offset) as latest_offset,
    max(created_effective_at)::text as latest_event_at,
    (
      select count(*)::int
      from participant.lapi_update_meta
    ) as total_update_count
  from active()
`;

function compareGlobalMergedUpdates(left: GlobalUpdateCursor, right: GlobalUpdateCursor): number {
  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (leftHasRecordTime && rightHasRecordTime && leftRecordTimeMs !== rightRecordTimeMs) {
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
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<GlobalUpdateCursor>;

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

function compareGlobalMergedContracts(left: GlobalContractCursor, right: GlobalContractCursor): number {
  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (leftHasRecordTime && rightHasRecordTime && leftRecordTimeMs !== rightRecordTimeMs) {
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

function decodeGlobalContractCursor(cursor?: string): GlobalContractCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<GlobalContractCursor>;

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

function compareSearchUpdates(left: SearchMatchedUpdate, right: SearchMatchedUpdate): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  const leftRecordTimeMs = Date.parse(left.recordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.recordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (leftHasRecordTime && rightHasRecordTime && leftRecordTimeMs !== rightRecordTimeMs) {
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

function compareSearchContracts(left: SearchMatchedContract, right: SearchMatchedContract): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  const leftRecordTimeMs = Date.parse(left.createdRecordTime ?? '');
  const rightRecordTimeMs = Date.parse(right.createdRecordTime ?? '');
  const leftHasRecordTime = Number.isFinite(leftRecordTimeMs);
  const rightHasRecordTime = Number.isFinite(rightRecordTimeMs);

  if (leftHasRecordTime && rightHasRecordTime && leftRecordTimeMs !== rightRecordTimeMs) {
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

  if (leftHasRecordTime && rightHasRecordTime && leftRecordTimeMs !== rightRecordTimeMs) {
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

  return (right.amount ?? '').localeCompare(left.amount ?? '');
}

function encodeGlobalTokenTransferCursor(transfer: GlobalTokenTransferCursor): string {
  return Buffer.from(
    JSON.stringify({
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

function decodeGlobalTokenTransferCursor(cursor?: string): GlobalTokenTransferCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalTokenTransferCursor>;

    if (
      (decoded.recordTime === null || typeof decoded.recordTime === 'string') &&
      typeof decoded.updateId === 'string' &&
      typeof decoded.tokenId === 'string' &&
      (decoded.amount === null || typeof decoded.amount === 'string') &&
      (decoded.sender === null || typeof decoded.sender === 'string') &&
      (decoded.receiver === null || typeof decoded.receiver === 'string')
    ) {
      return {
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
  const leftValue = left.amount === null ? Number.NEGATIVE_INFINITY : Number(left.amount);
  const rightValue = right.amount === null ? Number.NEGATIVE_INFINITY : Number(right.amount);
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

function encodeGlobalTokenHolderCursor(holder: GlobalTokenHolderCursor): string {
  return Buffer.from(
    JSON.stringify({
      partyId: holder.partyId,
      amount: holder.amount,
    } satisfies GlobalTokenHolderCursor),
    'utf8',
  ).toString('base64url');
}

function decodeGlobalTokenHolderCursor(cursor?: string): GlobalTokenHolderCursor | null {
  if (!cursor || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<GlobalTokenHolderCursor>;

    if (typeof decoded.partyId === 'string' && (decoded.amount === null || typeof decoded.amount === 'string')) {
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

function compareSearchParties(left: SearchMatchedParty, right: SearchMatchedParty): number {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }

  return left.partyId.localeCompare(right.partyId);
}

function compareSearchPackageIds(left: SearchMatchedPackageId, right: SearchMatchedPackageId): number {
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

const PARTICIPANT_FALLBACK_QUERY = `
  select
    current_database() as pqs_database,
    (
      select count(*)::int
      from participant.par_active_contracts
    ) as active_contract_count,
    (
      select max(event_offset)::text
      from participant.lapi_update_meta
    ) as latest_offset,
    (
      select to_char(
        to_timestamp(max(record_time) / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
      from participant.lapi_update_meta
    ) as latest_event_at,
    (
      select count(*)::int
      from participant.lapi_update_meta
    ) as total_update_count
`;

function activityBucketsQuery(days: number, bucketMinutes: number): string {
  const normalizedDays = Number.isFinite(days) && days > 0 ? Math.trunc(days) : 30;
  const normalizedBucketMinutes =
    Number.isFinite(bucketMinutes) && bucketMinutes > 0 ? Math.trunc(bucketMinutes) : 15;
  const bucketSeconds = normalizedBucketMinutes * 60;
  const minRecordTimeMicros = Math.floor(
    (Date.now() - normalizedDays * 24 * 60 * 60 * 1000) * 1000,
  );

  return `
    select
      to_char(
        to_timestamp(floor((record_time / 1000000.0) / ${bucketSeconds}) * ${bucketSeconds}) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as bucket_timestamp,
      count(*)::int as activity_value,
      max(event_offset)::text as latest_offset
    from participant.lapi_update_meta
    where record_time >= ${minRecordTimeMicros}
    group by 1
    order by 1 asc
  `;
}

function normalizePartyFilters(parties?: string[]): string[] {
  if (!parties) {
    return [];
  }

  return Array.from(
    new Set(
      parties
        .map((party) => party.trim())
        .filter((party) => party.length > 0),
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

function buildUpdatePartyExistsCondition(partyId: string): string {
  const createMatch = partyWitnessArrayMatchCondition('create_event.tree_event_witnesses', partyId);
  const consumingMatch = partyWitnessArrayMatchCondition(
    'exercise_event.tree_event_witnesses',
    partyId,
  );
  const nonConsumingMatch = partyWitnessArrayMatchCondition(
    'exercise_event.tree_event_witnesses',
    partyId,
  );

  return `(
    exists (
      select 1
      from participant.lapi_events_create create_event
      where create_event.update_id = update_meta.update_id
        and ${createMatch}
    )
    or exists (
      select 1
      from participant.lapi_events_consuming_exercise exercise_event
      where exercise_event.update_id = update_meta.update_id
        and ${consumingMatch}
    )
    or exists (
      select 1
      from participant.lapi_events_non_consuming_exercise exercise_event
      where exercise_event.update_id = update_meta.update_id
        and ${nonConsumingMatch}
    )
  )`;
}

function buildNormalizedUpdatePartyExistsCondition(partyId: string): string {
  const partyMatch = partyScalarMatchCondition('party_string.external_string', partyId);

  return `(
    exists (
      select 1
      from participant.lapi_events_activate_contract activate_event
      join participant.lapi_filter_activate_witness witness_filter
        on witness_filter.event_sequential_id = activate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where activate_event.update_id = update_meta.update_id
        and ${partyMatch}
    )
    or exists (
      select 1
      from participant.lapi_events_deactivate_contract deactivate_event
      join participant.lapi_filter_deactivate_witness witness_filter
        on witness_filter.event_sequential_id = deactivate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where deactivate_event.update_id = update_meta.update_id
        and ${partyMatch}
    )
    or exists (
      select 1
      from participant.lapi_events_various_witnessed various_event
      join participant.lapi_filter_various_witness witness_filter
        on witness_filter.event_sequential_id = various_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where various_event.update_id = update_meta.update_id
        and ${partyMatch}
    )
  )`;
}

function buildUpdateTemplateExistsCondition(templateId: string): string {
  const normalizedTemplateId = normalizeTemplateFilterValue(templateId);
  const quotedTemplateId = `'${escapeSqlLiteral(normalizedTemplateId)}'`;

  return `(
    exists (
      select 1
      from (
        select regexp_replace(coalesce(create_event.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_create create_event
        where create_event.update_id = update_meta.update_id

        union all

        select regexp_replace(coalesce(exercise_event.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_consuming_exercise exercise_event
        where exercise_event.update_id = update_meta.update_id

        union all

        select regexp_replace(coalesce(exercise_event.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_non_consuming_exercise exercise_event
        where exercise_event.update_id = update_meta.update_id
      ) update_event_templates
      where update_event_templates.template_id = ${quotedTemplateId}
    )
  )`;
}

function buildNormalizedUpdateTemplateExistsCondition(templateId: string): string {
  const normalizedTemplateId = normalizeTemplateFilterValue(templateId);
  const quotedTemplateId = `'${escapeSqlLiteral(normalizedTemplateId)}'`;

  return `(
    exists (
      select 1
      from (
        select regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_activate_contract activate_event
        left join participant.par_contracts contract
          on contract.internal_contract_id = activate_event.internal_contract_id
        where activate_event.update_id = update_meta.update_id

        union all

        select regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_various_witnessed various_event
        left join participant.par_contracts contract
          on contract.internal_contract_id = various_event.internal_contract_id
        where various_event.update_id = update_meta.update_id
          and various_event.event_type = 6

        union all

        select regexp_replace(coalesce(template_string.external_string, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_deactivate_contract deactivate_event
        left join participant.lapi_string_interning template_string
          on template_string.internal_id = deactivate_event.template_id
        where deactivate_event.update_id = update_meta.update_id

        union all

        select regexp_replace(coalesce(template_string.external_string, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_various_witnessed various_event
        left join participant.lapi_string_interning template_string
          on template_string.internal_id = various_event.template_id
        where various_event.update_id = update_meta.update_id
          and various_event.event_type in (5, 7)
      ) update_event_templates
      where update_event_templates.template_id = ${quotedTemplateId}
    )
  )`;
}

function buildUpdatesFilterClause(
  parties?: string[],
  templates?: string[],
  partyMode?: string,
): string | null {
  const partyConditions = normalizePartyFilters(parties).map((party) =>
    buildUpdatePartyExistsCondition(party),
  );
  const templateConditions = normalizeTemplateFilters(templates).map((templateId) =>
    buildUpdateTemplateExistsCondition(templateId),
  );
  const groups: string[] = [];

  if (partyConditions.length > 0) {
    const partyJoiner =
      normalizePartyFilterMode(partyMode) === 'and' ? '\n      and ' : '\n      or ';
    groups.push(
      partyConditions.length === 1
        ? partyConditions[0]
        : `(\n      ${partyConditions.join(partyJoiner)}\n    )`,
    );
  }

  if (templateConditions.length > 0) {
    groups.push(
      templateConditions.length === 1
        ? templateConditions[0]
        : `(\n      ${templateConditions.join('\n      or ')}\n    )`,
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return groups.length === 1 ? groups[0] : `(\n      ${groups.join('\n      and ')}\n    )`;
}

function buildNormalizedUpdatesFilterClause(
  parties?: string[],
  templates?: string[],
  partyMode?: string,
): string | null {
  const partyConditions = normalizePartyFilters(parties).map((party) =>
    buildNormalizedUpdatePartyExistsCondition(party),
  );
  const templateConditions = normalizeTemplateFilters(templates).map((templateId) =>
    buildNormalizedUpdateTemplateExistsCondition(templateId),
  );
  const groups: string[] = [];

  if (partyConditions.length > 0) {
    const partyJoiner =
      normalizePartyFilterMode(partyMode) === 'and' ? '\n      and ' : '\n      or ';
    groups.push(
      partyConditions.length === 1
        ? partyConditions[0]
        : `(\n      ${partyConditions.join(partyJoiner)}\n    )`,
    );
  }

  if (templateConditions.length > 0) {
    groups.push(
      templateConditions.length === 1
        ? templateConditions[0]
        : `(\n      ${templateConditions.join('\n      or ')}\n    )`,
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return groups.length === 1 ? groups[0] : `(\n      ${groups.join('\n      and ')}\n    )`;
}

function recentUpdatesQuery(
  limit: number,
  before?: string,
  after?: string,
  parties?: string[],
  templates?: string[],
  partyMode?: string,
  hideSplice?: boolean,
): string {
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const filterClause = buildUpdatesFilterClause(parties, templates, partyMode);
  const hideSpliceClause = hideSplice ? buildHideSpliceOffsetsClause() : null;
  const queryLimit = limit + 1;

  const afterFilters = [
    normalizedAfter ? `update_meta.event_offset::numeric > ${normalizedAfter}` : null,
    filterClause,
    hideSpliceClause,
  ].filter((value): value is string => Boolean(value));
  const olderFilters = [
    normalizedBefore ? `update_meta.event_offset::numeric < ${normalizedBefore}` : null,
    filterClause,
    hideSpliceClause,
  ].filter((value): value is string => Boolean(value));

  if (normalizedAfter && !normalizedBefore) {
    const whereClause = afterFilters.length > 0 ? `where ${afterFilters.join('\n      and ')}` : '';
    return `
      select
        update_meta.update_id::text as update_id,
        update_meta.event_offset::text as event_offset,
        to_char(
          to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time
      from participant.lapi_update_meta update_meta
      ${whereClause}
      order by update_meta.event_offset::numeric asc
      limit ${queryLimit}
    `;
  }

  const whereClause = olderFilters.length > 0 ? `where ${olderFilters.join('\n      and ')}` : '';

  return `
    select
      update_meta.update_id::text as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta update_meta
    ${whereClause}
    order by update_meta.event_offset::numeric desc
  limit ${queryLimit}
  `;
}

function searchUpdatesQuery(searchQuery: string, limit: number): string {
  const quotedQuery = escapeSqlLiteral(searchQuery);

  return `
    select
      update_meta.update_id::text as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta update_meta
    where update_meta.event_offset::text like '${quotedQuery}%'
      or regexp_replace(update_meta.update_id::text, '^\\\\x', '') like '${quotedQuery}%'
    order by update_meta.record_time desc, update_meta.event_offset::numeric desc
    limit ${limit}
  `;
}

function normalizedRecentUpdatesQuery(
  limit: number,
  before?: string,
  after?: string,
  parties?: string[],
  templates?: string[],
  partyMode?: string,
  hideSplice?: boolean,
): string {
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const filterClause = buildNormalizedUpdatesFilterClause(parties, templates, partyMode);
  const hideSpliceClause = hideSplice ? buildNormalizedHideSpliceOffsetsClause() : null;
  const queryLimit = limit + 1;

  const afterFilters = [
    normalizedAfter ? `update_meta.event_offset::numeric > ${normalizedAfter}` : null,
    filterClause,
    hideSpliceClause,
  ].filter((value): value is string => Boolean(value));
  const olderFilters = [
    normalizedBefore ? `update_meta.event_offset::numeric < ${normalizedBefore}` : null,
    filterClause,
    hideSpliceClause,
  ].filter((value): value is string => Boolean(value));

  if (normalizedAfter && !normalizedBefore) {
    const whereClause = afterFilters.length > 0 ? `where ${afterFilters.join('\n      and ')}` : '';
    return `
      select
        encode(update_meta.update_id, 'hex') as update_id,
        update_meta.event_offset::text as event_offset,
        to_char(
          to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time
      from participant.lapi_update_meta update_meta
      ${whereClause}
      order by update_meta.event_offset::numeric asc
      limit ${queryLimit}
    `;
  }

  const whereClause = olderFilters.length > 0 ? `where ${olderFilters.join('\n      and ')}` : '';

  return `
    select
      encode(update_meta.update_id, 'hex') as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta update_meta
    ${whereClause}
    order by update_meta.event_offset::numeric desc
    limit ${queryLimit}
  `;
}

function normalizedSearchUpdatesQuery(searchQuery: string, limit: number): string {
  const quotedQuery = escapeSqlLiteral(searchQuery);

  return `
    select
      encode(update_meta.update_id, 'hex') as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta update_meta
    where update_meta.event_offset::text like '${quotedQuery}%'
      or encode(update_meta.update_id, 'hex') like '${quotedQuery}%'
    order by update_meta.record_time desc, update_meta.event_offset::numeric desc
    limit ${limit}
  `;
}

function buildHideSpliceOffsetsClause(): string {
  return `
    exists (
      select 1
      from (
        select create_event.template_id::text as template_id
        from participant.lapi_events_create create_event
        where create_event.update_id::text = update_meta.update_id::text

        union all

        select exercise_event.template_id::text as template_id
        from participant.lapi_events_consuming_exercise exercise_event
        where exercise_event.update_id::text = update_meta.update_id::text

        union all

        select exercise_event.template_id::text as template_id
        from participant.lapi_events_non_consuming_exercise exercise_event
        where exercise_event.update_id::text = update_meta.update_id::text
      ) update_event_templates
      where update_event_templates.template_id is null
        or update_event_templates.template_id not like 'Splice.%'
    )
  `;
}

function buildNormalizedHideSpliceOffsetsClause(): string {
  return `
    exists (
      select 1
      from (
        select regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_activate_contract activate_event
        left join participant.par_contracts contract
          on contract.internal_contract_id = activate_event.internal_contract_id
        where encode(activate_event.update_id, 'hex') = encode(update_meta.update_id, 'hex')

        union all

        select regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_various_witnessed various_event
        left join participant.par_contracts contract
          on contract.internal_contract_id = various_event.internal_contract_id
        where encode(various_event.update_id, 'hex') = encode(update_meta.update_id, 'hex')
          and various_event.event_type = 6

        union all

        select regexp_replace(coalesce(template_string.external_string, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_deactivate_contract deactivate_event
        left join participant.lapi_string_interning template_string
          on template_string.internal_id = deactivate_event.template_id
        where encode(deactivate_event.update_id, 'hex') = encode(update_meta.update_id, 'hex')

        union all

        select regexp_replace(coalesce(template_string.external_string, ''), '^t\\\\|#[^:]+:', '') as template_id
        from participant.lapi_events_various_witnessed various_event
        left join participant.lapi_string_interning template_string
          on template_string.internal_id = various_event.template_id
        where encode(various_event.update_id, 'hex') = encode(update_meta.update_id, 'hex')
          and various_event.event_type in (5, 7)
      ) update_event_templates
      where update_event_templates.template_id = ''
        or update_event_templates.template_id not like 'Splice.%'
    )
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

  return Array.from(identifiers).map((identifier) => `'${escapeSqlLiteral(identifier)}'`);
}

function partyWitnessArrayMatchCondition(arrayExpression: string, partyId: string): string {
  const quotedIdentifiers = buildQuotedPartyIdentifiers(partyId);

  if (quotedIdentifiers.length === 0) {
    return 'false';
  }

  return `array[${quotedIdentifiers.join(', ')}]::text[] && ${arrayExpression}`;
}

function partyScalarMatchCondition(columnExpression: string, partyId: string): string {
  const quotedIdentifiers = buildQuotedPartyIdentifiers(partyId);

  if (quotedIdentifiers.length === 0) {
    return 'false';
  }

  return `${columnExpression} in (${quotedIdentifiers.join(', ')})`;
}

function partyRecentUpdatesQuery(partyId: string, limit: number): string {
  const witnessMatch = partyWitnessArrayMatchCondition('create_event.tree_event_witnesses', partyId);
  const consumingWitnessMatch = partyWitnessArrayMatchCondition(
    'exercise_event.tree_event_witnesses',
    partyId,
  );
  const nonConsumingWitnessMatch = partyWitnessArrayMatchCondition(
    'exercise_event.tree_event_witnesses',
    partyId,
  );

  return `
    select
      update_meta.update_id::text as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta update_meta
    where update_meta.update_id::text in (
      select create_event.update_id::text
      from participant.lapi_events_create create_event
      where ${witnessMatch}

      union

      select exercise_event.update_id::text
      from participant.lapi_events_consuming_exercise exercise_event
      where ${consumingWitnessMatch}

      union

      select exercise_event.update_id::text
      from participant.lapi_events_non_consuming_exercise exercise_event
      where ${nonConsumingWitnessMatch}
    )
    order by update_meta.record_time desc
    limit ${limit}
  `;
}

function normalizedPartyRecentUpdatesQuery(partyId: string, limit: number): string {
  const partyMatch = partyScalarMatchCondition('party_string.external_string', partyId);

  return `
    with matching_updates as (
      select distinct activate_event.update_id
      from participant.lapi_events_activate_contract activate_event
      join participant.lapi_filter_activate_witness witness_filter
        on witness_filter.event_sequential_id = activate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where ${partyMatch}

      union

      select distinct deactivate_event.update_id
      from participant.lapi_events_deactivate_contract deactivate_event
      join participant.lapi_filter_deactivate_witness witness_filter
        on witness_filter.event_sequential_id = deactivate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where ${partyMatch}

      union

      select distinct various_event.update_id
      from participant.lapi_events_various_witnessed various_event
      join participant.lapi_filter_various_witness witness_filter
        on witness_filter.event_sequential_id = various_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where ${partyMatch}
    )
    select
      encode(update_meta.update_id, 'hex') as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta update_meta
    join matching_updates
      on matching_updates.update_id = update_meta.update_id
    order by update_meta.record_time desc
    limit ${limit}
  `;
}

function recentUpdatePartiesQuery(updateIds: string[]): string {
  const quotedIds = updateIds.map((updateId) => `'${escapeSqlLiteral(updateId)}'`).join(', ');

  return `
    select
      update_id::text as update_id,
      array_agg(distinct party order by party) as parties
    from (
      select
        update_id,
        unnest(tree_event_witnesses) as party
      from participant.lapi_events_create
      where update_id in (${quotedIds})

      union

      select
        update_id,
        unnest(tree_event_witnesses) as party
      from participant.lapi_events_consuming_exercise
      where update_id in (${quotedIds})

      union

      select
        update_id,
        unnest(tree_event_witnesses) as party
      from participant.lapi_events_non_consuming_exercise
      where update_id in (${quotedIds})
    ) update_parties
    group by update_id
  `;
}

function normalizedRecentUpdatePartiesQuery(updateIds: string[]): string {
  const quotedIds = updateIds
    .map((updateId) => `'${escapeSqlLiteral(normalizeByteaHex(updateId))}'`)
    .join(', ');

  return `
    select
      update_id,
      array_agg(distinct party order by party) as parties
    from (
      select
        encode(activate_event.update_id, 'hex') as update_id,
        party_string.external_string as party
      from participant.lapi_events_activate_contract activate_event
      join participant.lapi_filter_activate_witness witness_filter
        on witness_filter.event_sequential_id = activate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where encode(activate_event.update_id, 'hex') in (${quotedIds})

      union

      select
        encode(deactivate_event.update_id, 'hex') as update_id,
        party_string.external_string as party
      from participant.lapi_events_deactivate_contract deactivate_event
      join participant.lapi_filter_deactivate_witness witness_filter
        on witness_filter.event_sequential_id = deactivate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where encode(deactivate_event.update_id, 'hex') in (${quotedIds})

      union

      select
        encode(various_event.update_id, 'hex') as update_id,
        party_string.external_string as party
      from participant.lapi_events_various_witnessed various_event
      join participant.lapi_filter_various_witness witness_filter
        on witness_filter.event_sequential_id = various_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      where encode(various_event.update_id, 'hex') in (${quotedIds})
    ) update_parties
    group by update_id
  `;
}

function activePartiesQuery(): string {
  return `
    select
      array_agg(distinct party order by party) as parties
    from (
      select unnest(tree_event_witnesses) as party
      from participant.lapi_events_create

      union

      select unnest(tree_event_witnesses) as party
      from participant.lapi_events_consuming_exercise

      union

      select unnest(tree_event_witnesses) as party
      from participant.lapi_events_non_consuming_exercise
    ) observed_parties
  `;
}

function normalizedActivePartiesQuery(): string {
  return `
    select
      array_agg(distinct party order by party) as parties
    from (
      select party_string.external_string as party
      from participant.lapi_filter_activate_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id

      union

      select party_string.external_string as party
      from participant.lapi_filter_deactivate_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id

      union

      select party_string.external_string as party
      from participant.lapi_filter_various_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
    ) observed_parties
  `;
}

function partyRecentContractsQuery(
  partyId: string,
  limit: number,
  before?: string,
  after?: string,
): string {
  const witnessMatch = partyWitnessArrayMatchCondition('create_event.tree_event_witnesses', partyId);
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const queryLimit = limit + 1;
  const afterClause = normalizedAfter ? `and create_event.event_offset::numeric > ${normalizedAfter}` : '';
  const beforeClause = normalizedBefore ? `and create_event.event_offset::numeric < ${normalizedBefore}` : '';

  if (normalizedAfter && !normalizedBefore) {
    return `
      select
        create_event.contract_id::text as contract_id,
        create_event.template_id::text as template_id,
        null::text as package_id,
        to_char(
          to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        create_event.event_offset::text as created_event_offset
      from participant.lapi_events_create create_event
      join participant.lapi_update_meta update_meta
        on update_meta.update_id = create_event.update_id
      where ${witnessMatch}
        ${afterClause}
      order by create_event.event_offset::numeric asc
      limit ${queryLimit}
    `;
  }

  return `
    select
      create_event.contract_id::text as contract_id,
      create_event.template_id::text as template_id,
      null::text as package_id,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
      ,
      create_event.event_offset::text as created_event_offset
    from participant.lapi_events_create create_event
    join participant.lapi_update_meta update_meta
      on update_meta.update_id = create_event.update_id
    where ${witnessMatch}
      ${beforeClause}
    order by create_event.event_offset::numeric desc
    limit ${queryLimit}
  `;
}

function normalizedPartyRecentContractsQuery(
  partyId: string,
  limit: number,
  before?: string,
  after?: string,
): string {
  const partyMatch = partyScalarMatchCondition('party_string.external_string', partyId);
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const queryLimit = limit + 1;
  const afterFilter =
    normalizedAfter && !normalizedBefore
      ? `where created_event_offset::numeric > ${normalizedAfter}`
      : normalizedBefore
        ? `where created_event_offset::numeric < ${normalizedBefore}`
        : '';
  const sortDirection = normalizedAfter && !normalizedBefore ? 'asc' : 'desc';

  return `
    select
      contract_id,
      template_id,
      package_id,
      record_time,
      created_event_offset
    from (
      select
        encode(contract.contract_id, 'hex') as contract_id,
        contract.template_id::text as template_id,
        package_string.external_string as package_id,
        to_char(
          to_timestamp(activate_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        activate_event.event_sequential_id as sort_event_sequential_id,
        activate_event.event_offset::text as created_event_offset
      from participant.lapi_events_activate_contract activate_event
      join participant.lapi_filter_activate_witness witness_filter
        on witness_filter.event_sequential_id = activate_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      left join participant.par_contracts contract
        on contract.internal_contract_id = activate_event.internal_contract_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = activate_event.representative_package_id
      where ${partyMatch}

      union all

      select
        encode(contract.contract_id, 'hex') as contract_id,
        contract.template_id::text as template_id,
        package_string.external_string as package_id,
        to_char(
          to_timestamp(various_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        various_event.event_sequential_id as sort_event_sequential_id,
        various_event.event_offset::text as created_event_offset
      from participant.lapi_events_various_witnessed various_event
      join participant.lapi_filter_various_witness witness_filter
        on witness_filter.event_sequential_id = various_event.event_sequential_id
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      left join participant.par_contracts contract
        on contract.internal_contract_id = various_event.internal_contract_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = various_event.package_id
      where ${partyMatch}
        and various_event.event_type = 6
    ) recent_contracts
    ${afterFilter}
    order by created_event_offset::numeric ${sortDirection}
    limit ${queryLimit}
  `;
}

function singleUpdateQuery(eventOffset: string): string {
  const quotedOffset = `'${escapeSqlLiteral(eventOffset)}'`;

  return `
    select
      update_meta.update_id::text as update_id,
      update_meta.event_offset::text as event_offset,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time_iso,
      to_jsonb(update_meta) as meta
    from participant.lapi_update_meta update_meta
    where update_meta.event_offset::text = ${quotedOffset}
    order by update_meta.record_time desc
    limit 1
  `;
}

function updateEventsQuery(updateId: string): string {
  const quotedId = `'${escapeSqlLiteral(updateId)}'`;

  return `
    select
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
        'create'::text as event_kind,
        create_event.event_id::text as event_id,
        create_event.contract_id::text as contract_id,
        create_event.template_id::text as template_id,
        null::text as package_id,
        null::text as choice,
        create_event.tree_event_witnesses as witnesses,
        null::bytea as contract_instance,
        null::bytea as exercise_argument,
        null::bytea as exercise_result,
        to_jsonb(create_event) as raw
      from participant.lapi_events_create create_event
      where create_event.update_id::text = ${quotedId}

      union all

      select
        'consuming_exercise'::text as event_kind,
        exercise_event.event_id::text as event_id,
        exercise_event.contract_id::text as contract_id,
        exercise_event.template_id::text as template_id,
        null::text as package_id,
        exercise_event.choice::text as choice,
        exercise_event.tree_event_witnesses as witnesses,
        null::bytea as contract_instance,
        null::bytea as exercise_argument,
        null::bytea as exercise_result,
        to_jsonb(exercise_event) as raw
      from participant.lapi_events_consuming_exercise exercise_event
      where exercise_event.update_id::text = ${quotedId}

      union all

      select
        'non_consuming_exercise'::text as event_kind,
        exercise_event.event_id::text as event_id,
        exercise_event.contract_id::text as contract_id,
        exercise_event.template_id::text as template_id,
        null::text as package_id,
        exercise_event.choice::text as choice,
        exercise_event.tree_event_witnesses as witnesses,
        null::bytea as contract_instance,
        null::bytea as exercise_argument,
        null::bytea as exercise_result,
        to_jsonb(exercise_event) as raw
      from participant.lapi_events_non_consuming_exercise exercise_event
      where exercise_event.update_id::text = ${quotedId}
    ) update_events
    order by event_id asc, event_kind asc, contract_id asc, template_id asc
  `;
}

function normalizedUpdateEventsQuery(updateId: string): string {
  const quotedId = `'${escapeSqlLiteral(normalizeByteaHex(updateId))}'`;

  return `
    with activate_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_activate_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    ),
    deactivate_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_deactivate_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    ),
    various_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_various_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    )
    select
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
        'create'::text as event_kind,
        '#0:' || activate_event.node_id::text as event_id,
        encode(contract.contract_id, 'hex') as contract_id,
        contract.template_id::text as template_id,
        package_string.external_string as package_id,
        null::text as choice,
        coalesce(activate_witnesses.witnesses, array[]::text[]) as witnesses,
        contract.instance as contract_instance,
        null::bytea as exercise_argument,
        null::bytea as exercise_result,
        jsonb_build_object(
          'source_table', 'participant.lapi_events_activate_contract',
          'update_id', encode(activate_event.update_id, 'hex'),
          'event_offset', activate_event.event_offset,
          'event_type', activate_event.event_type,
          'event_sequential_id', activate_event.event_sequential_id,
          'node_id', activate_event.node_id,
          'contract_id', encode(contract.contract_id, 'hex'),
          'template_id', contract.template_id,
          'package_id', package_string.external_string
        ) as raw,
        activate_event.event_sequential_id as sort_event_sequential_id
      from participant.lapi_events_activate_contract activate_event
      left join participant.par_contracts contract
        on contract.internal_contract_id = activate_event.internal_contract_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = activate_event.representative_package_id
      left join activate_witnesses
        on activate_witnesses.event_sequential_id = activate_event.event_sequential_id
      where encode(activate_event.update_id, 'hex') = ${quotedId}

      union all

      select
        'create'::text as event_kind,
        '#0:' || various_event.node_id::text as event_id,
        encode(contract.contract_id, 'hex') as contract_id,
        contract.template_id::text as template_id,
        package_string.external_string as package_id,
        null::text as choice,
        coalesce(various_witnesses.witnesses, array[]::text[]) as witnesses,
        contract.instance as contract_instance,
        null::bytea as exercise_argument,
        null::bytea as exercise_result,
        jsonb_build_object(
          'source_table', 'participant.lapi_events_various_witnessed',
          'update_id', encode(various_event.update_id, 'hex'),
          'event_offset', various_event.event_offset,
          'event_type', various_event.event_type,
          'event_sequential_id', various_event.event_sequential_id,
          'node_id', various_event.node_id,
          'contract_id', encode(contract.contract_id, 'hex'),
          'template_id', contract.template_id,
          'package_id', package_string.external_string
        ) as raw,
        various_event.event_sequential_id as sort_event_sequential_id
      from participant.lapi_events_various_witnessed various_event
      left join participant.par_contracts contract
        on contract.internal_contract_id = various_event.internal_contract_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = various_event.package_id
      left join various_witnesses
        on various_witnesses.event_sequential_id = various_event.event_sequential_id
      where encode(various_event.update_id, 'hex') = ${quotedId}
        and various_event.event_type = 6

      union all

      select
        'consuming_exercise'::text as event_kind,
        '#0:' || deactivate_event.node_id::text as event_id,
        encode(deactivate_event.contract_id, 'hex') as contract_id,
        template_string.external_string as template_id,
        package_string.external_string as package_id,
        choice_string.external_string as choice,
        coalesce(deactivate_witnesses.witnesses, array[]::text[]) as witnesses,
        null::bytea as contract_instance,
        deactivate_event.exercise_argument as exercise_argument,
        deactivate_event.exercise_result as exercise_result,
        jsonb_build_object(
          'source_table', 'participant.lapi_events_deactivate_contract',
          'update_id', encode(deactivate_event.update_id, 'hex'),
          'event_offset', deactivate_event.event_offset,
          'event_type', deactivate_event.event_type,
          'event_sequential_id', deactivate_event.event_sequential_id,
          'node_id', deactivate_event.node_id,
          'contract_id', encode(deactivate_event.contract_id, 'hex'),
          'template_id', template_string.external_string,
          'package_id', package_string.external_string,
          'choice', choice_string.external_string
        ) as raw,
        deactivate_event.event_sequential_id as sort_event_sequential_id
      from participant.lapi_events_deactivate_contract deactivate_event
      left join participant.lapi_string_interning template_string
        on template_string.internal_id = deactivate_event.template_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = deactivate_event.package_id
      left join participant.lapi_string_interning choice_string
        on choice_string.internal_id = deactivate_event.exercise_choice
      left join deactivate_witnesses
        on deactivate_witnesses.event_sequential_id = deactivate_event.event_sequential_id
      where encode(deactivate_event.update_id, 'hex') = ${quotedId}

      union all

      select
        case
          when various_event.consuming then 'consuming_exercise'::text
          else 'non_consuming_exercise'::text
        end as event_kind,
        '#0:' || various_event.node_id::text as event_id,
        encode(various_event.contract_id, 'hex') as contract_id,
        template_string.external_string as template_id,
        package_string.external_string as package_id,
        choice_string.external_string as choice,
        coalesce(various_witnesses.witnesses, array[]::text[]) as witnesses,
        null::bytea as contract_instance,
        various_event.exercise_argument as exercise_argument,
        various_event.exercise_result as exercise_result,
        jsonb_build_object(
          'source_table', 'participant.lapi_events_various_witnessed',
          'update_id', encode(various_event.update_id, 'hex'),
          'event_offset', various_event.event_offset,
          'event_type', various_event.event_type,
          'event_sequential_id', various_event.event_sequential_id,
          'node_id', various_event.node_id,
          'consuming', various_event.consuming,
          'contract_id', encode(various_event.contract_id, 'hex'),
          'template_id', template_string.external_string,
          'package_id', package_string.external_string,
          'choice', choice_string.external_string
        ) as raw,
        various_event.event_sequential_id as sort_event_sequential_id
      from participant.lapi_events_various_witnessed various_event
      left join participant.lapi_string_interning template_string
        on template_string.internal_id = various_event.template_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = various_event.package_id
      left join participant.lapi_string_interning choice_string
        on choice_string.internal_id = various_event.exercise_choice
      left join various_witnesses
        on various_witnesses.event_sequential_id = various_event.event_sequential_id
      where encode(various_event.update_id, 'hex') = ${quotedId}
        and various_event.event_type in (5, 7)
    ) update_events
    order by sort_event_sequential_id asc, event_kind asc
  `;
}

function rewardCouponInstanceQuery(updateId: string): string {
  const quotedId = `'${escapeSqlLiteral(normalizeByteaHex(updateId))}'`;

  return `
    select
      coupon_contract_id,
      contract_instance
    from (
      select
        encode(contract.contract_id, 'hex') as coupon_contract_id,
        contract.instance as contract_instance,
        activate_event.event_sequential_id as sort_event_sequential_id
      from participant.lapi_events_activate_contract activate_event
      join participant.par_contracts contract
        on contract.internal_contract_id = activate_event.internal_contract_id
      where encode(activate_event.update_id, 'hex') = ${quotedId}
        and contract.template_id = 'Splice.Amulet:SvRewardCoupon'

      union all

      select
        encode(contract.contract_id, 'hex') as coupon_contract_id,
        contract.instance as contract_instance,
        various_event.event_sequential_id as sort_event_sequential_id
      from participant.lapi_events_various_witnessed various_event
      join participant.par_contracts contract
        on contract.internal_contract_id = various_event.internal_contract_id
      where encode(various_event.update_id, 'hex') = ${quotedId}
        and various_event.event_type = 6
        and contract.template_id = 'Splice.Amulet:SvRewardCoupon'
    ) reward_coupon_events
    order by sort_event_sequential_id desc
    limit 1
  `;
}

function contractDetailQuery(contractId: string): string {
  const quotedId = `'${escapeSqlLiteral(normalizeByteaHex(contractId))}'`;

  return `
    with contract_row as (
      select
        internal_contract_id,
        encode(contract_id, 'hex') as contract_id,
        package_id,
        template_id,
        instance
      from participant.par_contracts
      where encode(contract_id, 'hex') = ${quotedId}
      limit 1
    ),
    create_events as (
      select
        encode(activate_event.update_id, 'hex') as update_id,
        activate_event.event_offset::text as event_offset,
        to_char(
          to_timestamp(activate_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        activate_event.event_sequential_id
      from participant.lapi_events_activate_contract activate_event
      join contract_row contract_row
        on contract_row.internal_contract_id = activate_event.internal_contract_id

      union all

      select
        encode(various_event.update_id, 'hex') as update_id,
        various_event.event_offset::text as event_offset,
        to_char(
          to_timestamp(various_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        various_event.event_sequential_id
      from participant.lapi_events_various_witnessed various_event
      join contract_row contract_row
        on contract_row.internal_contract_id = various_event.internal_contract_id
      where various_event.event_type = 6
    ),
    archive_events as (
      select
        encode(deactivate_event.update_id, 'hex') as update_id,
        deactivate_event.event_offset::text as event_offset,
        to_char(
          to_timestamp(deactivate_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        deactivate_event.event_sequential_id
      from participant.lapi_events_deactivate_contract deactivate_event
      join contract_row contract_row
        on contract_row.internal_contract_id = deactivate_event.internal_contract_id

      union all

      select
        encode(various_event.update_id, 'hex') as update_id,
        various_event.event_offset::text as event_offset,
        to_char(
          to_timestamp(various_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        various_event.event_sequential_id
      from participant.lapi_events_various_witnessed various_event
      join contract_row contract_row
        on contract_row.internal_contract_id = various_event.internal_contract_id
      where various_event.event_type in (5, 7)
        and various_event.consuming
    )
    select
      contract_row.contract_id,
      contract_row.template_id,
      contract_row.package_id,
      contract_row.instance as contract_instance,
      created_event.update_id as created_update_id,
      created_event.event_offset as created_event_offset,
      created_event.record_time as created_record_time,
      archived_event.update_id as archived_update_id,
      archived_event.event_offset as archived_event_offset,
      archived_event.record_time as archived_record_time
    from contract_row
    left join lateral (
      select
        update_id,
        event_offset,
        record_time
      from create_events
      order by event_sequential_id asc
      limit 1
    ) created_event on true
    left join lateral (
      select
        update_id,
        event_offset,
        record_time
      from archive_events
      order by event_sequential_id asc
      limit 1
    ) archived_event on true
  `;
}

function tokenRowsQuery(limit: number, templateIds: readonly string[]): string {
  const normalizedLimit =
    Number.isFinite(limit) && Number(limit) > 0 ? Math.trunc(limit) : TOKEN_TRANSFER_CACHE_LIMIT;
  const quotedTemplateIds = templateIds
    .map((templateId) => `'${escapeSqlLiteral(templateId)}'`)
    .join(',\n        ');

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
        encode(contract.contract_id, 'hex') as contract_id,
        encode(activate_event.update_id, 'hex') as update_id,
        activate_event.event_offset::text as event_offset,
        to_char(
          to_timestamp(activate_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        contract.template_id::text as template_id,
        package_string.external_string as package_id,
        contract.instance as contract_instance
      from participant.lapi_events_activate_contract activate_event
      join participant.par_contracts contract
        on contract.internal_contract_id = activate_event.internal_contract_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = activate_event.representative_package_id
      where contract.template_id in (
        ${quotedTemplateIds}
      )

      union all

      select
        encode(contract.contract_id, 'hex') as contract_id,
        encode(various_event.update_id, 'hex') as update_id,
        various_event.event_offset::text as event_offset,
        to_char(
          to_timestamp(various_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as record_time,
        contract.template_id::text as template_id,
        package_string.external_string as package_id,
        contract.instance as contract_instance
      from participant.lapi_events_various_witnessed various_event
      join participant.par_contracts contract
        on contract.internal_contract_id = various_event.internal_contract_id
      left join participant.lapi_string_interning package_string
        on package_string.internal_id = various_event.package_id
      where various_event.event_type = 6
        and contract.template_id in (
          ${quotedTemplateIds}
        )
    ) token_transfer_rows
    order by event_offset::numeric desc
    limit ${normalizedLimit}
  `;
}

function buildActiveContractsFilterClause(
  parties?: string[],
  templates?: string[],
  partyMode?: string,
  hideSplice?: boolean,
): string | null {
  const partyConditions = normalizePartyFilters(parties).map((party) =>
    partyWitnessArrayMatchCondition('create_events.witnesses', party),
  );
  const templateExpression =
    "regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '')";
  const templateConditions = normalizeTemplateFilters(templates).map((templateId) => {
    const quotedTemplateId = `'${escapeSqlLiteral(templateId)}'`;
    return `${templateExpression} = ${quotedTemplateId}`;
  });
  const groups: string[] = [];

  if (partyConditions.length > 0) {
    const partyJoiner =
      normalizePartyFilterMode(partyMode) === 'and' ? '\n      and ' : '\n      or ';
    groups.push(
      partyConditions.length === 1
        ? partyConditions[0]
        : `(\n      ${partyConditions.join(partyJoiner)}\n    )`,
    );
  }

  if (templateConditions.length > 0) {
    groups.push(
      templateConditions.length === 1
        ? templateConditions[0]
        : `(\n      ${templateConditions.join('\n      or ')}\n    )`,
    );
  }

  if (hideSplice) {
    groups.push(`${templateExpression} not like 'Splice.%'`);
  }

  if (groups.length === 0) {
    return null;
  }

  return groups.length === 1 ? groups[0] : `(\n      ${groups.join('\n      and ')}\n    )`;
}

function activeContractsQuery(
  limit: number,
  before?: string,
  after?: string,
  parties?: string[],
  templates?: string[],
  partyMode?: string,
  hideSplice?: boolean,
): string {
  const normalizedBefore = normalizeEventOffsetCursor(before);
  const normalizedAfter = normalizeEventOffsetCursor(after);
  const queryLimit = limit + 1;
  const useAfterCursor = Boolean(normalizedAfter && !normalizedBefore);
  const cursorFilter = useAfterCursor
    ? `create_event_offset::numeric > ${normalizedAfter}`
    : normalizedBefore
      ? `create_event_offset::numeric < ${normalizedBefore}`
      : null;
  const orderDirection = useAfterCursor ? 'asc' : 'desc';
  const filterClause = buildActiveContractsFilterClause(parties, templates, partyMode, hideSplice);
  const whereConditions = [
    `not exists (
      select 1
      from archived_contracts archived_contract
      where archived_contract.internal_contract_id = create_events.internal_contract_id
    )`,
    cursorFilter,
    filterClause,
  ].filter((value): value is string => Boolean(value));
  const whereClause =
    whereConditions.length > 0 ? `where ${whereConditions.join('\n      and ')}` : '';

  return `
    with activate_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_activate_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    ),
    various_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_various_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    ),
    create_events as (
      select
        activate_event.internal_contract_id,
        activate_event.event_offset::text as create_event_offset,
        to_char(
          to_timestamp(activate_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as created_record_time,
        coalesce(activate_witnesses.witnesses, array[]::text[]) as witnesses
      from participant.lapi_events_activate_contract activate_event
      left join activate_witnesses
        on activate_witnesses.event_sequential_id = activate_event.event_sequential_id

      union all

      select
        various_event.internal_contract_id,
        various_event.event_offset::text as create_event_offset,
        to_char(
          to_timestamp(various_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as created_record_time,
        coalesce(various_witnesses.witnesses, array[]::text[]) as witnesses
      from participant.lapi_events_various_witnessed various_event
      left join various_witnesses
        on various_witnesses.event_sequential_id = various_event.event_sequential_id
      where various_event.event_type = 6
    ),
    archived_contracts as (
      select distinct deactivate_event.internal_contract_id
      from participant.lapi_events_deactivate_contract deactivate_event

      union

      select distinct various_event.internal_contract_id
      from participant.lapi_events_various_witnessed various_event
      where various_event.event_type in (5, 7)
        and various_event.consuming
    )
    select
      encode(contract.contract_id, 'hex') as contract_id,
      regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id,
      create_events.created_record_time,
      create_events.create_event_offset as created_event_offset
    from create_events
    join participant.par_contracts contract
      on contract.internal_contract_id = create_events.internal_contract_id
    ${whereClause}
    order by create_event_offset::numeric ${orderDirection}
    limit ${queryLimit}
  `;
}

function searchContractsQuery(searchQuery: string, limit: number): string {
  const quotedQuery = escapeSqlLiteral(searchQuery);

  return `
    with activate_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_activate_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    ),
    various_witnesses as (
      select
        witness_filter.event_sequential_id,
        array_agg(distinct party_string.external_string order by party_string.external_string) as witnesses
      from participant.lapi_filter_various_witness witness_filter
      join participant.lapi_string_interning party_string
        on party_string.internal_id = witness_filter.party_id
      group by witness_filter.event_sequential_id
    ),
    create_events as (
      select
        activate_event.internal_contract_id,
        activate_event.event_offset::text as create_event_offset,
        to_char(
          to_timestamp(activate_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as created_record_time,
        coalesce(activate_witnesses.witnesses, array[]::text[]) as witnesses
      from participant.lapi_events_activate_contract activate_event
      left join activate_witnesses
        on activate_witnesses.event_sequential_id = activate_event.event_sequential_id

      union all

      select
        various_event.internal_contract_id,
        various_event.event_offset::text as create_event_offset,
        to_char(
          to_timestamp(various_event.record_time / 1000000.0) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as created_record_time,
        coalesce(various_witnesses.witnesses, array[]::text[]) as witnesses
      from participant.lapi_events_various_witnessed various_event
      left join various_witnesses
        on various_witnesses.event_sequential_id = various_event.event_sequential_id
      where various_event.event_type = 6
    ),
    archived_contracts as (
      select distinct deactivate_event.internal_contract_id
      from participant.lapi_events_deactivate_contract deactivate_event

      union

      select distinct various_event.internal_contract_id
      from participant.lapi_events_various_witnessed various_event
      where various_event.event_type in (5, 7)
        and various_event.consuming
    )
    select
      encode(contract.contract_id, 'hex') as contract_id,
      regexp_replace(coalesce(contract.template_id::text, ''), '^t\\\\|#[^:]+:', '') as template_id,
      create_events.created_record_time
    from create_events
    join participant.par_contracts contract
      on contract.internal_contract_id = create_events.internal_contract_id
    where encode(contract.contract_id, 'hex') like '${quotedQuery}%'
      and not exists (
        select 1
        from archived_contracts archived_contract
        where archived_contract.internal_contract_id = create_events.internal_contract_id
      )
    order by create_events.created_record_time desc nulls last, contract_id asc
    limit ${limit}
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

function normalizeByteaHex(value: string): string {
  return value.startsWith('\\x') ? value.slice(2) : value;
}

@Injectable()
export class PqsSummaryService {
  private readonly observedTokensByNode = new Map<string, CachedNodeObservedTokens>();
  private readonly tokenHoldersByNode = new Map<string, CachedNodeTokenHolders>();
  private readonly tokenTransfersByNode = new Map<string, CachedNodeTokenTransfers>();

  constructor(
    private readonly clientFactory: PqsClientFactory,
    @Optional() private readonly damlValueDecoder?: DamlValueDecoderService,
    @Optional() private readonly packageCacheService?: PackageCacheService,
    @Optional() private readonly packageRegistryService?: PackageRegistryService,
    @Optional() private readonly nodeConfigService?: NodeConfigService,
    @Optional() private readonly grpcOperationsService?: GrpcOperationsService,
  ) {}

  async fetchSummary(node: NodeConfig): Promise<LedgerSummary> {
    const client = this.clientFactory.getClient(node);
    const result = await this.querySummary(client.query.bind(client));
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
        } = 25,
  ): Promise<NodeRecentUpdatesResponse> {
    const client = this.clientFactory.getClient(node);
    const normalizedLimit =
      typeof options === 'number'
        ? Number.isFinite(options) && options > 0
          ? Math.trunc(options)
          : 25
        : Number.isFinite(options.limit) && Number(options.limit) > 0
          ? Math.trunc(Number(options.limit))
          : 25;
    const before = typeof options === 'object' ? options.before : undefined;
    const after = typeof options === 'object' ? options.after : undefined;
    const parties = typeof options === 'object' ? options.parties : undefined;
    const templates = typeof options === 'object' ? options.templates : undefined;
    const partyMode =
      typeof options === 'object' ? (options.partyMode ?? options.mode) : undefined;
    const hideSplice = typeof options === 'object' ? options.hideSplice === true : false;
    const useAfterCursor = Boolean(after && !before);
    const query = client.query.bind(client);
    const rawMetaRows = await this.queryRecentUpdateMetaRows(
      query,
      normalizedLimit,
      before,
      after,
      parties,
      templates,
      partyMode,
      hideSplice,
    );
    const hasMoreInQuery = rawMetaRows.length > normalizedLimit;
    const trimmedMetaRows = rawMetaRows.slice(0, normalizedLimit);
    const orderedUpdates = (useAfterCursor ? [...trimmedMetaRows].reverse() : trimmedMetaRows).map((row) => ({
      eventOffset: this.extractEventOffset(row),
      rawUpdateId: row.update_id,
      updateId: this.normalizeUpdateId(row.update_id),
      recordTime: row.record_time ?? null,
    }));

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
      query,
      orderedUpdates.map((update) => update.rawUpdateId),
    );

    return {
      nodeId: node.id,
      label: node.label,
      limit: normalizedLimit,
      nextBefore:
        useAfterCursor || hasMoreInQuery
          ? orderedUpdates[orderedUpdates.length - 1]?.eventOffset ?? null
          : null,
      nextAfter:
        useAfterCursor
          ? hasMoreInQuery
            ? orderedUpdates[0]?.eventOffset ?? null
            : null
          : before
            ? orderedUpdates[0]?.eventOffset ?? null
            : null,
      updates: orderedUpdates.map((update) => ({
        eventOffset: update.eventOffset,
        updateId: update.updateId,
        recordTime: update.recordTime,
        parties: partiesByUpdateId.get(update.updateId) ?? [],
      })),
    };
  }

  async fetchGlobalRecentUpdates(
    nodes: NodeConfig[],
    limit = 25,
    options?: {
      before?: string;
      after?: string;
      parties?: string[];
      templates?: string[];
      partyMode?: string;
      mode?: string;
      hideSplice?: boolean;
    },
  ): Promise<GlobalRecentUpdatesResponse> {
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0 ? Math.trunc(Number(limit)) : 25;
    const beforeCursor = decodeGlobalUpdateCursor(options?.before);
    const afterCursor = beforeCursor === null ? decodeGlobalUpdateCursor(options?.after) : null;
    const parties = options?.parties;
    const templates = options?.templates;
    const partyMode = options?.partyMode ?? options?.mode;
    const hideSplice = options?.hideSplice === true;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const pageSize = Math.max(normalizedLimit * 2, normalizedLimit + 1);
    const nodeStates = nodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      exhausted: false,
    }));
    const mergedUpdatesByKey = new Map<string, GlobalMergedUpdate>();

    const filterUpdates = (updates: GlobalMergedUpdate[]): GlobalMergedUpdate[] => {
      if (beforeCursor !== null) {
        return updates.filter(
          (update) =>
            compareGlobalMergedUpdates(update, beforeCursor) > 0,
        );
      }

      if (afterCursor !== null) {
        return updates.filter(
          (update) =>
            compareGlobalMergedUpdates(update, afterCursor) < 0,
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

      const responses = await Promise.all(
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

      responses.forEach((response, index) => {
        const state = nodesToFetch[index];

        for (const update of response.updates) {
          mergedUpdatesByKey.set(`${state.node.id}:${update.eventOffset}:${update.updateId}`, {
            nodeId: state.node.id,
            label: state.node.label,
            eventOffset: update.eventOffset,
            updateId: update.updateId,
            recordTime: update.recordTime,
            parties: update.parties,
          });
        }

        state.nextBefore = response.nextBefore ?? undefined;
        state.exhausted = response.nextBefore === null;
      });

      const sortedUpdates = Array.from(mergedUpdatesByKey.values()).sort(compareGlobalMergedUpdates);
      filteredUpdates = filterUpdates(sortedUpdates);
      hasMoreInDirection = filteredUpdates.length > normalizedLimit;

      if (hasMoreInDirection || nodeStates.every((state) => state.exhausted)) {
        break;
      }
    }

    const updates = filteredUpdates.slice(0, normalizedLimit);

    return {
      limit: normalizedLimit,
      nextBefore:
        updates.length > 0 && (useAfterCursor || hasMoreInDirection)
          ? encodeGlobalUpdateCursor(updates[updates.length - 1]!)
          : null,
      nextAfter:
        updates.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalUpdateCursor(updates[0]!)
              : null
            : beforeCursor
              ? encodeGlobalUpdateCursor(updates[0]!)
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
        ? [`Failed to search ${subject} on ${nodes[index]?.label ?? nodes[index]?.id ?? 'unknown node'}`]
        : [],
    );
    const hasSuccess = settled.some((result) => result.status === 'fulfilled');

    return {
      status: warnings.length === 0 ? 'ok' : hasSuccess ? 'partial' : 'failed',
      warnings,
      hasSuccess,
    };
  }

  private isExactMatch(query: string, values: Array<string | null | undefined>): boolean {
    return values.some((value) => typeof value === 'string' && value === query);
  }

  private hasPrefixMatch(query: string, values: Array<string | null | undefined>): boolean {
    return values.some((value) => typeof value === 'string' && value.startsWith(query));
  }

  private async searchUpdates(
    nodes: NodeConfig[],
    query: string,
  ): Promise<SearchResultGroup<SearchUpdateResult>> {
    if (nodes.length === 0) {
      return this.emptySearchGroup<SearchUpdateResult>();
    }

    const settled = await Promise.allSettled(
      nodes.map((node) => this.searchUpdatesForNode(node, query, SEARCH_GROUP_LIMIT + 1)),
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
    const { status, warnings } = this.resolveNodeSearchStatus(settled, 'updates', nodes);

    return this.finalizeSearchGroup<SearchUpdateResult>({
      items: ordered.slice(0, SEARCH_GROUP_LIMIT).map(({ exact: _exact, ...item }) => item),
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
    const client = this.clientFactory.getClient(node);
    const rows = await this.querySearchUpdateMetaRows(client.query.bind(client), query, limit);
    const dedupedRows = new Map<string, UpdateMetaRow>();

    for (const row of rows) {
      const eventOffset = this.extractEventOffset(row);
      if (!dedupedRows.has(eventOffset)) {
        dedupedRows.set(eventOffset, row);
      }
    }

    const rawRows = Array.from(dedupedRows.values());
    const rawUpdateIds = rawRows.map((row) => row.update_id);
    const partiesByUpdateId =
      rawUpdateIds.length > 0
        ? await this.fetchPartiesByUpdateId(client.query.bind(client), rawUpdateIds)
        : new Map<string, string[]>();

    return rawRows
      .map((row) => {
        const normalizedUpdateId = this.normalizeUpdateId(row.update_id);
        const eventOffset = this.extractEventOffset(row);
        const exact = this.isExactMatch(query, [eventOffset, normalizedUpdateId]);
        const matches = exact || this.hasPrefixMatch(query, [eventOffset, normalizedUpdateId]);

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
      nodes.map((node) => this.searchContractsForNode(node, query, SEARCH_GROUP_LIMIT + 1)),
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
    const { status, warnings } = this.resolveNodeSearchStatus(settled, 'contracts', nodes);

    return this.finalizeSearchGroup<SearchContractResult>({
      items: ordered.slice(0, SEARCH_GROUP_LIMIT).map(({ exact: _exact, ...item }) => item),
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
    const client = this.clientFactory.getClient(node);
    const result = await client.query(searchContractsQuery(query, limit));
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
          existing.nodeIds = Array.from(new Set([...existing.nodeIds, result.value.node.id])).sort();
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
    const { status, warnings } = this.resolveNodeSearchStatus(settled, 'parties', nodes);

    return this.finalizeSearchGroup<SearchPartyResult>({
      items: ordered.slice(0, SEARCH_GROUP_LIMIT).map(({ exact: _exact, ...item }) => item),
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
        existing.packages.push({ packageId: pkg.packageId, version: pkg.version });
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
    queryFn: (sql: string) => Promise<{ rows: unknown[] }>,
    searchQuery: string,
    limit: number,
  ): Promise<UpdateMetaRow[]> {
    try {
      const result = await queryFn(searchUpdatesQuery(searchQuery, limit));
      return (result.rows as UpdateMetaRow[]) ?? [];
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        throw error;
      }
    }

    const fallbackResult = await queryFn(normalizedSearchUpdatesQuery(searchQuery, limit));
    return (fallbackResult.rows as UpdateMetaRow[]) ?? [];
  }

  private async queryRecentUpdateMetaRows(
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    limit: number,
    before?: string,
    after?: string,
    parties?: string[],
    templates?: string[],
    mode?: string,
    hideSplice?: boolean,
  ): Promise<UpdateMetaRow[]> {
    try {
      const result = await query(
        recentUpdatesQuery(limit, before, after, parties, templates, mode, hideSplice),
      );
      return (result.rows as UpdateMetaRow[]) ?? [];
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        throw error;
      }
    }

    const fallbackResult = await query(
      normalizedRecentUpdatesQuery(limit, before, after, parties, templates, mode, hideSplice),
    );
    return (fallbackResult.rows as UpdateMetaRow[]) ?? [];
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
    const client = this.clientFactory.getClient(node);
    const normalizedLimit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0
        ? Math.trunc(options.limit)
        : 25;
    const before = options?.before;
    const after = options?.after;
    const parties = options?.parties;
    const templates = options?.templates;
    const partyMode = options?.partyMode;
    const hideSplice = options?.hideSplice === true;
    const useAfterCursor = Boolean(after && !before);
    const result = await client.query(
      activeContractsQuery(
        normalizedLimit,
        before,
        after,
        parties,
        templates,
        partyMode,
        hideSplice,
      ),
    );
    const rawRows = (result.rows as ActiveContractRow[]) ?? [];
    const hasMoreInQuery = rawRows.length > normalizedLimit;
    const trimmedRows = rawRows.slice(0, normalizedLimit);
    const orderedContracts = (useAfterCursor ? [...trimmedRows].reverse() : trimmedRows).map(
      (row) => ({
        contractId: row.contract_id,
        templateId: this.normalizeTemplateIdentifier(row.template_id),
        createdRecordTime: row.created_record_time ?? null,
        createdEventOffset: this.normalizeOptionalScalar(row.created_event_offset),
      }),
    );

    return {
      nodeId: node.id,
      label: node.label,
      limit: normalizedLimit,
      nextBefore:
        orderedContracts.length > 0 && (useAfterCursor || hasMoreInQuery)
          ? orderedContracts[orderedContracts.length - 1]?.createdEventOffset ?? null
          : null,
      nextAfter:
        orderedContracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInQuery
              ? orderedContracts[0]?.createdEventOffset ?? null
              : null
            : before
              ? orderedContracts[0]?.createdEventOffset ?? null
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
  ): Promise<Array<{ timestamp: string; activityValue: number; latestOffset: string | null }>> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(activityBucketsQuery(days, bucketMinutes));
    const rows = (result.rows as ActivityBucketRow[]) ?? [];

    return rows
      .filter((row): row is ActivityBucketRow & { bucket_timestamp: string } =>
        typeof row.bucket_timestamp === 'string',
      )
      .map((row) => ({
        timestamp: row.bucket_timestamp,
        activityValue: Number(row.activity_value ?? 0),
        latestOffset: row.latest_offset ?? null,
      }));
  }

  async fetchPackageDetail(packageId: string): Promise<PackageDetailResponse> {
    const metadata = this.packageCacheService?.getPackageMetadata(packageId) ?? null;
    if (!metadata) {
      throw new Error('Package not found');
    }

    const seenOnNodes = (this.packageCacheService?.listNodesForPackage(packageId) ?? []).map(
      (row) => ({
        nodeId: row.nodeId,
        packageName: row.packageName,
        packageVersion: row.packageVersion,
        seenAt: row.seenAt,
      }),
    );

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
        status: inspection.reason === 'missing_package' ? 'missing_package' : 'invalid_package',
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
      modules: [...inspection.definition.modules].sort((left, right) => left.localeCompare(right)),
      templates: [...inspection.definition.templates].sort((left, right) =>
        left.templateId.localeCompare(right.templateId),
      ),
      dataTypes: [...inspection.definition.dataTypes].sort((left, right) =>
        left.typeId.localeCompare(right.typeId),
      ),
    };
  }

  async fetchPackagesByName(packageName: string): Promise<PackageFamilyResponse> {
    const packages = this.packageCacheService?.listPackagesByName(packageName) ?? [];
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
      Array<{ packageId: string; version: string | null; uploadedAt: string | null; seenAt: string }>
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
      packagesByName: Array.from(groupedPackages.entries()).map(([packageName, packages]) => ({
        packageName,
        packages,
      })),
    };
  }

  async fetchTemplates(): Promise<TemplateFilterResponse> {
    const packageIds = (this.packageCacheService?.listPackages() ?? []).map((pkg) => pkg.packageId);
    return this.buildTemplateFilterResponse(packageIds);
  }

  async fetchNodeTemplates(node: NodeConfig): Promise<TemplateFilterResponse> {
    const packageIds = Array.from(
      new Set((this.packageCacheService?.listPackagesForNode(node.id) ?? []).map((pkg) => pkg.packageId)),
    );
    return this.buildTemplateFilterResponse(packageIds);
  }

  async fetchActiveParties(nodes: NodeConfig[]): Promise<ActivePartiesResponse> {
    return {
      nodes: await Promise.all(
        nodes.map(async (node) => ({
          nodeId: node.id,
          label: node.label,
          mode: node.mode,
          parties: await this.fetchActivePartiesForNode(node),
        })),
      ),
    };
  }

  async fetchPartyDetail(nodes: NodeConfig[], partyId: string): Promise<PartyDetailResponse> {
    const normalizedPartyId = this.normalizePartyIdentifier(partyId);
    const activePartiesByNode = await Promise.all(
      nodes.map(async (node) => ({
        node,
        parties: await this.fetchActivePartiesForNode(node),
      })),
    );
    const recentUpdatesByNode = await Promise.all(
      nodes.map(async (node) => ({
        node,
        updates: await this.fetchPartyRecentUpdatesForNode(node, normalizedPartyId, 10),
      })),
    );
    const recentContractsByNode = await Promise.all(
      nodes.map(async (node) => ({
        node,
        contracts: await this.fetchPartyRecentContractsForNode(node, normalizedPartyId, 10),
      })),
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

    const recentUpdates = recentUpdatesByNode
      .flatMap(({ updates }) => updates)
      .sort((left, right) => Date.parse(right.recordTime ?? '') - Date.parse(left.recordTime ?? ''))
      .slice(0, 10);
    const recentContracts = recentContractsByNode
      .flatMap(({ contracts }) => contracts)
      .sort((left, right) => Date.parse(right.recordTime ?? '') - Date.parse(left.recordTime ?? ''))
      .slice(0, 10);
    const observedNodes = Array.from(nodesById.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );

    if (observedNodes.length === 0 && recentUpdates.length === 0 && recentContracts.length === 0) {
      throw new Error('Party not found');
    }

    const grpcOperationsService = this.grpcOperationsService;
    const partyTopologyByNode = grpcOperationsService
      ? (
          await Promise.all(
            observedNodes.map(async (observedNode) => {
              const node = nodes.find((candidate) => candidate.id === observedNode.nodeId);
              if (!node) {
                return null;
              }

              return grpcOperationsService.fetchPartyTopology(node, normalizedPartyId);
            }),
          )
        )
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((left, right) => left.label.localeCompare(right.label))
      : [];

    return {
      partyId: normalizedPartyId,
      nodeCount: observedNodes.length,
      recentUpdateCount: recentUpdates.length,
      recentContractCount: recentContracts.length,
      nodes: observedNodes,
      recentUpdates,
      recentContracts,
      partyTopologyByNode,
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
    },
  ): Promise<GlobalRecentUpdatesResponse> {
    return this.fetchGlobalRecentUpdates(nodes, options?.limit ?? 25, {
      before: options?.before,
      after: options?.after,
      parties: [this.normalizePartyIdentifier(partyId)],
      templates: options?.templates,
      partyMode: options?.partyMode,
      hideSplice: options?.hideSplice,
    });
  }

  async fetchGlobalContracts(
    nodes: NodeConfig[],
    limit = 25,
    options?: {
      before?: string;
      after?: string;
      parties?: string[];
      templates?: string[];
      partyMode?: string;
      hideSplice?: boolean;
    },
  ): Promise<GlobalContractsResponse> {
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : 25;
    const beforeCursor = decodeGlobalContractCursor(options?.before);
    const afterCursor = beforeCursor === null ? decodeGlobalContractCursor(options?.after) : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const pageSize = Math.max(normalizedLimit * 2, normalizedLimit + 1);
    const nodeStates = nodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      exhausted: false,
    }));
    const mergedContractsByKey = new Map<string, GlobalContractsResponse['contracts'][number]>();
    const activePartyFilters = normalizePartyFilters(options?.parties);
    const activeTemplateFilters = normalizeTemplateFilters(options?.templates);
    const partyMode = normalizePartyFilterMode(options?.partyMode);
    const hideSplice = options?.hideSplice === true;

    const filterContracts = (
      contracts: GlobalContractsResponse['contracts'],
    ): GlobalContractsResponse['contracts'] =>
      contracts.filter((contract) => {
        if (beforeCursor !== null && compareGlobalMergedContracts(contract, beforeCursor) <= 0) {
          return false;
        }

        if (afterCursor !== null && compareGlobalMergedContracts(contract, afterCursor) >= 0) {
          return false;
        }

        const normalizedTemplateId = this.normalizeTemplateIdentifier(contract.templateId);
        if (
          activeTemplateFilters.length > 0 &&
          (!normalizedTemplateId || !activeTemplateFilters.includes(normalizedTemplateId))
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

      const responses = await Promise.all(
        nodesToFetch.map((state) =>
          this.fetchNodeContracts(state.node, {
            limit: pageSize,
            before: state.nextBefore,
            parties: activePartyFilters.length > 0 ? activePartyFilters : undefined,
            templates: activeTemplateFilters.length > 0 ? activeTemplateFilters : undefined,
            partyMode,
            hideSplice,
          }),
        ),
      );

      responses.forEach((response, index) => {
        const state = nodesToFetch[index];

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

      const sortedContracts = Array.from(mergedContractsByKey.values()).sort(compareGlobalMergedContracts);
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
          ? encodeGlobalContractCursor(contracts[contracts.length - 1]!)
          : null,
      nextAfter:
        contracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalContractCursor(contracts[0]!)
              : null
            : beforeCursor
              ? encodeGlobalContractCursor(contracts[0]!)
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
    },
  ): Promise<PartyContractsResponse> {
    const normalizedPartyId = this.normalizePartyIdentifier(partyId);
    const normalizedLimit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0
        ? Math.trunc(options.limit)
        : 25;
    const beforeCursor = decodeGlobalContractCursor(options?.before);
    const afterCursor = beforeCursor === null ? decodeGlobalContractCursor(options?.after) : null;
    const useAfterCursor = Boolean(afterCursor && !beforeCursor);
    const pageSize = Math.max(normalizedLimit * 2, normalizedLimit + 1);
    const nodeStates = nodes.map((node) => ({
      node,
      nextBefore: undefined as string | undefined,
      exhausted: false,
    }));
    const mergedContractsByKey = new Map<string, GlobalMergedContract>();
    const activeTemplateFilters = normalizeTemplateFilters(options?.templates);
    const hideSplice = options?.hideSplice === true;

    const filterContracts = (contracts: GlobalMergedContract[]): GlobalMergedContract[] => {
      return contracts.filter((contract) => {
        if (beforeCursor !== null && compareGlobalMergedContracts(contract, beforeCursor) <= 0) {
          return false;
        }

        if (afterCursor !== null && compareGlobalMergedContracts(contract, afterCursor) >= 0) {
          return false;
        }

        const normalizedTemplateId = this.normalizeTemplateIdentifier(contract.templateId);
        if (
          activeTemplateFilters.length > 0 &&
          (!normalizedTemplateId || !activeTemplateFilters.includes(normalizedTemplateId))
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

      const responses = await Promise.all(
        nodesToFetch.map((state) =>
          this.fetchPartyContractsForNode(state.node, normalizedPartyId, {
            limit: pageSize,
            before: state.nextBefore,
          }),
        ),
      );

      responses.forEach((response, index) => {
        const state = nodesToFetch[index];

        for (const contract of response.contracts) {
          mergedContractsByKey.set(`${contract.nodeId}:${contract.contractId}`, contract);
        }

        state.nextBefore = response.nextBefore ?? undefined;
        state.exhausted = response.nextBefore === null;
      });

      const sortedContracts = Array.from(mergedContractsByKey.values()).sort(compareGlobalMergedContracts);
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
          ? encodeGlobalContractCursor(contracts[contracts.length - 1]!)
          : null,
      nextAfter:
        contracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalContractCursor(contracts[0]!)
              : null
            : beforeCursor
              ? encodeGlobalContractCursor(contracts[0]!)
              : null,
      contracts,
    };
  }

  async fetchTokens(nodes: NodeConfig[]): Promise<TokensResponse> {
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        tokens: await this.loadCachedObservedTokens(node),
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
        (result): result is PromiseRejectedResult => result.status === 'rejected',
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

    return {
      tokens: Array.from(dedupedTokens.values()).sort(
        (left, right) => left.name.localeCompare(right.name) || left.tokenId.localeCompare(right.tokenId),
      ),
    };
  }

  async fetchLatestTokenTransfers(
    nodes: NodeConfig[],
    limit = 25,
    options?: {
      before?: string;
      after?: string;
      fromParties?: string[];
      toParties?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): Promise<TokenTransfersResponse> {
    const mergedTransfers = this.filterTokenTransfersByParties(
      await this.loadMergedTokenTransfers(nodes),
      options,
    );

    return this.paginateTokenTransfers(mergedTransfers, limit, options);
  }

  async fetchTokenTransfers(
    nodes: NodeConfig[],
    tokenId: string,
    limit = 25,
    options?: {
      before?: string;
      after?: string;
      fromParties?: string[];
      toParties?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): Promise<TokenTransfersResponse> {
    const normalizedTokenId = this.normalizeTokenId(tokenId);
    await this.findObservedToken(nodes, normalizedTokenId);
    const mergedTransfers = this.filterTokenTransfersByParties(
      await this.loadMergedTokenTransfers(nodes),
      options,
    );

    return this.paginateTokenTransfers(
      mergedTransfers.filter((transfer) => transfer.tokenId === normalizedTokenId),
      limit,
      options,
    );
  }

  async fetchTokenTransferDetail(
    nodes: NodeConfig[],
    updateId: string,
  ): Promise<TokenTransferSummary> {
    const normalizedUpdateId = this.normalizeUpdateId(updateId);
    const transfer = (await this.loadMergedTokenTransfers(nodes))
      .sort(compareGlobalTokenTransfers)
      .find((entry) => entry.updateId === normalizedUpdateId);

    if (!transfer) {
      throw new Error('Token transfer not found');
    }

    return transfer;
  }

  async fetchTokenDetail(nodes: NodeConfig[], tokenId: string): Promise<TokenDetailResponse> {
    const normalizedTokenId = this.normalizeTokenId(tokenId);
    const token = await this.findObservedToken(nodes, normalizedTokenId);
    const transfersResponse = await this.fetchTokenTransfers(nodes, normalizedTokenId, 25);

    return {
      token,
      transfers: transfersResponse.transfers,
    };
  }

  async fetchTokenHolders(
    nodes: NodeConfig[],
    tokenId: string,
    limit = 25,
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
        (result): result is PromiseRejectedResult => result.status === 'rejected',
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
    limit = 25,
    options?: { before?: string; after?: string },
  ): TokenHoldersResponse {
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0 ? Math.trunc(Number(limit)) : 25;
    const beforeCursor = decodeGlobalTokenHolderCursor(options?.before);
    const afterCursor = beforeCursor === null ? decodeGlobalTokenHolderCursor(options?.after) : null;
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
          ? encodeGlobalTokenHolderCursor(pagedHolders[pagedHolders.length - 1]!)
          : null,
      nextAfter:
        pagedHolders.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalTokenHolderCursor(pagedHolders[0]!)
              : null
            : beforeCursor
              ? encodeGlobalTokenHolderCursor(pagedHolders[0]!)
              : null,
      holders: pagedHolders,
    };
  }

  private async loadMergedTokenTransfers(nodes: NodeConfig[]): Promise<TokenTransferSummary[]> {
    const refreshResults = await Promise.allSettled(
      nodes.map(async (node) => ({
        node,
        transfers: await this.loadCachedTokenTransfers(node),
      })),
    );
    const successfulTransfers = refreshResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          node: NodeConfig;
          transfers: NodeTokenTransferObservation[];
        }> => result.status === 'fulfilled',
      )
      .flatMap((result) => result.value.transfers);

    if (successfulTransfers.length === 0) {
      const firstFailure = refreshResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (firstFailure) {
        throw firstFailure.reason;
      }
    }

    return this.mergeTokenTransfers(successfulTransfers);
  }

  private paginateTokenTransfers(
    transfers: TokenTransferSummary[],
    limit = 25,
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
      Number.isFinite(limit) && Number(limit) > 0 ? Math.trunc(Number(limit)) : 25;
    const beforeCursor = decodeGlobalTokenTransferCursor(options?.before);
    const afterCursor =
      beforeCursor === null ? decodeGlobalTokenTransferCursor(options?.after) : null;
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
          ? encodeGlobalTokenTransferCursor(pagedTransfers[pagedTransfers.length - 1]!)
          : null,
      nextAfter:
        pagedTransfers.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInDirection
              ? encodeGlobalTokenTransferCursor(pagedTransfers[0]!)
              : null
            : beforeCursor
              ? encodeGlobalTokenTransferCursor(pagedTransfers[0]!)
              : null,
      transfers: pagedTransfers,
    };
  }

  private filterTokenTransfersByParties(
    transfers: TokenTransferSummary[],
    options?: {
      fromParties?: string[];
      toParties?: string[];
      amountGt?: string;
      amountLt?: string;
    },
  ): TokenTransferSummary[] {
    const activeFromParties = normalizePartyFilters(options?.fromParties);
    const activeToParties = normalizePartyFilters(options?.toParties);
    const amountGt = options?.amountGt?.trim() || null;
    const amountLt = options?.amountLt?.trim() || null;

    if (
      activeFromParties.length === 0 &&
      activeToParties.length === 0 &&
      amountGt === null &&
      amountLt === null
    ) {
      return transfers;
    }

    return transfers.filter((transfer) => {
      const matchesFrom =
        activeFromParties.length === 0 ||
        (transfer.sender !== null && activeFromParties.includes(transfer.sender));
      const matchesTo =
        activeToParties.length === 0 ||
        (transfer.receiver !== null && activeToParties.includes(transfer.receiver));
      const matchesAmountGt =
        amountGt === null ||
        (transfer.amount !== null && this.compareNumericStrings(transfer.amount, amountGt) > 0);
      const matchesAmountLt =
        amountLt === null ||
        (transfer.amount !== null && this.compareNumericStrings(transfer.amount, amountLt) < 0);

      return matchesFrom && matchesTo && matchesAmountGt && matchesAmountLt;
    });
  }

  async fetchUpdateDetail(
    node: NodeConfig,
    eventOffset: string,
  ): Promise<NodeUpdateDetailResponse> {
    const client = this.clientFactory.getClient(node);
    const detailResult = await client.query(singleUpdateQuery(eventOffset));
    const detailRows = (detailResult.rows as UpdateDetailRow[]) ?? [];
    const detailRow = detailRows[0];

    if (!detailRow) {
      throw new Error('Update not found');
    }

    const rawUpdateId = this.extractRawUpdateId(detailRow);
    const matchedEventOffset = this.extractEventOffset(detailRow);
    const canonicalUpdateId = this.normalizeUpdateId(rawUpdateId);
    const partiesByUpdateId = await this.fetchPartiesByUpdateId(client.query.bind(client), [rawUpdateId]);
    const events = await this.fetchEventsByUpdateId(client.query.bind(client), rawUpdateId);
    const exerciseData = this.shouldResolveRewardCoupon(events)
      ? await this.fetchRewardCouponDetails(client.query.bind(client), rawUpdateId)
      : null;

    return {
      nodeId: node.id,
      label: node.label,
      eventOffset: matchedEventOffset,
      updateId: canonicalUpdateId,
      recordTime: this.extractIsoRecordTime(detailRow),
      parties: partiesByUpdateId.get(canonicalUpdateId) ?? [],
      meta: this.extractMeta(detailRow),
      events: this.attachRewardCouponDetails(events, exerciseData),
    };
  }

  async fetchContractDetail(
    node: NodeConfig,
    contractId: string,
  ): Promise<NodeContractDetailResponse> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(contractDetailQuery(contractId));
    const row = (result.rows as ContractDetailRow[])[0];

    if (!row) {
      throw new Error('Contract not found');
    }

    const templateId = this.normalizeTemplateIdentifier(row.template_id);
    const packageId = typeof row.package_id === 'string' ? row.package_id : null;
    const packageMetadata =
      packageId && this.packageCacheService ? this.packageCacheService.getPackage(packageId) : null;

    return {
      nodeId: node.id,
      label: node.label,
      contractId: row.contract_id,
      templateId,
      packageId,
      packageName: packageMetadata?.name ?? null,
      packageVersion: packageMetadata?.version ?? null,
      createdUpdateId: typeof row.created_update_id === 'string' ? row.created_update_id : null,
      createdEventOffset: this.normalizeOptionalScalar(row.created_event_offset),
      createdRecordTime: typeof row.created_record_time === 'string' ? row.created_record_time : null,
      archivedUpdateId: typeof row.archived_update_id === 'string' ? row.archived_update_id : null,
      archivedEventOffset: this.normalizeOptionalScalar(row.archived_event_offset),
      archivedRecordTime: typeof row.archived_record_time === 'string' ? row.archived_record_time : null,
      contractData: await this.decodeContractData(
        packageId,
        templateId,
        row.contract_instance,
      ),
    };
  }

  private async querySummary(
    query: (sql: string) => Promise<{ rows: SummaryRow[] }>,
  ): Promise<{ rows: SummaryRow[] }> {
    try {
      return await query(ACTIVE_QUERY);
    } catch (error) {
      if (!this.shouldFallbackToParticipantTables(error)) {
        throw error;
      }
    }

    return query(PARTICIPANT_FALLBACK_QUERY);
  }

  private async fetchPartyRecentUpdatesForNode(
    node: NodeConfig,
    partyId: string,
    limit: number,
  ): Promise<PartyDetailResponse['recentUpdates']> {
    const client = this.clientFactory.getClient(node);
    let rows: UpdateMetaRow[] = [];

    try {
      const result = await client.query(partyRecentUpdatesQuery(partyId, limit));
      rows = (result.rows as UpdateMetaRow[]) ?? [];
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        throw error;
      }

      const result = await client.query(normalizedPartyRecentUpdatesQuery(partyId, limit));
      rows = (result.rows as UpdateMetaRow[]) ?? [];
    }

    const rawUpdateIds = rows.map((row) => row.update_id);
    const partiesByUpdateId =
      rawUpdateIds.length > 0
        ? await this.fetchPartiesByUpdateId(client.query.bind(client), rawUpdateIds)
        : new Map<string, string[]>();

    return rows.map((row) => {
      const updateId = this.normalizeUpdateId(row.update_id);

      return {
        nodeId: node.id,
        label: node.label,
        eventOffset: this.extractEventOffset(row),
        updateId,
        recordTime: typeof row.record_time === 'string' ? row.record_time : null,
        parties: partiesByUpdateId.get(updateId) ?? [],
      };
    });
  }

  private async fetchPartyRecentContractsForNode(
    node: NodeConfig,
    partyId: string,
    limit: number,
  ): Promise<PartyDetailResponse['recentContracts']> {
    const response = await this.fetchPartyContractsForNode(node, partyId, { limit });
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
    const client = this.clientFactory.getClient(node);
    const normalizedLimit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0
        ? Math.trunc(options.limit)
        : 25;
    const before = options?.before;
    const after = options?.after;
    const useAfterCursor = Boolean(after && !before);
    let rows: PartyContractRow[] = [];

    try {
      const result = await client.query(
        partyRecentContractsQuery(partyId, normalizedLimit, before, after),
      );
      rows = (result.rows as PartyContractRow[]) ?? [];
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        throw error;
      }

      const result = await client.query(
        normalizedPartyRecentContractsQuery(partyId, normalizedLimit, before, after),
      );
      rows = (result.rows as PartyContractRow[]) ?? [];
    }

    const hasMoreInQuery = rows.length > normalizedLimit;
    const trimmedRows = rows.slice(0, normalizedLimit);
    const orderedContracts = (useAfterCursor ? [...trimmedRows].reverse() : trimmedRows)
      .filter((row): row is PartyContractRow & { contract_id: string } => typeof row.contract_id === 'string')
      .map((row) => {
        const packageId = this.normalizePackageIdentifier(row.package_id ?? null);
        const packageMetadata =
          packageId && this.packageCacheService ? this.packageCacheService.getPackage(packageId) : null;

        return {
          nodeId: node.id,
          label: node.label,
          contractId: row.contract_id,
          templateId: this.normalizeTemplateIdentifier(row.template_id),
          packageId,
          packageName: packageMetadata?.name ?? null,
          packageVersion: packageMetadata?.version ?? null,
          recordTime: typeof row.record_time === 'string' ? row.record_time : null,
          createdEventOffset: this.normalizeOptionalScalar(row.created_event_offset),
        };
      });

    return {
      nextBefore:
        orderedContracts.length > 0 && (useAfterCursor || hasMoreInQuery)
          ? orderedContracts[orderedContracts.length - 1]?.createdEventOffset ?? null
          : null,
      nextAfter:
        orderedContracts.length === 0
          ? null
          : useAfterCursor
            ? hasMoreInQuery
              ? orderedContracts[0]?.createdEventOffset ?? null
              : null
            : before
              ? orderedContracts[0]?.createdEventOffset ?? null
              : null,
      contracts: orderedContracts.map(({ createdEventOffset: _, ...contract }) => contract),
    };
  }

  private shouldFallbackToParticipantTables(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = (error as Error & { code?: string }).code;
    return code === '42883' || error.message.includes('function active() does not exist');
  }

  private shouldFallbackToNormalizedEventTables(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = (error as Error & { code?: string }).code;
    return code === '42P01' || error.message.includes('does not exist');
  }

  private async fetchActivePartiesForNode(node: NodeConfig): Promise<string[]> {
    const client = this.clientFactory.getClient(node);

    try {
      const result = await client.query(activePartiesQuery());
      const row = (result.rows as ActivePartiesRow[])[0];
      return this.normalizeParties(row?.parties ?? null);
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        throw error;
      }
    }

    const fallbackResult = await client.query(normalizedActivePartiesQuery());
    const fallbackRow = (fallbackResult.rows as ActivePartiesRow[])[0];
    return this.normalizeParties(fallbackRow?.parties ?? null);
  }

  private async fetchPartiesByUpdateId(
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    updateIds: string[],
  ): Promise<Map<string, string[]>> {
    try {
      const result = await query(recentUpdatePartiesQuery(updateIds));
      const rows = (result.rows as UpdatePartiesRow[]) ?? [];

      return new Map(
        rows.map((row) => [
          this.normalizeUpdateId(row.update_id),
          this.normalizeParties(row.parties),
        ]),
      );
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        return new Map();
      }
    }

    try {
      const fallbackResult = await query(normalizedRecentUpdatePartiesQuery(updateIds));
      const fallbackRows = (fallbackResult.rows as UpdatePartiesRow[]) ?? [];

      return new Map(
        fallbackRows.map((row) => [
          this.normalizeUpdateId(row.update_id),
          this.normalizeParties(row.parties),
        ]),
      );
    } catch {
      return new Map();
    }
  }

  private async loadCachedObservedTokens(node: NodeConfig): Promise<TokenSummary[]> {
    const cached = this.observedTokensByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.tokens;
    }

    const tokens = await this.fetchObservedTokensForNode(node, TOKEN_TRANSFER_CACHE_LIMIT);
    this.observedTokensByNode.set(node.id, {
      cachedAt: Date.now(),
      tokens,
    });
    return tokens;
  }

  private async fetchObservedTokensForNode(node: NodeConfig, limit: number): Promise<TokenSummary[]> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(tokenRowsQuery(limit, TOKEN_DISCOVERY_TEMPLATE_IDS));
    const rows = (result.rows as TokenTransferRow[]) ?? [];
    const dedupedTokens = new Map<string, TokenSummary>();

    for (const row of rows) {
      const token = await this.normalizeObservedTokenRow(row);
      if (token && !dedupedTokens.has(token.tokenId)) {
        dedupedTokens.set(token.tokenId, token);
      }
    }

    return Array.from(dedupedTokens.values()).sort(
      (left, right) => left.name.localeCompare(right.name) || left.tokenId.localeCompare(right.tokenId),
    );
  }

  private async findObservedToken(nodes: NodeConfig[], tokenId: string): Promise<TokenSummary> {
    const tokensResponse = await this.fetchTokens(nodes);
    const token = tokensResponse.tokens.find((candidate) => candidate.tokenId === tokenId);

    if (!token) {
      throw new Error('Token not found');
    }

    return token;
  }

  private async normalizeObservedTokenRow(row: TokenTransferRow): Promise<TokenSummary | null> {
    const templateId = this.normalizeTemplateIdentifier(row.template_id);

    if (
      templateId === CANTON_COIN_TRANSFER_TEMPLATE_ID ||
      templateId === CANTON_COIN_AMULET_TEMPLATE_ID
    ) {
      return {
        tokenId: CANTON_COIN_TOKEN_ID,
        name: CANTON_COIN_TOKEN_NAME,
        symbol: null,
        source: 'pqs',
      };
    }

    if (templateId !== CIP56_HOLDING_TEMPLATE_ID && templateId !== CIP56_TRANSFER_TEMPLATE_ID) {
      return null;
    }

    const decoded = await this.decodeContractData(
      this.normalizePackageIdentifier(row.package_id),
      templateId,
      row.contract_instance,
    );

    return this.extractCip56TokenSummary(decoded);
  }

  private async loadCachedTokenHolders(node: NodeConfig): Promise<NodeTokenHolderObservation[]> {
    const cached = this.tokenHoldersByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.holders;
    }

    const holders = await this.fetchTokenHoldersForNode(node, TOKEN_TRANSFER_CACHE_LIMIT);
    this.tokenHoldersByNode.set(node.id, {
      cachedAt: Date.now(),
      holders,
    });
    return holders;
  }

  private async fetchTokenHoldersForNode(
    node: NodeConfig,
    limit: number,
  ): Promise<NodeTokenHolderObservation[]> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(tokenRowsQuery(limit, TOKEN_HOLDER_TEMPLATE_IDS));
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
      this.normalizePackageIdentifier(row.package_id),
      templateId,
      row.contract_instance,
    );

    if (decoded?.status !== 'decoded' || !this.isRecordValue(decoded.value)) {
      return null;
    }

    if (templateId === CIP56_HOLDING_TEMPLATE_ID) {
      const tokenSummary = this.extractCip56TokenSummary(decoded);
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
        amount: this.readNestedScalarField(decoded.value, ['amount', 'initialAmount']),
      };
    }

    return null;
  }

  private async loadCachedTokenTransfers(node: NodeConfig): Promise<NodeTokenTransferObservation[]> {
    const cached = this.tokenTransfersByNode.get(node.id);
    if (cached && Date.now() - cached.cachedAt < TOKEN_TRANSFER_CACHE_TTL_MS) {
      return cached.transfers;
    }

    const transfers = await this.fetchTokenTransfersForNode(node, TOKEN_TRANSFER_CACHE_LIMIT);
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
    const client = this.clientFactory.getClient(node);
    const result = await client.query(tokenRowsQuery(limit, TOKEN_TRANSFER_TEMPLATE_IDS));
    const rows = (result.rows as TokenTransferRow[]) ?? [];
    const transfers: NodeTokenTransferObservation[] = [];

    for (const row of rows) {
      const transfer = await this.normalizeTokenTransferRow(node, row);
      if (transfer) {
        transfers.push(transfer);
      }
    }

    return transfers.sort(compareGlobalTokenTransfers);
  }

  private async normalizeTokenTransferRow(
    node: NodeConfig,
    row: TokenTransferRow,
  ): Promise<NodeTokenTransferObservation | null> {
    const templateId = this.normalizeTemplateIdentifier(row.template_id);
    const decoded = await this.decodeContractData(
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
      nodes: [...transfer.nodes].sort((left, right) => left.label.localeCompare(right.label)),
    }));
  }

  private mergeTokenHolders(holders: NodeTokenHolderObservation[]): TokenHolderSummary[] {
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
        JSON.stringify([holder.tokenId, holder.partyId, holder.amount ?? '', holder.nodeId]);

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
        existing.amount = this.addNumericStrings(existing.amount, holder.amount);
        existing.observedContractIds.add(dedupeContractId);
      }
    }

    return Array.from(merged.values())
      .map(({ observedContractIds: _observedContractIds, ...holder }) => ({
        ...holder,
        nodes: [...holder.nodes].sort((left, right) => left.label.localeCompare(right.label)),
      }))
      .sort((left, right) => {
        const amountComparison = this.compareNumericStrings(left.amount, right.amount);
        if (amountComparison !== 0) {
          return -amountComparison;
        }

        return left.partyId.localeCompare(right.partyId);
      });
  }

  private buildTokenTransferDedupKey(transfer: {
    tokenId: string;
    amount: string | null;
    sender: string | null;
    receiver: string | null;
    updateId: string;
    recordTime: string | null;
  }): string {
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

  private compareNumericStrings(left: string | null, right: string | null): number {
    const leftValue = left === null ? Number.NEGATIVE_INFINITY : Number(left);
    const rightValue = right === null ? Number.NEGATIVE_INFINITY : Number(right);
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

  private addNumericStrings(left: string | null, right: string | null): string | null {
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

    return `${negative ? '-' : ''}${whole.toString()}.${fractional
      .toString()
      .padStart(scale, '0')}`;
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
    const paddedFractional = `${fractionalPart}${'0'.repeat(scale)}`.slice(0, scale);
    const digits = `${wholePart || '0'}${paddedFractional}`;
    const parsed = BigInt(digits || '0');

    return negative ? -parsed : parsed;
  }

  private normalizeUpdateId(updateId: string): string {
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
    if (!decoded || decoded.status !== 'decoded' || !this.isRecordValue(decoded.value)) {
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
        amount: this.readNestedScalarField(decoded.value, ['amount', 'initialAmount']),
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
    if (!decoded || decoded.status !== 'decoded' || !this.isRecordValue(decoded.value)) {
      return null;
    }

    const tokenId = this.readNestedScalarField(decoded.value, ['instrumentId', 'id']);
    if (!tokenId) {
      return null;
    }

    return {
      tokenId,
      name: this.readTextMapEntryField(decoded.value, ['meta', 'values'], 'name') ?? tokenId,
      symbol: this.readTextMapEntryField(decoded.value, ['meta', 'values'], 'symbol'),
      source: 'pqs',
    };
  }

  private async fetchEventsByUpdateId(
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    rawUpdateId: string,
  ): Promise<NodeUpdateDetailEvent[]> {
    try {
      const result = await query(updateEventsQuery(rawUpdateId));
      const rows = (result.rows as UpdateEventRow[]) ?? [];

      return Promise.all(rows.map((row) => this.normalizeEventRow(row)));
    } catch (error) {
      if (!this.shouldFallbackToNormalizedEventTables(error)) {
        throw error;
      }
    }

    const fallbackResult = await query(normalizedUpdateEventsQuery(rawUpdateId));
    const rows = (fallbackResult.rows as UpdateEventRow[]) ?? [];
    return Promise.all(rows.map((row) => this.normalizeEventRow(row)));
  }

  private shouldResolveRewardCoupon(events: NodeUpdateDetailEvent[]): boolean {
    return events.some((event) => event.choice === 'ReceiveSvRewardCoupon');
  }

  private async fetchRewardCouponDetails(
    query: (sql: string) => Promise<{ rows: unknown[] }>,
    rawUpdateId: string,
  ): Promise<NodeExerciseDecodeState | null> {
    try {
      const result = await query(rewardCouponInstanceQuery(rawUpdateId));
      const row = (result.rows as RewardCouponInstanceRow[])[0];

      if (!row || !Buffer.isBuffer(row.contract_instance)) {
        return null;
      }

      const decoded = this.decodeRewardCouponContractInstance(row.contract_instance);
      if (!decoded || decoded.status !== 'decoded' || !this.isRecordValue(decoded.value)) {
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
                      value: { kind: 'contract_id', value: row.coupon_contract_id },
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

  private async normalizeEventRow(row: UpdateEventRow): Promise<NodeUpdateDetailEvent> {
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
          ? await this.decodeContractData(packageId, templateId, row.contract_instance ?? null)
          : null,
      exerciseData:
        row.event_kind === 'create'
          ? null
          : await this.decodeExerciseData({
              packageId,
              templateId,
              rawChoice,
              exerciseArgument: row.exercise_argument ?? null,
              exerciseResult: row.exercise_result ?? null,
            }),
      raw: row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw) ? row.raw : {},
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
    const contractPayload = this.getFirstLengthDelimitedField(contractInstance, 2);
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
    packageId: string | null,
    templateId: string | null,
    contractInstance: Buffer | null,
  ): Promise<NodeDecodeState<NodeDecodedDamlValue> | null> {
    if (!Buffer.isBuffer(contractInstance) || !templateId) {
      return null;
    }

    if (templateId === 'Splice.Amulet:SvRewardCoupon') {
      return this.decodeRewardCouponContractInstance(contractInstance);
    }

    if (!this.damlValueDecoder) {
      return null;
    }

    return this.damlValueDecoder.decodeContractInstance({
      packageId,
      templateId,
      contractInstance,
    });
  }

  private async decodeExerciseData(input: {
    packageId: string | null;
    templateId: string | null;
    rawChoice: string | null;
    exerciseArgument: Buffer | null;
    exerciseResult: Buffer | null;
  }): Promise<NodeExerciseDecodeState | null> {
    if (!this.damlValueDecoder) {
      return null;
    }

    return this.damlValueDecoder.decodeExerciseValue(input);
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
    return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'record';
  }

  private findRecordField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): Extract<NodeDecodedDamlValue, { kind: 'record' }> | null {
    const field = value.fields.find((candidate) => candidate.label === label)?.value;
    return field && this.isRecordValue(field) ? field : null;
  }

  private readScalarField(
    value: Extract<NodeDecodedDamlValue, { kind: 'record' }>,
    label: string,
  ): string | null {
    const field = value.fields.find((candidate) => candidate.label === label)?.value;
    if (field === null || field === undefined) {
      return null;
    }

    if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
      return String(field);
    }

    if (typeof field === 'object' && field !== null && 'kind' in field && field.kind === 'contract_id') {
      return field.value;
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

        if (typeof field === 'object' && field !== null && 'kind' in field && field.kind === 'contract_id') {
          return field.value;
        }

        return null;
      }

      current = field;
    }

    return null;
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

    if (
      !current ||
      typeof current !== 'object' ||
      !('kind' in current) ||
      current.kind !== 'text_map'
    ) {
      return null;
    }

    const entry = current.entries.find((candidate) => candidate.key === key)?.value;
    if (entry === null || entry === undefined) {
      return null;
    }

    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
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

  private getFirstLengthDelimitedField(message: Buffer, fieldNumber: number): Buffer | null {
    return this.parseProtobufFields(message).find(
      (field) => field.fieldNumber === fieldNumber && field.buffer,
    )?.buffer ?? null;
  }

  private getAllLengthDelimitedFields(message: Buffer, fieldNumber: number): Buffer[] {
    return this.parseProtobufFields(message)
      .filter((field): field is { fieldNumber: number; buffer: Buffer } =>
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
    const fields: Array<{ fieldNumber: number; buffer?: Buffer; value?: number }> = [];
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

  private readVarint(buffer: Buffer, offset: number): { value: bigint; next: number } {
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

  private async buildTemplateFilterResponse(packageIds: string[]): Promise<TemplateFilterResponse> {
    const templates = new Set<string>();

    for (const packageId of packageIds) {
      const inspection = this.packageRegistryService
        ? await this.packageRegistryService.inspectPackage(packageId)
        : { ok: false as const, reason: 'missing_package' as const };

      if (!inspection.ok) {
        continue;
      }

      for (const template of inspection.definition.templates) {
        if (template.templateId.trim()) {
          templates.add(template.templateId);
        }
      }
    }

    return {
      templates: Array.from(templates)
        .sort((left, right) => left.localeCompare(right))
        .map((templateId) => ({ templateId })),
    };
  }

  private normalizeOptionalScalar(value: string | number | null | undefined): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private normalizeTemplateIdentifier(templateId: string | null): string | null {
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

    return separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : normalized;
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
      .map((party) => this.normalizePartyIdentifier(party.trim().replace(/^"(.*)"$/, '$1')))
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
