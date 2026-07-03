import { Injectable } from '@nestjs/common';
import { loadValueRoot } from './daml-lf-loader';
import {
  flattenRawTypeApplication,
  resolveRawBuiltinTypeName,
  resolveRawDottedName,
  resolveRawInternedString,
  resolveRawReferencedPackageId,
} from './daml-lf-raw.util';
import { PackageRegistryService } from './package-registry.service';
import type {
  ResolvedDataType,
  ResolvedPackage,
  SdkRawDataType,
  SdkRawType,
} from './daml-decoder.types';
import type {
  NodeDecodeFailureReason,
  NodeDecodeState,
  NodeDecodedDamlValue,
  NodeExerciseDecodeState,
} from '../domain/node.types';

interface VersionedValueMessage {
  value?: Uint8Array | Buffer | null;
}

interface DecodedValueObject {
  sum?: string;
  bool?: boolean;
  int64?: number;
  date?: number;
  timestamp?: number;
  numeric?: string;
  party?: string;
  text?: string;
  contract_id?: string;
  optional?: { value?: DecodedValueObject | null } | null;
  list?: { elements?: DecodedValueObject[] | null } | null;
  map?: {
    entries?: Array<{ key?: DecodedValueObject | null; value?: DecodedValueObject | null }> | null;
  } | null;
  text_map?: {
    entries?: Array<{ key?: string | null; value?: DecodedValueObject | null }> | null;
  } | null;
  record?: { fields?: Array<{ value?: DecodedValueObject | null }> | null } | null;
  variant?: { constructor?: string; value?: DecodedValueObject | null } | null;
  enum?: { value?: string } | null;
}

@Injectable()
export class DamlValueDecoderService {
  private readonly valueRoot = loadValueRoot();
  private readonly versionedValueType = this.valueRoot.lookupType(
    'com.digitalasset.daml.lf.value.VersionedValue',
  );
  private readonly valueType = this.valueRoot.lookupType('com.digitalasset.daml.lf.value.Value');

  constructor(private readonly packageRegistry: PackageRegistryService) {}

  async decodeContractInstance(input: {
    packageId: string | null;
    templateId: string | null;
    contractInstance: Buffer | null;
  }): Promise<NodeDecodeState<NodeDecodedDamlValue> | null> {
    if (!input.packageId || !input.templateId || !Buffer.isBuffer(input.contractInstance)) {
      return null;
    }

    const templateResult = await this.packageRegistry.resolveTemplate({
      packageId: input.packageId,
      templateId: input.templateId,
    });
    if (!templateResult.ok) {
      return { status: 'invalid_data', reason: templateResult.reason };
    }

    const createArgument = this.extractCreateArgument(input.contractInstance);
    if (!createArgument) {
      return { status: 'invalid_data', reason: 'decode_failure' };
    }

    return this.decodeRawValue(
      createArgument,
      templateResult.definition.packageRef,
      templateResult.definition.dataType,
      new Map(),
    );
  }

  async decodeExerciseValue(input: {
    packageId: string | null;
    templateId: string | null;
    rawChoice: string | null;
    exerciseArgument: Buffer | null;
    exerciseResult: Buffer | null;
  }): Promise<NodeExerciseDecodeState | null> {
    if (!input.packageId || !input.templateId || !input.rawChoice) {
      return null;
    }

    const choiceResult = await this.packageRegistry.resolveChoice({
      packageId: input.packageId,
      templateId: input.templateId,
      choice: this.normalizeRegistryChoice(input.rawChoice),
    });
    if (!choiceResult.ok) {
      return {
        argument: input.exerciseArgument
          ? { status: 'invalid_data', reason: choiceResult.reason }
          : { status: 'not_available' },
        result: input.exerciseResult
          ? { status: 'invalid_data', reason: choiceResult.reason }
          : { status: 'not_available' },
      };
    }

    const packageRef = choiceResult.definition.template.packageRef;
    const argumentType = this.resolveTypeReference(
      packageRef,
      choiceResult.definition.templateChoice.argBinder?.type,
      new Map(),
    );
    const resultType = this.resolveTypeReference(
      packageRef,
      choiceResult.definition.templateChoice.retType,
      new Map(),
    );

    return {
      argument: input.exerciseArgument
        ? this.decodeVersionedValue(
            input.exerciseArgument,
            packageRef,
            argumentType,
            new Map(),
          )
        : { status: 'not_available' },
      result: input.exerciseResult
        ? this.decodeVersionedValue(
            input.exerciseResult,
            packageRef,
            resultType,
            new Map(),
          )
        : { status: 'not_available' },
    };
  }

  private decodeVersionedValue(
    buffer: Buffer,
    packageRef: ResolvedPackage,
    expectedType: SdkRawType | SdkRawDataType | null,
    typeBindings: Map<number, SdkRawType>,
  ): NodeDecodeState<NodeDecodedDamlValue> {
    try {
      const decoded = this.versionedValueType.decode(buffer) as VersionedValueMessage;
      if (!decoded.value) {
        return { status: 'invalid_data', reason: 'decode_failure' };
      }

      return this.decodeRawValue(
        Buffer.from(decoded.value),
        packageRef,
        expectedType,
        typeBindings,
      );
    } catch {
      return { status: 'invalid_data', reason: 'decode_failure' };
    }
  }

  private decodeRawValue(
    buffer: Buffer,
    packageRef: ResolvedPackage,
    expectedType: SdkRawType | SdkRawDataType | null,
    typeBindings: Map<number, SdkRawType>,
  ): NodeDecodeState<NodeDecodedDamlValue> {
    try {
      const value = this.valueType.toObject(
        this.valueType.decode(buffer),
        {
          arrays: true,
          bytes: String,
          enums: String,
          longs: Number,
          defaults: false,
          oneofs: true,
        },
      ) as DecodedValueObject;
      const decodedValue = this.decodeTypedValue(value, packageRef, expectedType, typeBindings);

      return decodedValue
        ? { status: 'decoded', value: decodedValue }
        : { status: 'invalid_data', reason: 'decode_failure' };
    } catch {
      return { status: 'invalid_data', reason: 'decode_failure' };
    }
  }

  private decodeTypedValue(
    value: DecodedValueObject,
    packageRef: ResolvedPackage,
    expectedType: SdkRawType | SdkRawDataType | null,
    typeBindings: Map<number, SdkRawType>,
  ): NodeDecodedDamlValue | null {
    if (this.isDataType(expectedType)) {
      return this.decodeDataTypeValue(value, packageRef, expectedType, typeBindings);
    }

    const resolvedType = this.resolveTypeReference(packageRef, expectedType, typeBindings);
    if (!resolvedType) {
      return this.decodeUntypedValue(value);
    }

    if (resolvedType.sum.oneofKind === 'var') {
      const boundType = typeBindings.get(resolvedType.sum.var.varInternedStr);
      return boundType
        ? this.decodeTypedValue(value, packageRef, boundType, typeBindings)
        : this.decodeUntypedValue(value);
    }

    if (resolvedType.sum.oneofKind === 'builtin') {
      return this.decodeBuiltinValue(value, packageRef, resolvedType, typeBindings);
    }

    if (resolvedType.sum.oneofKind === 'con' && resolvedType.sum.con.tycon) {
      const resolvedDataType = this.resolveDataTypeReference(packageRef, resolvedType);
      if (!resolvedDataType) {
        return null;
      }

      const nextBindings = new Map<number, SdkRawType>();
      const params = resolvedDataType.dataType.params ?? [];
      const args = resolvedType.sum.con?.args ?? [];

      params.forEach((parameter, index) => {
        if (parameter.varInternedStr !== undefined && args[index]) {
          nextBindings.set(
            parameter.varInternedStr,
            this.resolveTypeReference(packageRef, args[index], typeBindings) ?? args[index],
          );
        }
      });

      return this.decodeDataTypeValue(value, resolvedDataType.packageRef, resolvedDataType.dataType, nextBindings);
    }

    return this.decodeUntypedValue(value);
  }

  private decodeDataTypeValue(
    value: DecodedValueObject,
    packageRef: ResolvedPackage,
    dataType: SdkRawDataType,
    typeBindings: Map<number, SdkRawType>,
  ): NodeDecodedDamlValue | null {
    if (dataType.dataCons.oneofKind === 'record' && value.sum === 'record') {
      const expectedFields = dataType.dataCons.record.fields;
      const actualFields = value.record?.fields ?? [];
      if (expectedFields.length !== actualFields.length) {
        return null;
      }

      return {
        kind: 'record',
        fields: expectedFields.map((field, index) => ({
          label:
            resolveRawInternedString(packageRef.rawPackage, field.fieldInternedStr) ??
            `field${index + 1}`,
          value:
            this.decodeTypedValue(
              actualFields[index]?.value ?? {},
              packageRef,
              field.type ?? null,
              typeBindings,
            ) ?? { kind: 'unit' },
        })),
      };
    }

    if (dataType.dataCons.oneofKind === 'variant' && value.sum === 'variant') {
      const constructor = value.variant?.constructor ?? null;
      if (!constructor) {
        return null;
      }

      const variantField = dataType.dataCons.variant.fields.find(
        (field) =>
          resolveRawInternedString(packageRef.rawPackage, field.fieldInternedStr) ===
          constructor,
      );
      if (!variantField) {
        return null;
      }

      return {
        kind: 'variant',
        constructor,
        value: value.variant?.value
          ? this.decodeTypedValue(value.variant.value, packageRef, variantField.type ?? null, typeBindings)
          : null,
      };
    }

    if (dataType.dataCons.oneofKind === 'enum' && value.sum === 'enum' && value.enum?.value) {
      return {
        kind: 'enum',
        constructor: value.enum.value,
      };
    }

    return this.decodeUntypedValue(value);
  }

  private decodeBuiltinValue(
    value: DecodedValueObject,
    packageRef: ResolvedPackage,
    expectedType: SdkRawType,
    typeBindings: Map<number, SdkRawType>,
  ): NodeDecodedDamlValue | null {
    if (expectedType.sum.oneofKind !== 'builtin') {
      return this.decodeUntypedValue(value);
    }

    const builtin = resolveRawBuiltinTypeName(expectedType.sum.builtin.builtin);
    const args = expectedType.sum.builtin.args;

    switch (builtin) {
      case 'UNIT':
        return value.sum === 'unit' ? { kind: 'unit' } : null;
      case 'BOOL':
        return value.sum === 'bool' ? value.bool ?? false : null;
      case 'INT64':
        return value.sum === 'int64' ? value.int64 ?? 0 : null;
      case 'DATE':
        return value.sum === 'date' && typeof value.date === 'number'
          ? this.formatDate(value.date)
          : null;
      case 'TIMESTAMP':
        return value.sum === 'timestamp' && typeof value.timestamp === 'number'
          ? this.formatTimestamp(value.timestamp)
          : null;
      case 'NUMERIC':
        return value.sum === 'numeric' ? value.numeric ?? null : null;
      case 'TEXT':
        return value.sum === 'text' ? value.text ?? null : null;
      case 'PARTY':
        return value.sum === 'party' ? value.party ?? null : null;
      case 'CONTRACT_ID':
        return value.sum === 'contract_id' && typeof value.contract_id === 'string'
          ? { kind: 'contract_id', value: this.decodeContractId(value.contract_id) }
          : null;
      case 'LIST':
        if (value.sum !== 'list') {
          return null;
        }
        return {
          kind: 'list',
          items: (value.list?.elements ?? []).map(
            (item) =>
              this.decodeTypedValue(
                item,
                packageRef,
                args[0] ?? null,
                typeBindings,
              ) ?? { kind: 'unit' },
          ),
        };
      case 'OPTIONAL':
        if (value.sum !== 'optional') {
          return null;
        }
        return {
          kind: 'optional',
          value: value.optional?.value
            ? this.decodeTypedValue(
                value.optional.value,
                packageRef,
                args[0] ?? null,
                typeBindings,
              )
            : null,
        };
      case 'TEXTMAP':
      case 'TEXT_MAP':
        if (value.sum !== 'text_map') {
          return null;
        }
        return {
          kind: 'text_map',
          entries: (value.text_map?.entries ?? []).map((entry) => ({
            key: entry.key ?? '',
            value:
              this.decodeTypedValue(
                entry.value ?? {},
                packageRef,
                args[0] ?? null,
                typeBindings,
              ) ?? { kind: 'unit' },
          })),
        };
      case 'GENMAP':
      case 'MAP':
        if (value.sum !== 'map') {
          return null;
        }
        return {
          kind: 'gen_map',
          entries: (value.map?.entries ?? []).map((entry) => ({
            key:
              this.decodeTypedValue(
                entry.key ?? {},
                packageRef,
                args[0] ?? null,
                typeBindings,
              ) ?? { kind: 'unit' },
            value:
              this.decodeTypedValue(
                entry.value ?? {},
                packageRef,
                args[1] ?? null,
                typeBindings,
              ) ?? { kind: 'unit' },
          })),
        };
      default:
        return this.decodeUntypedValue(value);
    }
  }

  private decodeUntypedValue(value: DecodedValueObject): NodeDecodedDamlValue | null {
    switch (value.sum) {
      case 'unit':
        return { kind: 'unit' };
      case 'bool':
        return value.bool ?? false;
      case 'int64':
        return value.int64 ?? 0;
      case 'date':
        return typeof value.date === 'number' ? this.formatDate(value.date) : null;
      case 'timestamp':
        return typeof value.timestamp === 'number'
          ? this.formatTimestamp(value.timestamp)
          : null;
      case 'numeric':
        return value.numeric ?? null;
      case 'party':
        return value.party ?? null;
      case 'text':
        return value.text ?? null;
      case 'contract_id':
        return typeof value.contract_id === 'string'
          ? { kind: 'contract_id', value: this.decodeContractId(value.contract_id) }
          : null;
      case 'optional':
        return {
          kind: 'optional',
          value: value.optional?.value ? this.decodeUntypedValue(value.optional.value) : null,
        };
      case 'list':
        return {
          kind: 'list',
          items: (value.list?.elements ?? [])
            .map((item) => this.decodeUntypedValue(item))
            .filter((item): item is NodeDecodedDamlValue => item !== null),
        };
      case 'text_map':
        return {
          kind: 'text_map',
          entries: (value.text_map?.entries ?? []).map((entry) => ({
            key: entry.key ?? '',
            value: this.decodeUntypedValue(entry.value ?? {}) ?? { kind: 'unit' },
          })),
        };
      case 'map':
        return {
          kind: 'gen_map',
          entries: (value.map?.entries ?? []).map((entry) => ({
            key: this.decodeUntypedValue(entry.key ?? {}) ?? { kind: 'unit' },
            value: this.decodeUntypedValue(entry.value ?? {}) ?? { kind: 'unit' },
          })),
        };
      case 'variant':
        return {
          kind: 'variant',
          constructor: value.variant?.constructor ?? 'Unknown',
          value: value.variant?.value ? this.decodeUntypedValue(value.variant.value) : null,
        };
      case 'enum':
        return value.enum?.value
          ? { kind: 'enum', constructor: value.enum.value }
          : null;
      case 'record':
        return {
          kind: 'record',
          fields: (value.record?.fields ?? []).map((field, index) => ({
            label: `field${index + 1}`,
            value: this.decodeUntypedValue(field.value ?? {}) ?? { kind: 'unit' },
          })),
        };
      default:
        return null;
    }
  }

  private resolveDataTypeReference(
    packageRef: ResolvedPackage,
    rawType: SdkRawType,
  ): ResolvedDataType | null {
    if (rawType.sum.oneofKind !== 'con') {
      return null;
    }

    const tycon = rawType.sum.con.tycon;
    const moduleName = resolveRawDottedName(
      packageRef.rawPackage,
      tycon?.module?.moduleNameInternedDname,
    );
    const entityName = resolveRawDottedName(packageRef.rawPackage, tycon?.nameInternedDname);
    if (!moduleName || !entityName) {
      return null;
    }

    const targetPackageId = this.resolveReferencedPackageId(packageRef, rawType);
    const targetResult = packageRef.packageId === targetPackageId
      ? {
          ok: true as const,
          definition: packageRef.dataTypesById.get(`${moduleName}:${entityName}`) ?? null,
        }
      : null;

    if (targetResult?.definition) {
      return targetResult.definition;
    }

    if (packageRef.packageId === targetPackageId) {
      return null;
    }

    const resolved = this.packageRegistry.resolveDataTypeSync({
      packageId: targetPackageId,
      typeId: `${moduleName}:${entityName}`,
    });

    return resolved.ok ? resolved.definition : null;
  }

  private resolveTypeReference(
    packageRef: ResolvedPackage,
    rawType: SdkRawType | null | undefined,
    typeBindings: Map<number, SdkRawType>,
  ): SdkRawType | null {
    if (!rawType) {
      return null;
    }

    if (rawType.sum.oneofKind === 'internedType') {
      return this.resolveTypeReference(
        packageRef,
        packageRef.rawPackage.internedTypes[rawType.sum.internedType],
        typeBindings,
      );
    }

    if (rawType.sum.oneofKind === 'var') {
      return typeBindings.get(rawType.sum.var.varInternedStr) ?? rawType;
    }

    return flattenRawTypeApplication(rawType);
  }

  private resolveReferencedPackageId(packageRef: ResolvedPackage, rawType: SdkRawType): string {
    if (rawType.sum.oneofKind !== 'con') {
      return packageRef.packageId;
    }

    return resolveRawReferencedPackageId(
      packageRef.rawPackage,
      packageRef.packageId,
      rawType.sum.con.tycon?.module?.packageId,
    );
  }

  private extractCreateArgument(contractInstance: Buffer): Buffer | null {
    const contractPayload = this.getFirstLengthDelimitedField(contractInstance, 2);
    return contractPayload ? this.getFirstLengthDelimitedField(contractPayload, 4) : null;
  }

  private getFirstLengthDelimitedField(message: Buffer, fieldNumber: number): Buffer | null {
    return this.parseProtobufFields(message).find(
      (field) => field.fieldNumber === fieldNumber && field.buffer,
    )?.buffer ?? null;
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

  private decodeContractId(value: string): string {
    return Buffer.from(value, 'base64').toString('hex');
  }

  private formatDate(daysSinceEpoch: number): string {
    const epoch = Date.UTC(1970, 0, 1);
    return new Date(epoch + daysSinceEpoch * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  private formatTimestamp(micros: number): string {
    return new Date(micros / 1000).toISOString();
  }

  private normalizeRegistryChoice(choice: string): string {
    return choice.replace(/^c\|/, '');
  }

  private isDataType(value: SdkRawType | SdkRawDataType | null): value is SdkRawDataType {
    return Boolean(
      value &&
        typeof value === 'object' &&
        'dataCons' in value,
    );
  }
}
