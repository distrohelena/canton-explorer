import {
  formatPackageTypeLabel,
  unwrapDebuggerSchemaNode,
} from "./debugger-value-schema";
import type { DecodedDamlValue } from "../types/daml";
import type { PackageTypeNode } from "../types/packages";

export type RenderableValue = DecodedDamlValue;

export type EventDataEntry = [
  string,
  RenderableValue,
  number,
  PackageTypeNode | null,
];

export type RecordValue = Extract<RenderableValue, { kind: "record" }>;
export type ListValue = Extract<RenderableValue, { kind: "list" }>;
export type CompositeValue = RecordValue | ListValue;

function isNumericFieldLabel(label: string): boolean {
  const fieldLabel = label
    .split(".")
    .at(-1)
    ?.replace(/\[\d+\]/g, "")
    .toLowerCase();

  return Boolean(
    fieldLabel &&
      /(?:amount|balance|decimal|fee|numeric|percentage|price|quantity|rate|ratio|shares|value)/.test(
        fieldLabel,
      ),
  );
}

function isPartyFieldLabel(label: string): boolean {
  return label.split(".").some((segment) =>
    segment
      .replace(/\[\d+\]/g, "")
      .toLowerCase()
      .includes("party"),
  );
}

function isContractIdFieldLabel(label: string): boolean {
  const fieldLabel = label
    .split(".")
    .at(-1)
    ?.replace(/\[\d+\]/g, "")
    .toLowerCase();
  return Boolean(
    fieldLabel &&
      (fieldLabel.endsWith("cid") || fieldLabel.includes("contractid")),
  );
}

function inferOptionalInnerType(label: string): string {
  const innerLabel = label.replace(/(^|\.)optional(?=[A-Z]|\.|$)/gi, "$1");

  if (isContractIdFieldLabel(innerLabel)) {
    return "ContractId";
  }

  if (isPartyFieldLabel(innerLabel)) {
    return "Party";
  }

  if (isNumericFieldLabel(innerLabel)) {
    return "Numeric";
  }

  const fieldLabel = innerLabel
    .split(".")
    .at(-1)
    ?.replace(/\[\d+\]/g, "")
    .toLowerCase();

  return fieldLabel?.endsWith("round") ? "Int64" : "Text";
}

export function formatEventDataLabel(key: string): string {
  return key
    .split(".")
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/^./, (char) => char.toUpperCase()),
    )
    .join(" / ");
}

export function formatEventDataValue(value: RenderableValue): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat().format(value);
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (value && typeof value === "object") {
    if (value.kind === "contract_id") {
      return value.value;
    }

    if (value.kind === "unit") {
      return "Unit";
    }
  }

  return typeof value === "string" ? value : "n/a";
}

export function isContractReference(
  value: RenderableValue,
): value is Extract<RenderableValue, { kind: "contract_id" }> {
  return typeof value === "object" && value?.kind === "contract_id";
}

export function isPartyReference(
  label: string,
  value: RenderableValue,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    (isPartyFieldLabel(label) || value.includes("::"))
  );
}

export function isContractIdStringReference(
  label: string,
  value: RenderableValue,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    isContractIdFieldLabel(label)
  );
}

export function contractReferenceValue(value: RenderableValue): string {
  return isContractReference(value) ? value.value : String(value);
}

export function formatEventDataType(
  label: string,
  value: RenderableValue,
  optionalDepth = 0,
  schemaNode: PackageTypeNode | null = null,
): string {
  let baseType: string;
  const schemaType = schemaNode ? formatPackageTypeLabel(schemaNode) : null;

  if (schemaType && schemaType !== "value") {
    baseType = schemaType;
  } else if (value === null) {
    baseType =
      optionalDepth > 0 ? inferOptionalInnerType(label) : "Optional";
  } else if (
    isContractReference(value) ||
    isContractIdStringReference(label, value)
  ) {
    baseType = "ContractId";
  } else if (isPartyReference(label, value)) {
    baseType = "Party";
  } else if (value && typeof value === "object") {
    baseType =
      value.kind === "unit"
        ? "Unit"
        : value.kind === "list"
          ? "List"
          : value.kind === "record"
            ? "Record"
            : "Unknown";
  } else if (typeof value === "boolean") {
    baseType = "Bool";
  } else if (typeof value === "number") {
    baseType = isNumericFieldLabel(label) ? "Numeric" : "Int64";
  } else {
    baseType = "Text";
  }

  return (
    "Optional<".repeat(optionalDepth) +
    baseType +
    ">".repeat(optionalDepth)
  );
}

export function isCompositeValue(
  value: RenderableValue,
): value is CompositeValue {
  return (
    typeof value === "object" &&
    (value?.kind === "record" || value?.kind === "list")
  );
}

export function isListValue(value: RenderableValue): value is ListValue {
  return typeof value === "object" && value?.kind === "list";
}

export function isRecordValue(value: RenderableValue): value is RecordValue {
  return typeof value === "object" && value?.kind === "record";
}

export function compositeSummary(value: CompositeValue): string {
  if (isListValue(value)) {
    return `${value.items.length} item${value.items.length === 1 ? "" : "s"}`;
  }

  return `${value.fields.length} field${value.fields.length === 1 ? "" : "s"}`;
}

export function flattenDecodedValue(
  label: string,
  value: DecodedDamlValue,
  optionalDepth = 0,
  schemaNode: PackageTypeNode | null = null,
  preserveCompositeValue = false,
): EventDataEntry[] {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return [[label, value, optionalDepth, schemaNode]];
  }

  if (value.kind === "contract_id" || value.kind === "unit") {
    return [[label, value, optionalDepth, schemaNode]];
  }

  if (value.kind === "record") {
    if (preserveCompositeValue && label) {
      return [[label, value, optionalDepth, schemaNode]];
    }

    const recordSchema = unwrapDebuggerSchemaNode(schemaNode);
    return value.fields.flatMap((field) =>
      flattenDecodedValue(
        label ? `${label}.${field.label}` : field.label,
        field.value,
        optionalDepth,
        recordSchema?.fields?.find((candidate) => candidate.name === field.label)
          ?.type ?? null,
        true,
      ),
    );
  }

  if (value.kind === "variant") {
    const variantSchema = unwrapDebuggerSchemaNode(schemaNode);
    const constructorType =
      variantSchema?.constructors?.find(
        (constructor) => constructor.name === value.constructor,
      )?.type ?? null;
    return value.value === null
      ? [[label, value.constructor, optionalDepth, constructorType]]
      : [
          [label, value.constructor, optionalDepth, constructorType],
          ...flattenDecodedValue(
            `${label}.${value.constructor}`,
            value.value,
            optionalDepth,
            constructorType,
            true,
          ),
        ];
  }

  if (value.kind === "enum") {
    return [[label, value.constructor, optionalDepth, schemaNode]];
  }

  if (value.kind === "optional") {
    const innerSchema = schemaNode?.arguments?.[0] ?? null;
    return value.value === null
      ? [[label, null, optionalDepth + 1, innerSchema]]
      : flattenDecodedValue(
          label,
          value.value,
          optionalDepth + 1,
          innerSchema,
          true,
        );
  }

  if (value.kind === "list") {
    return [[label, value, optionalDepth, schemaNode]];
  }

  if (value.kind === "text_map") {
    const entrySchema = schemaNode?.arguments?.[0] ?? null;
    return value.entries.flatMap((entry) =>
      flattenDecodedValue(
        `${label}.${entry.key}`,
        entry.value,
        optionalDepth,
        entrySchema,
        true,
      ),
    );
  }

  const keySchema = schemaNode?.arguments?.[0] ?? null;
  const valueSchema = schemaNode?.arguments?.[1] ?? null;
  return value.entries.flatMap((entry, index) => [
    ...flattenDecodedValue(
      `${label}[${index + 1}].key`,
      entry.key,
      optionalDepth,
      keySchema,
      true,
    ),
    ...flattenDecodedValue(
      `${label}[${index + 1}].value`,
      entry.value,
      optionalDepth,
      valueSchema,
      true,
    ),
  ]);
}

export function getRecordFieldEntries(
  value: RecordValue,
  schemaNode: PackageTypeNode | null,
): EventDataEntry[] {
  const recordSchema = unwrapDebuggerSchemaNode(schemaNode);
  return value.fields.flatMap((field) =>
    flattenDecodedValue(
      field.label,
      field.value,
      0,
      recordSchema?.fields?.find((candidate) => candidate.name === field.label)
        ?.type ?? null,
      true,
    ).map(([key, childValue, optionalDepth, type]) => [
      key || "value",
      childValue,
      optionalDepth,
      type,
    ] as EventDataEntry),
  );
}

export function getListItemEntries(
  value: ListValue,
  itemIndex: number,
  schemaNode: PackageTypeNode | null,
): EventDataEntry[] {
  const item = value.items[itemIndex];
  if (item === undefined) {
    return [];
  }

  return flattenDecodedValue(
    "",
    item,
    0,
    schemaNode?.arguments?.[0] ?? null,
    true,
  ).map(([key, itemValue, optionalDepth, type]) => [
    key || "value",
    itemValue,
    optionalDepth,
    type,
  ] as EventDataEntry);
}
