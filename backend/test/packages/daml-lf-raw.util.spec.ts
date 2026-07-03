import { describe, expect, it } from '@jest/globals';
import type { SdkRawPackage, SdkRawType } from '../../src/packages/daml-decoder.types';
import {
  flattenRawTypeApplication,
  resolveRawReferencedPackageId,
} from '../../src/packages/daml-lf-raw.util';

describe('daml-lf raw utilities', () => {
  it('flattens nested raw type applications into builtin args', () => {
    const rawType = {
      sum: {
        oneofKind: 'tapp',
        tapp: {
          lhs: {
            sum: {
              oneofKind: 'builtin',
              builtin: {
                builtin: 10,
                args: [],
              },
            },
          },
          rhs: {
            sum: {
              oneofKind: 'builtin',
              builtin: {
                builtin: 7,
                args: [],
              },
            },
          },
        },
      },
    } satisfies SdkRawType;

    expect(flattenRawTypeApplication(rawType)).toEqual({
      sum: {
        oneofKind: 'builtin',
        builtin: {
          builtin: 10,
          args: [
            {
              sum: {
                oneofKind: 'builtin',
                builtin: {
                  builtin: 7,
                  args: [],
                },
              },
            },
          ],
        },
      },
    });
  });

  it('resolves imported package ids through the raw package import table', () => {
    const rawPackage = {
      modules: [],
      internedStrings: ['ignored-import-placeholder'],
      internedDottedNames: [],
      internedTypes: [],
      internedKinds: [],
      internedExprs: [],
      importsSum: {
        oneofKind: 'packageImports',
        packageImports: {
          importedPackages: ['imported-package-id'],
        },
      },
    } satisfies SdkRawPackage;

    expect(
      resolveRawReferencedPackageId(
        rawPackage,
        'current-package-id',
        {
          sum: {
            oneofKind: 'packageImportId',
            packageImportId: 0,
          },
        },
      ),
    ).toBe('imported-package-id');
  });
});
