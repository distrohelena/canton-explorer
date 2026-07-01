import { Injectable } from '@nestjs/common';
import type { NodeConfig } from '../config/node-config.schema';
import type { LedgerSummary } from '../domain/node.types';
import { PqsClientFactory } from './pqs-client.factory';

@Injectable()
export class PqsSummaryService {
  constructor(private readonly clientFactory: PqsClientFactory) {}

  async fetchSummary(node: NodeConfig): Promise<LedgerSummary> {
    const client = this.clientFactory.getClient(node);
    const result = await client.query(`
      select
        current_database() as pqs_database,
        count(*)::int as active_contract_count,
        max(created_at_offset) as latest_offset,
        max(created_effective_at)::text as latest_event_at
      from active()
    `);

    const row = result.rows[0] ?? {
      pqs_database: 'unknown',
      active_contract_count: 0,
      latest_offset: null,
      latest_event_at: null,
    };

    return {
      ledgerLabel: node.ledgerLabel ?? node.label,
      pqsDatabase: row.pqs_database,
      activeContractCount: Number(row.active_contract_count ?? 0),
      latestOffset: row.latest_offset ?? null,
      latestEventAt: row.latest_event_at ?? null,
    };
  }
}
