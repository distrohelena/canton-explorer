import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PackageCacheService } from '../../src/packages/package-cache.service';
import { PackageRegistryService } from '../../src/packages/package-registry.service';
import {
  SAMPLE_DAML_FIXTURE,
  SECONDARY_DAML_FIXTURE,
} from '../fixtures/daml/fixture-manifest';

describe('PackageRegistryService', () => {
  let tempDir: string | null = null;
  const originalDatabasePath = process.env.PACKAGE_CACHE_DB_PATH;

  afterEach(() => {
    if (originalDatabasePath === undefined) {
      delete process.env.PACKAGE_CACHE_DB_PATH;
    } else {
      process.env.PACKAGE_CACHE_DB_PATH = originalDatabasePath;
    }

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('parses a cached package once and resolves templates and choices from it', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cacheService = new PackageCacheService();
    const getPackageSpy = jest.spyOn(cacheService, 'getPackage');
    const registry = new PackageRegistryService(cacheService);

    await expect(
      registry.resolveTemplate({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: SAMPLE_DAML_FIXTURE.templateId,
      }),
    ).resolves.toMatchObject({
      ok: true,
      definition: {
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: SAMPLE_DAML_FIXTURE.templateId,
      },
    });

    await expect(
      registry.resolveChoice({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: SAMPLE_DAML_FIXTURE.templateId,
        choice: SAMPLE_DAML_FIXTURE.resultChoice,
      }),
    ).resolves.toMatchObject({
      ok: true,
      definition: {
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: SAMPLE_DAML_FIXTURE.templateId,
        choice: SAMPLE_DAML_FIXTURE.resultChoice,
      },
    });

    await expect(
      registry.resolveTemplate({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: SAMPLE_DAML_FIXTURE.templateId,
      }),
    ).resolves.toMatchObject({
      ok: true,
      definition: {
        packageId: SAMPLE_DAML_FIXTURE.packageId,
      },
    });

    expect(
      getPackageSpy.mock.calls.filter(
        ([packageId]) => packageId === SAMPLE_DAML_FIXTURE.packageId,
      ),
    ).toHaveLength(1);
  });

  it('loads another package on demand instead of eagerly resolving every cached package', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cacheService = new PackageCacheService();
    const getPackageSpy = jest.spyOn(cacheService, 'getPackage');
    const registry = new PackageRegistryService(cacheService);

    await registry.resolveTemplate({
      packageId: SAMPLE_DAML_FIXTURE.packageId,
      templateId: SAMPLE_DAML_FIXTURE.templateId,
    });

    expect(
      getPackageSpy.mock.calls.map(([packageId]) => packageId),
    ).toEqual([SAMPLE_DAML_FIXTURE.packageId]);

    const secondaryResult = await registry.resolveChoice({
      packageId: SECONDARY_DAML_FIXTURE.packageId,
      templateId: SECONDARY_DAML_FIXTURE.templateId,
      choice: SECONDARY_DAML_FIXTURE.choice,
    });

    expect(secondaryResult).toMatchObject({
      ok: true,
      definition: {
        packageId: SECONDARY_DAML_FIXTURE.packageId,
        templateId: SECONDARY_DAML_FIXTURE.templateId,
        choice: SECONDARY_DAML_FIXTURE.choice,
      },
    });

    expect(
      getPackageSpy.mock.calls.map(([packageId]) => packageId),
    ).toEqual([
      SAMPLE_DAML_FIXTURE.packageId,
      SECONDARY_DAML_FIXTURE.packageId,
    ]);
  });

  it('returns deterministic diagnostics for missing packages, invalid blobs, and unknown identifiers', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-registry-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    cacheService.storePackages([
      {
        packageId: 'broken-package',
        name: 'broken-package',
        version: '0.0.0',
        uploadedAt: '1783039200000000',
        packageSize: 4,
        data: Buffer.from([1, 2, 3, 4]),
      },
    ]);
    const registry = new PackageRegistryService(cacheService);

    await expect(
      registry.resolveTemplate({
        packageId: 'missing-package',
        templateId: SAMPLE_DAML_FIXTURE.templateId,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'missing_package',
    });

    await expect(
      registry.resolveTemplate({
        packageId: 'broken-package',
        templateId: SAMPLE_DAML_FIXTURE.templateId,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid_package',
    });

    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const fixtureCacheService = new PackageCacheService();
    const fixtureRegistry = new PackageRegistryService(fixtureCacheService);

    await expect(
      fixtureRegistry.resolveTemplate({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: 'Splice.Amulet:MissingTemplate',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unknown_template',
    });

    await expect(
      fixtureRegistry.resolveChoice({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        templateId: SAMPLE_DAML_FIXTURE.templateId,
        choice: 'MissingChoice',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unknown_choice',
    });
  });

  it('inspects a decoded package with modules, templates, and data types', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cacheService = new PackageCacheService();
    const registry = new PackageRegistryService(cacheService) as PackageRegistryService & {
      inspectPackage?: (packageId: string) => Promise<unknown>;
    };

    expect(typeof registry.inspectPackage).toBe('function');

    await expect(registry.inspectPackage?.(SAMPLE_DAML_FIXTURE.packageId)).resolves.toMatchObject({
      ok: true,
      definition: {
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        packageName: 'splice-amulet',
        packageVersion: '0.1.18',
        templates: expect.arrayContaining([
          expect.objectContaining({
            templateId: SAMPLE_DAML_FIXTURE.templateId,
            moduleName: 'Splice.Amulet',
            createType: expect.objectContaining({
              kind: 'record',
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: 'dso',
                  type: expect.objectContaining({
                    kind: 'builtin',
                    label: 'Party',
                  }),
                }),
                expect.objectContaining({
                  name: 'round',
                  type: expect.objectContaining({
                    kind: 'type_con',
                    typeId: 'Splice.Types:Round',
                    definition: expect.objectContaining({
                      kind: 'record',
                      fields: expect.arrayContaining([
                        expect.objectContaining({
                          name: 'number',
                          type: expect.objectContaining({
                            kind: 'builtin',
                            label: 'Int64',
                          }),
                        }),
                      ]),
                    }),
                  }),
                }),
              ]),
            }),
          }),
        ]),
        dataTypes: expect.arrayContaining([
          expect.objectContaining({
            typeId: SAMPLE_DAML_FIXTURE.templateId,
            moduleName: 'Splice.Amulet',
            entityName: 'SvRewardCoupon',
            definition: expect.objectContaining({
              kind: 'record',
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: 'weight',
                  type: expect.objectContaining({
                    kind: 'builtin',
                    label: 'Int64',
                  }),
                }),
              ]),
            }),
          }),
          expect.objectContaining({
            typeId: 'Splice.Types:Round',
            definition: expect.objectContaining({
              kind: 'record',
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: 'number',
                  type: expect.objectContaining({
                    kind: 'builtin',
                    label: 'Int64',
                  }),
                }),
              ]),
            }),
          }),
        ]),
        modules: expect.arrayContaining(['Splice.Amulet']),
        templateCount: expect.any(Number),
        dataTypeCount: expect.any(Number),
      },
    });
  });

  it('reports interface definitions explicitly instead of treating them as undecoded data', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cacheService = new PackageCacheService();
    const registry = new PackageRegistryService(cacheService) as PackageRegistryService & {
      inspectPackage?: (packageId: string) => Promise<unknown>;
    };

    expect(typeof registry.inspectPackage).toBe('function');

    await expect(
      registry.inspectPackage?.('93c942ae2b4c2ba674fb152fe38473c507bda4e82b4e4c5da55a552a9d8cce1d'),
    ).resolves.toMatchObject({
      ok: true,
      definition: {
        dataTypes: expect.arrayContaining([
          expect.objectContaining({
            typeId: 'Splice.Api.Token.AllocationV1:Allocation',
            definition: expect.objectContaining({
              kind: 'interface',
              label: 'Splice.Api.Token.AllocationV1:Allocation',
              view: expect.objectContaining({
                kind: 'type_con',
                label: 'Splice.Api.Token.AllocationV1:AllocationView',
              }),
              methods: expect.arrayContaining([
                expect.objectContaining({
                  name: 'allocation_cancelImpl',
                }),
                expect.objectContaining({
                  name: 'allocation_executeTransferImpl',
                }),
                expect.objectContaining({
                  name: 'allocation_withdrawImpl',
                }),
              ]),
              choices: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Archive',
                  consuming: true,
                }),
                expect.objectContaining({
                  name: 'Allocation_Cancel',
                  consuming: true,
                  argumentType: expect.objectContaining({
                    kind: 'type_con',
                    label: 'Splice.Api.Token.AllocationV1:Allocation_Cancel',
                  }),
                  resultType: expect.objectContaining({
                    kind: 'type_con',
                    label: 'Splice.Api.Token.AllocationV1:Allocation_CancelResult',
                  }),
                }),
              ]),
            }),
          }),
        ]),
      },
    });
  });

  it('maps interface requires into visible type references', () => {
    const cacheService = new PackageCacheService();
    const registry = new PackageRegistryService(cacheService) as PackageRegistryService & {
      buildInterfaceNode?: (
        resolvedPackage: unknown,
        typeId: string,
        typeParameters: string[],
        ancestry: Set<string>,
        typeBindings: Map<string, unknown>,
        expandingVariables: Set<string>,
      ) => unknown;
      packageCache?: Map<string, unknown>;
    };

    const rawPackage = {
      internedStrings: ['Test', 'Module', 'Parent', 'Child'],
      internedDottedNames: [
        { segmentsInternedStr: [0, 1] },
        { segmentsInternedStr: [2] },
        { segmentsInternedStr: [3] },
      ],
      internedTypes: [],
      importsSum: { oneofKind: 'packageImports', packageImports: { importedPackages: [] } },
    } as never;
    const parentDataType = {
      params: [],
      dataCons: {
        oneofKind: 'interface',
      },
    } as never;
    const childDataType = {
      params: [],
      dataCons: {
        oneofKind: 'interface',
      },
    } as never;
    const resolvedPackage = {
      packageId: 'test-package',
      packageName: 'test-package',
      packageVersion: '1.0.0',
      rawPackage,
      templatesById: new Map(),
      dataTypesById: new Map([
        [
          'Test.Module:Parent',
          {
            packageId: 'test-package',
            typeId: 'Test.Module:Parent',
            moduleName: 'Test.Module',
            entityName: 'Parent',
            dataType: parentDataType,
            sdkDataType: null,
            packageRef: null,
          },
        ],
        [
          'Test.Module:Child',
          {
            packageId: 'test-package',
            typeId: 'Test.Module:Child',
            moduleName: 'Test.Module',
            entityName: 'Child',
            dataType: childDataType,
            sdkDataType: null,
            packageRef: null,
          },
        ],
      ]),
      interfacesById: new Map([
        [
          'Test.Module:Child',
          {
            methods: [],
            choices: [],
            requires: [
              {
                module: {
                  moduleNameInternedDname: 0,
                  packageId: {
                    sum: {
                      oneofKind: 'selfPackageId',
                    },
                  },
                },
                nameInternedDname: 1,
              },
            ],
          },
        ],
      ]),
      typeSynonymsById: new Map(),
      sdkPackage: null,
      sdkCompilation: null,
      sdkSemanticModel: null,
    } as never;

    resolvedPackage.dataTypesById.get('Test.Module:Parent').packageRef = resolvedPackage;
    resolvedPackage.dataTypesById.get('Test.Module:Child').packageRef = resolvedPackage;
    registry.packageCache?.set('test-package', resolvedPackage);

    expect(typeof registry.buildInterfaceNode).toBe('function');

    expect(
      registry.buildInterfaceNode?.(
        resolvedPackage,
        'Test.Module:Child',
        [],
        new Set<string>(),
        new Map<string, never>(),
        new Set<string>(),
      ),
    ).toMatchObject({
      kind: 'interface',
      label: 'Test.Module:Child',
      requires: [
        expect.objectContaining({
          kind: 'type_con',
          label: 'Test.Module:Parent',
          definition: expect.objectContaining({
            kind: 'interface',
            label: 'Test.Module:Parent',
          }),
        }),
      ],
    });
  });

  it('resolves data types and returns unknown_data_type for missing identifiers', async () => {
    process.env.PACKAGE_CACHE_DB_PATH = resolve(
      process.cwd(),
      'test/fixtures/daml/package-cache.sqlite',
    );
    const cacheService = new PackageCacheService();
    const registry = new PackageRegistryService(cacheService);

    await expect(
      registry.resolveDataType({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        typeId: SAMPLE_DAML_FIXTURE.templateId,
      }),
    ).resolves.toEqual({
      ok: true,
      definition: expect.objectContaining({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        typeId: SAMPLE_DAML_FIXTURE.templateId,
        moduleName: 'Splice.Amulet',
        entityName: 'SvRewardCoupon',
      }),
    });

    await expect(
      registry.resolveDataType({
        packageId: SAMPLE_DAML_FIXTURE.packageId,
        typeId: 'Splice.Amulet:MissingType',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unknown_data_type',
    });
  });

  it('returns missing_package from package inspection for unknown ids', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-registry-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    const registry = new PackageRegistryService(cacheService) as PackageRegistryService & {
      inspectPackage?: (packageId: string) => Promise<unknown>;
    };

    expect(typeof registry.inspectPackage).toBe('function');

    await expect(registry.inspectPackage?.('missing-package')).resolves.toEqual({
      ok: false,
      reason: 'missing_package',
    });
  });

  it('returns invalid_package from package inspection for undecodable blobs', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'package-registry-service-'));
    process.env.PACKAGE_CACHE_DB_PATH = join(tempDir, 'packages.sqlite');
    const cacheService = new PackageCacheService();
    cacheService.storePackages([
      {
        packageId: 'broken-package',
        name: 'broken-package',
        version: '0.0.0',
        uploadedAt: '1783039200000000',
        packageSize: 4,
        data: Buffer.from([1, 2, 3, 4]),
      },
    ]);
    const registry = new PackageRegistryService(cacheService) as PackageRegistryService & {
      inspectPackage?: (packageId: string) => Promise<unknown>;
    };

    expect(typeof registry.inspectPackage).toBe('function');

    await expect(registry.inspectPackage?.('broken-package')).resolves.toEqual({
      ok: false,
      reason: 'invalid_package',
    });
  });
});
