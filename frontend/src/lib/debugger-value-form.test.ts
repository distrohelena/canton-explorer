import { describe, expect, it } from 'vitest';
import type { PackageTypeNode } from '../types/packages';
import {
  UNSET,
  createFormValue,
  formTypeLabel,
  serializeFormValue,
  toReplayValue,
  validateFormValue,
  type FormRecord,
} from './debugger-value-form';

describe('debugger constructor value form', () => {
  const schema: PackageTypeNode = {
    kind: 'record',
    label: 'Main:Asset',
    fields: [
      { name: 'owner', type: { kind: 'builtin', label: 'Party' } },
      { name: 'name', type: { kind: 'builtin', label: 'Text' } },
      {
        name: 'memo',
        type: {
          kind: 'builtin',
          label: 'Optional',
          arguments: [{ kind: 'builtin', label: 'Text' }],
        },
      },
    ],
  };

  it('serializes nested records and optionals into NodeDecodedDamlValue', () => {
    const value = createFormValue(schema) as FormRecord;
    (value.fields.owner as any).value = 'Alice::party';
    (value.fields.name as any).value = 'Asset';
    (value.fields.memo as any).value = {
      kind: 'scalar',
      scalarType: 'Text',
      value: 'hello',
    };

    expect(serializeFormValue(value, schema)).toEqual({
      kind: 'record',
      fields: [
        { label: 'owner', value: 'Alice::party' },
        { label: 'name', value: 'Asset' },
        { label: 'memo', value: { kind: 'optional', value: 'hello' } },
      ],
    });
    expect(validateFormValue(value, schema)).toEqual([]);
  });

  it('converts serialized constructor data into DAML replay runtime values', () => {
    expect(toReplayValue({
      kind: 'record',
      fields: [
        { label: 'owner', value: 'Alice::party' },
        { label: 'name', value: 'Asset' },
        { label: 'memo', value: { kind: 'optional', value: 'hello' } },
      ],
    }, schema)).toEqual({
      owner: { __damlLfParty: 'Alice::party' },
      name: 'Asset',
      memo: 'hello',
    });
  });

  it('keeps required values unset and reports a missing-field error', () => {
    const value = createFormValue(schema) as FormRecord;

    expect((value.fields.owner as any).value).toBe(UNSET);
    expect(validateFormValue(value, schema)).toEqual([
      { path: 'owner', message: 'Value is required.' },
      { path: 'name', message: 'Value is required.' },
    ]);
    expect(() => serializeFormValue(value, schema)).toThrow('Value is required.');
  });

  it('does not render child state when a referenced type cannot be resolved', () => {
    const missing: PackageTypeNode = {
      kind: 'type_con',
      label: 'Main:Missing',
      packageId: 'pkg-missing',
      typeId: 'Main:Missing',
      note: 'missing_definition',
    };

    const value = createFormValue(missing);

    expect(value).toEqual({ kind: 'unsupported', message: 'Type definition is unavailable.' });
    expect(validateFormValue(value, missing)).toEqual([
      { path: '', message: 'Type definition is unavailable.' },
    ]);
  });

  it('resolves referenced package data types through the supplied resolver', () => {
    const reference: PackageTypeNode = {
      kind: 'type_con',
      label: 'Main:Details',
      packageId: 'pkg-a',
      typeId: 'Main:Details',
    };
    const value = createFormValue(reference, () => ({
      kind: 'record',
      label: 'Main:Details',
      fields: [{ name: 'description', type: { kind: 'builtin', label: 'Text' } }],
    }));

    expect(value.kind).toBe('record');
    expect((value as FormRecord).fields.description).toBeDefined();
  });

  it('formats DAML field types including Optional wrappers', () => {
    expect(formTypeLabel({ kind: 'builtin', label: 'Party' })).toBe('Party');
    expect(formTypeLabel({
      kind: 'builtin',
      label: 'Optional',
      arguments: [{ kind: 'builtin', label: 'Text' }],
    })).toBe('Optional Text');
    expect(formTypeLabel({
      kind: 'builtin',
      label: 'List',
      arguments: [{ kind: 'builtin', label: 'Int64' }],
    })).toBe('List Int64');
  });
});
