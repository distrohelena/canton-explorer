import type { SdkRawPackage, SdkRawType } from './daml-decoder.types';

const BUILTIN_TYPE_NAMES = new Map<number, string>([
  [0, 'UNIT'],
  [1, 'BOOL'],
  [2, 'INT64'],
  [3, 'DATE'],
  [4, 'TIMESTAMP'],
  [5, 'NUMERIC'],
  [6, 'PARTY'],
  [7, 'TEXT'],
  [8, 'CONTRACT_ID'],
  [9, 'OPTIONAL'],
  [10, 'LIST'],
  [11, 'GENMAP'],
  [16, 'ARROW'],
  [17, 'UPDATE'],
  [19, 'TEXTMAP'],
]);

export function flattenRawTypeApplication(rawType: SdkRawType | undefined): SdkRawType | null {
  if (!rawType?.sum?.oneofKind) {
    return null;
  }

  if (rawType.sum.oneofKind !== 'tapp') {
    return rawType;
  }

  return applyRawTypeArgument(
    flattenRawTypeApplication(rawType.sum.tapp?.lhs),
    flattenRawTypeApplication(rawType.sum.tapp?.rhs),
  );
}

export function resolveRawReferencedPackageId(
  rawPackage: SdkRawPackage,
  currentPackageId: string,
  rawPackageId:
    | {
        sum: {
          oneofKind?: 'selfPackageId' | 'importedPackageIdInternedStr' | 'packageImportId';
          importedPackageIdInternedStr?: number;
          packageImportId?: number;
        };
      }
    | undefined,
): string {
  switch (rawPackageId?.sum.oneofKind) {
    case 'selfPackageId':
      return currentPackageId;
    case 'importedPackageIdInternedStr':
      return (
        resolveRawInternedString(rawPackage, rawPackageId.sum.importedPackageIdInternedStr) ??
        currentPackageId
      );
    case 'packageImportId':
      return rawPackage.importsSum.oneofKind === 'packageImports'
        ? rawPackage.importsSum.packageImports.importedPackages[rawPackageId.sum.packageImportId ?? -1] ??
            currentPackageId
        : currentPackageId;
    default:
      return currentPackageId;
  }
}

export function resolveRawDottedName(
  rawPackage: SdkRawPackage,
  index: number | undefined,
): string | null {
  if (index === undefined) {
    return null;
  }

  const dottedName = rawPackage.internedDottedNames[index];
  if (!dottedName) {
    return null;
  }

  return dottedName.segmentsInternedStr
    .map((segmentIndex: number) => rawPackage.internedStrings[segmentIndex] ?? '')
    .filter((segment: string) => segment.length > 0)
    .join('.');
}

export function resolveRawInternedString(
  rawPackage: SdkRawPackage,
  index: number | undefined,
): string | null {
  if (index === undefined) {
    return null;
  }

  return rawPackage.internedStrings[index] ?? null;
}

export function resolveRawBuiltinTypeName(builtin: number | undefined): string | null {
  if (builtin === undefined) {
    return null;
  }

  return BUILTIN_TYPE_NAMES.get(builtin) ?? null;
}

function applyRawTypeArgument(
  lhs: SdkRawType | null,
  rhs: SdkRawType | null,
): SdkRawType | null {
  if (!lhs) {
    return rhs;
  }

  if (!rhs) {
    return lhs;
  }

  if (lhs.sum.oneofKind === 'builtin') {
    return {
      sum: {
        oneofKind: 'builtin',
        builtin: {
          ...lhs.sum.builtin,
          args: [...lhs.sum.builtin.args, rhs],
        },
      },
    };
  }

  if (lhs.sum.oneofKind === 'con') {
    return {
      sum: {
        oneofKind: 'con',
        con: {
          ...lhs.sum.con,
          args: [...lhs.sum.con.args, rhs],
        },
      },
    };
  }

  if (lhs.sum.oneofKind === 'var') {
    return {
      sum: {
        oneofKind: 'var',
        var: {
          ...lhs.sum.var,
          args: [...lhs.sum.var.args, rhs],
        },
      },
    };
  }

  return lhs;
}
