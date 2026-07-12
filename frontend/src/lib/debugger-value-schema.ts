import { fetchPackageDetail } from './api';
import type { PackageDetailResponse, PackageTypeNode } from '../types/packages';

const RECORD_ID_MARKER = '__damlLfRecordId';

interface DebuggerValueObject {
  [key: string]: unknown;
}

export interface DebuggerRecordTypeRef {
  packageId: string;
  typeId: string;
}

const packageDetailCache = new Map<string, Promise<PackageDetailResponse | null>>();

function isObjectValue(value: unknown): value is DebuggerValueObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function makeTypeLookupKey(packageId: string, typeId: string): string {
  return `${packageId}::${typeId}`;
}

function extractRecordTypeRef(value: unknown): DebuggerRecordTypeRef | null {
  if (!isObjectValue(value)) {
    return null;
  }

  const recordId = value[RECORD_ID_MARKER];
  if (!isObjectValue(recordId)) {
    return null;
  }

  const packageId = typeof recordId.packageId === 'string' ? recordId.packageId : null;
  const moduleName = typeof recordId.moduleName === 'string' ? recordId.moduleName : null;
  const entityName = typeof recordId.entityName === 'string' ? recordId.entityName : null;

  if (!packageId || !moduleName || !entityName) {
    return null;
  }

  return {
    packageId,
    typeId: `${moduleName}:${entityName}`,
  };
}

function visitRecordTypeRefs(
  value: unknown,
  refs: Map<string, DebuggerRecordTypeRef>,
): void {
  const recordTypeRef = extractRecordTypeRef(value);
  if (recordTypeRef) {
    refs.set(makeTypeLookupKey(recordTypeRef.packageId, recordTypeRef.typeId), recordTypeRef);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => visitRecordTypeRefs(item, refs));
    return;
  }

  if (!isObjectValue(value)) {
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    if (key !== RECORD_ID_MARKER) {
      visitRecordTypeRefs(child, refs);
    }
  });
}

function formatTypeArguments(node: PackageTypeNode): string {
  if (!node.arguments?.length) {
    return node.label;
  }

  return `${node.label}<${node.arguments.map((argument) => formatPackageTypeLabel(argument)).join(', ')}>`;
}

function loadPackageDetail(packageId: string): Promise<PackageDetailResponse | null> {
  const cached = packageDetailCache.get(packageId);
  if (cached) {
    return cached;
  }

  const pending = fetchPackageDetail(packageId).catch(() => null);
  packageDetailCache.set(packageId, pending);
  return pending;
}

export function collectRecordTypeRefs(value: unknown): DebuggerRecordTypeRef[] {
  const refs = new Map<string, DebuggerRecordTypeRef>();
  visitRecordTypeRefs(value, refs);
  return [...refs.values()];
}

export async function loadDebuggerPackageTypeLookup(
  packageIds: string[],
): Promise<Map<string, PackageTypeNode>> {
  const lookup = new Map<string, PackageTypeNode>();
  const details = await Promise.all(packageIds.map((packageId) => loadPackageDetail(packageId)));

  details.forEach((detail) => {
    if (!detail || detail.status !== 'decoded') {
      return;
    }

    detail.templates.forEach((template) => {
      if (template.createType) {
        lookup.set(makeTypeLookupKey(detail.packageId, template.templateId), template.createType);
      }
    });

    detail.dataTypes.forEach((dataType) => {
      if (dataType.definition) {
        lookup.set(makeTypeLookupKey(detail.packageId, dataType.typeId), dataType.definition);
      }
    });
  });

  return lookup;
}

export function recordTypeLookupKey(recordTypeRef: DebuggerRecordTypeRef): string {
  return makeTypeLookupKey(recordTypeRef.packageId, recordTypeRef.typeId);
}

export function resolveDebuggerSchemaNode(
  value: unknown,
  packageTypeLookup: Map<string, PackageTypeNode>,
): PackageTypeNode | null {
  const recordTypeRef = extractRecordTypeRef(value);
  if (!recordTypeRef) {
    return null;
  }

  return packageTypeLookup.get(recordTypeLookupKey(recordTypeRef)) ?? null;
}

export function formatPackageTypeLabel(node: PackageTypeNode | null | undefined): string {
  if (!node) {
    return 'value';
  }

  switch (node.kind) {
    case 'builtin':
    case 'type_con':
    case 'synonym':
    case 'type_var':
      return formatTypeArguments(node);
    case 'record':
    case 'variant':
    case 'enum':
    case 'interface':
      return node.label;
    case 'struct':
      return 'tuple';
    case 'forall':
      return node.label;
    case 'nat':
      return node.label;
    default:
      return node.label;
  }
}

export function unwrapDebuggerSchemaNode(
  node: PackageTypeNode | null | undefined,
): PackageTypeNode | null {
  if (!node) {
    return null;
  }

  switch (node.kind) {
    case 'type_con':
    case 'synonym':
      return unwrapDebuggerSchemaNode(node.definition ?? null) ?? node;
    case 'forall':
      return unwrapDebuggerSchemaNode(node.body ?? null) ?? node;
    default:
      return node;
  }
}
