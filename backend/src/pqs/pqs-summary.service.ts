import { Injectable, Optional } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type {
  NodeContractDetailResponse,
  NodePackagesResponse,
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
} from '../domain/node.types';
import { PqsClientFactory } from './pqs-client.factory';
import { DamlValueDecoderService } from '../packages/daml-value-decoder.service';
import { PackageCacheService } from '../packages/package-cache.service';
import { PackageRegistryService } from '../packages/package-registry.service';

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

function recentUpdatesQuery(limit: number): string {
  return `
    select
      update_id::text as update_id,
      event_offset::text as event_offset,
      to_char(
        to_timestamp(record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time
    from participant.lapi_update_meta
    order by record_time desc
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

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function normalizeByteaHex(value: string): string {
  return value.startsWith('\\x') ? value.slice(2) : value;
}

@Injectable()
export class PqsSummaryService {
  constructor(
    private readonly clientFactory: PqsClientFactory,
    @Optional() private readonly damlValueDecoder?: DamlValueDecoderService,
    @Optional() private readonly packageCacheService?: PackageCacheService,
    @Optional() private readonly packageRegistryService?: PackageRegistryService,
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

  async fetchRecentUpdates(
    node: NodeConfig,
    limit = 25,
  ): Promise<NodeRecentUpdatesResponse> {
    const client = this.clientFactory.getClient(node);
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 25;
    const metaResult = await client.query(recentUpdatesQuery(normalizedLimit));
    const metaRows = (metaResult.rows as UpdateMetaRow[]) ?? [];
    const updates = metaRows.map((row) => ({
      eventOffset: this.extractEventOffset(row),
      rawUpdateId: row.update_id,
      updateId: this.normalizeUpdateId(row.update_id),
      recordTime: row.record_time ?? null,
    }));

    if (updates.length === 0) {
      return {
        nodeId: node.id,
        label: node.label,
        limit: normalizedLimit,
        updates: [],
      };
    }

    const partiesByUpdateId = await this.fetchPartiesByUpdateId(
      client.query.bind(client),
      updates.map((update) => update.rawUpdateId),
    );

    return {
      nodeId: node.id,
      label: node.label,
      limit: normalizedLimit,
      updates: updates.map((update) => ({
        eventOffset: update.eventOffset,
        updateId: update.updateId,
        recordTime: update.recordTime,
        parties: partiesByUpdateId.get(update.updateId) ?? [],
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

  private normalizeUpdateId(updateId: string): string {
    return updateId.startsWith('\\x') ? updateId.slice(2) : updateId;
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
