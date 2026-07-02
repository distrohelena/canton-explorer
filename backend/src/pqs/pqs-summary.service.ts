import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type {
  LedgerSummary,
  NodeUpdateDetailMeta,
  NodeUpdateDetailResponse,
  NodeRecentUpdate,
  NodeRecentUpdatesResponse,
} from '../domain/node.types';
import { PqsClientFactory } from './pqs-client.factory';

interface SummaryRow {
  pqs_database: string;
  active_contract_count: number | string | null;
  latest_offset: string | null;
  latest_event_at: string | null;
}

interface UpdateMetaRow {
  update_id: string;
  record_time: string | null;
}

interface UpdateDetailRow {
  update_id: string;
  record_time?: string | number | null;
  record_time_iso?: string | null;
  meta?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface UpdatePartiesRow {
  update_id: string;
  parties: string[] | string | null;
}

const ACTIVE_QUERY = `
  select
    current_database() as pqs_database,
    count(*)::int as active_contract_count,
    max(created_at_offset) as latest_offset,
    max(created_effective_at)::text as latest_event_at
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
    ) as latest_event_at
`;

function recentUpdatesQuery(limit: number): string {
  return `
    select
      update_id::text as update_id,
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

function singleUpdateQuery(updateIds: string[]): string {
  const quotedIds = updateIds.map((updateId) => `'${escapeSqlLiteral(updateId)}'`).join(', ');

  return `
    select
      update_meta.update_id::text as update_id,
      to_char(
        to_timestamp(update_meta.record_time / 1000000.0) at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) as record_time_iso,
      to_jsonb(update_meta) as meta
    from participant.lapi_update_meta update_meta
    where update_meta.update_id::text in (${quotedIds})
    order by update_meta.record_time desc
    limit 1
  `;
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

@Injectable()
export class PqsSummaryService {
  constructor(private readonly clientFactory: PqsClientFactory) {}

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
      rawUpdateId: row.update_id,
      updateId: this.normalizeUpdateId(row.update_id),
      recordTime: row.record_time ?? null,
    }));

    if (updates.length === 0) {
      return {
        nodeId: node.id,
        label: node.label,
        limit: normalizedLimit,
        updates,
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
        updateId: update.updateId,
        recordTime: update.recordTime,
        parties: partiesByUpdateId.get(update.updateId) ?? [],
      })),
    };
  }

  async fetchUpdateDetail(
    node: NodeConfig,
    updateId: string,
  ): Promise<NodeUpdateDetailResponse> {
    const client = this.clientFactory.getClient(node);
    const detailResult = await client.query(singleUpdateQuery(this.lookupUpdateIdCandidates(updateId)));
    const detailRows = (detailResult.rows as UpdateDetailRow[]) ?? [];
    const detailRow = detailRows[0];

    if (!detailRow) {
      throw new Error('Update not found');
    }

    const rawUpdateId = this.extractRawUpdateId(detailRow);
    const canonicalUpdateId = this.normalizeUpdateId(rawUpdateId);
    const partiesByUpdateId = await this.fetchPartiesByUpdateId(client.query.bind(client), [rawUpdateId]);

    return {
      nodeId: node.id,
      label: node.label,
      updateId: canonicalUpdateId,
      recordTime: this.extractIsoRecordTime(detailRow),
      parties: partiesByUpdateId.get(canonicalUpdateId) ?? [],
      meta: this.extractMeta(detailRow),
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
    } catch {
      return new Map();
    }
  }

  private normalizeUpdateId(updateId: string): string {
    return updateId.startsWith('\\x') ? updateId.slice(2) : updateId;
  }

  private lookupUpdateIdCandidates(updateId: string): string[] {
    const canonicalUpdateId = this.normalizeLookupUpdateId(updateId);
    return Array.from(new Set([canonicalUpdateId, `\\x${canonicalUpdateId}`]));
  }

  private normalizeLookupUpdateId(updateId: string): string {
    const normalized = this.normalizeUpdateId(updateId);

    if (/^[0-9a-f]{64}$/i.test(normalized)) {
      return `1220${normalized}`;
    }

    return normalized;
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

  private normalizeParties(parties: string[] | string | null): string[] {
    if (Array.isArray(parties)) {
      return parties.filter((party): party is string => typeof party === 'string');
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
      .map((party) => party.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
  }

  private defaultRow(): SummaryRow {
    return {
      pqs_database: 'unknown',
      active_contract_count: 0,
      latest_offset: null,
      latest_event_at: null,
    };
  }
}
