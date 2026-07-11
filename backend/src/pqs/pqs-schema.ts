import type { NodeConfig } from '../config/node-config.schema';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const PQS_RELATIONS = new Set([
  '__contracts',
  '__contract_tpe',
  '__events',
  '__exercises',
  '__exercise_tpe',
  '__packages',
  '__transactions',
  '__watermark',
] as const);

export function pqsSchema(node: NodeConfig): string {
  const schema = node.pqs.schema ?? 'public';

  if (!IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(`Invalid PQS schema identifier: ${schema}`);
  }

  return schema;
}

export function qualifyPqsRelation(node: NodeConfig, relation: string): string {
  if (!PQS_RELATIONS.has(relation as (typeof PQS_RELATIONS extends Set<infer T> ? T : never))) {
    throw new Error(`Invalid PQS relation name: ${relation}`);
  }

  return `${quoteIdentifier(pqsSchema(node))}.${quoteIdentifier(relation)}`;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
