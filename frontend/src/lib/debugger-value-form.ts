import type { PackageTypeNode } from '../types/packages';

export const UNSET = Symbol('debugger-form-unset');

type FormScalar = {
  kind: 'scalar';
  scalarType: string;
  value: string | boolean | typeof UNSET;
};

export type FormRecord = {
  kind: 'record';
  fields: Record<string, FormValue>;
};

type FormOptional = {
  kind: 'optional';
  value: FormValue | typeof UNSET;
};

type FormList = {
  kind: 'list';
  items: FormValue[];
};

type FormMap = {
  kind: 'text_map' | 'gen_map';
  entries: Array<{ key: FormValue | string; value: FormValue }>;
};

type FormVariant = {
  kind: 'variant';
  constructor: string | typeof UNSET;
  value: FormValue | typeof UNSET;
};

type FormEnum = {
  kind: 'enum';
  constructor: string | typeof UNSET;
};

type FormUnit = { kind: 'unit' };

type FormUnsupported = { kind: 'unsupported'; message: string };

export type FormValue =
  | FormScalar
  | FormRecord
  | FormOptional
  | FormList
  | FormMap
  | FormVariant
  | FormEnum
  | FormUnit
  | FormUnsupported;

export interface FormValidationError {
  path: string;
  message: string;
}

export type SerializedDamlValue =
  | string
  | boolean
  | { kind: 'record'; fields: Array<{ label: string; value: SerializedDamlValue }> }
  | { kind: 'variant'; constructor: string; value: SerializedDamlValue | null }
  | { kind: 'enum'; constructor: string }
  | { kind: 'list'; items: SerializedDamlValue[] }
  | { kind: 'optional'; value: SerializedDamlValue | null }
  | { kind: 'text_map'; entries: Array<{ key: string; value: SerializedDamlValue }> }
  | { kind: 'gen_map'; entries: Array<{ key: SerializedDamlValue; value: SerializedDamlValue }> }
  | { kind: 'contract_id'; value: string }
  | { kind: 'unit' };

type Resolver = (node: PackageTypeNode) => PackageTypeNode | null;

function resolvedNode(node: PackageTypeNode, resolver?: Resolver): PackageTypeNode {
  if (node.kind === 'type_con' && resolver) {
    return resolver(node) ?? node;
  }

  return node;
}

function builtinLabel(node: PackageTypeNode): string {
  return node.label.split('.').at(-1)?.split(':').at(-1) ?? node.label;
}

export function createFormValue(node: PackageTypeNode, resolver?: Resolver): FormValue {
  const resolved = resolvedNode(node, resolver);

  if (resolved.note === 'missing_definition' || resolved.kind === 'type_var' || resolved.kind === 'unknown') {
    return { kind: 'unsupported', message: 'Type definition is unavailable.' };
  }

  if (resolved.kind === 'type_con' && resolved !== node) {
    return createFormValue(resolved, resolver);
  }

  if ((resolved.kind === 'synonym' || resolved.kind === 'forall') && resolved.definition) {
    return createFormValue(resolved.definition, resolver);
  }

  if (resolved.kind === 'forall' && resolved.body) {
    return createFormValue(resolved.body, resolver);
  }

  if (resolved.kind === 'record' || resolved.kind === 'struct') {
    return {
      kind: 'record',
      fields: Object.fromEntries(
        (resolved.fields ?? []).map((field) => [field.name, createFormValue(field.type, resolver)]),
      ),
    };
  }

  if (resolved.kind === 'variant') {
    return { kind: 'variant', constructor: UNSET, value: UNSET };
  }

  if (resolved.kind === 'enum') {
    return { kind: 'enum', constructor: UNSET };
  }

  if (resolved.kind === 'builtin') {
    const label = builtinLabel(resolved);
    if (label === 'Optional') {
      return { kind: 'optional', value: UNSET };
    }
    if (label === 'List') {
      return { kind: 'list', items: [] };
    }
    if (label === 'TextMap') {
      return { kind: 'text_map', entries: [] };
    }
    if (label === 'GenMap') {
      return { kind: 'gen_map', entries: [] };
    }
    if (label === 'Unit') {
      return { kind: 'unit' };
    }
    return {
      kind: 'scalar',
      scalarType: label,
      value: label === 'Bool' ? false : UNSET,
    };
  }

  if (resolved.kind === 'nat') {
    return { kind: 'scalar', scalarType: 'Numeric', value: UNSET };
  }

  return { kind: 'unsupported', message: 'This DAML type is not supported yet.' };
}

function pathFor(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}

function scalarError(value: FormScalar, path: string): FormValidationError | null {
  if (value.value === UNSET) {
    return value.scalarType === 'Bool' ? null : { path, message: 'Value is required.' };
  }

  if (value.scalarType === 'Int' && !/^-?(0|[1-9][0-9]*)$/.test(String(value.value))) {
    return { path, message: 'Enter a valid integer.' };
  }

  if (value.scalarType === 'Int64') {
    if (!/^-?(0|[1-9][0-9]*)$/.test(String(value.value))) {
      return { path, message: 'Enter a valid Int64.' };
    }
    try {
      const number = BigInt(String(value.value));
      if (number < -9223372036854775808n || number > 9223372036854775807n) {
        return { path, message: 'Int64 is out of range.' };
      }
    } catch {
      return { path, message: 'Enter a valid Int64.' };
    }
  }

  if (value.scalarType === 'Numeric' && !/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(String(value.value))) {
    return { path, message: 'Enter a valid decimal.' };
  }

  if (value.scalarType === 'Date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value.value))) {
    return { path, message: 'Enter a valid date (YYYY-MM-DD).' };
  }

  if (value.scalarType === 'Time' && !/^\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(String(value.value))) {
    return { path, message: 'Enter a valid time.' };
  }

  if (value.scalarType === 'Timestamp' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(String(value.value))) {
    return { path, message: 'Enter a UTC timestamp.' };
  }

  return null;
}

export function validateFormValue(
  value: FormValue,
  _node: PackageTypeNode,
  path = '',
): FormValidationError[] {
  switch (value.kind) {
    case 'unsupported':
      return [{ path, message: value.message }];
    case 'scalar': {
      const error = scalarError(value, path);
      return error ? [error] : [];
    }
    case 'record':
      return Object.entries(value.fields).flatMap(([name, child]) =>
        validateFormValue(child, _node, pathFor(path, name)),
      );
    case 'optional':
      return value.value === UNSET || value.value === null
        ? []
        : validateFormValue(value.value, _node, path);
    case 'list':
      return value.items.flatMap((item, index) => validateFormValue(item, _node, pathFor(path, String(index))));
    case 'text_map':
      return value.entries.flatMap((entry, index) => {
        const key = typeof entry.key === 'string' ? entry.key.trim() : '';
        const duplicate = value.entries.some((candidate, candidateIndex) =>
          candidateIndex !== index && typeof candidate.key === 'string' && candidate.key.trim() === key,
        );
        return key && !duplicate ? validateFormValue(entry.value, _node, pathFor(path, String(index))) : [{
          path: pathFor(path, String(index)),
          message: key ? 'Map keys must be unique.' : 'Map key is required.',
        }];
      });
    case 'gen_map':
      return value.entries.flatMap((entry, index) => validateFormValue(
        entry.value,
        _node,
        pathFor(path, String(index)),
      ));
    case 'variant':
      if (value.constructor === UNSET) return [{ path, message: 'Choose a variant constructor.' }];
      if (value.value === UNSET) return [{ path, message: 'Enter the variant value.' }];
      return validateFormValue(value.value, _node, path);
    case 'enum':
      return value.constructor === UNSET ? [{ path, message: 'Choose an enum constructor.' }] : [];
    case 'unit':
      return [];
  }
}

export function serializeFormValue(value: FormValue, node: PackageTypeNode): SerializedDamlValue {
  const errors = validateFormValue(value, node);
  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? 'Invalid value.');
  }

  switch (value.kind) {
    case 'scalar':
      return value.scalarType === 'ContractId'
        ? { kind: 'contract_id', value: String(value.value) }
        : value.value as string | boolean;
    case 'record':
      return {
        kind: 'record',
        fields: Object.entries(value.fields).map(([label, child]) => ({
          label,
          value: serializeFormValue(child, node),
        })),
      };
    case 'optional':
      return {
        kind: 'optional',
        value: value.value === UNSET || value.value === null ? null : serializeFormValue(value.value, node),
      };
    case 'list':
      return { kind: 'list', items: value.items.map((item) => serializeFormValue(item, node)) };
    case 'text_map':
      return {
        kind: 'text_map',
        entries: value.entries.map((entry) => ({
          key: String(entry.key),
          value: serializeFormValue(entry.value, node),
        })),
      };
    case 'gen_map':
      return {
        kind: 'gen_map',
        entries: value.entries.map((entry) => ({
          key: typeof entry.key === 'string' ? entry.key : serializeFormValue(entry.key, node),
          value: serializeFormValue(entry.value, node),
        })),
      };
    case 'variant':
      return {
        kind: 'variant',
        constructor: String(value.constructor),
        value: value.value === UNSET ? null : serializeFormValue(value.value, node),
      };
    case 'enum':
      return { kind: 'enum', constructor: String(value.constructor) };
    case 'unit':
      return { kind: 'unit' };
    case 'unsupported':
      throw new Error(value.message);
  }
}
