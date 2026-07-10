import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  PackageRegistryFailureReason,
  PackageRegistryResult,
  ResolvedChoice,
  ResolvedDataType,
  SdkRawInterface,
  ResolvedPackageInspection,
  ResolvedPackage,
  ResolvedTemplate,
  SdkRawDataType,
  SdkRawPackage,
  SdkRawTemplate,
  SdkRawTemplateChoice,
  SdkRawType,
  SdkRawTypeSyn,
} from './daml-decoder.types';
import type { PackageTypeNode } from '../domain/node.types';
import {
  flattenRawTypeApplication,
  resolveRawBuiltinTypeName,
  resolveRawDottedName,
  resolveRawInternedString,
  resolveRawReferencedPackageId,
} from './daml-lf-raw.util';
import { PackageCacheService } from './package-cache.service';

type DamlLfSdkModule = typeof import('@distrohelena/canton-typescript-sdk/daml-lf');

interface ResolveTemplateInput {
  packageId: string;
  templateId: string;
}

interface ResolveChoiceInput extends ResolveTemplateInput {
  choice: string;
}

interface BuildResolvedPackageInput {
  packageId: string;
  packageName: string | null;
  packageVersion: string | null;
  rawPackage: SdkRawPackage;
  sdkPackage: ResolvedPackage['sdkPackage'];
  sdkCompilation: ResolvedPackage['sdkCompilation'];
  sdkSemanticModel: ResolvedPackage['sdkSemanticModel'];
}

@Injectable()
export class PackageRegistryService implements OnModuleInit {
  private readonly packageCache = new Map<
    string,
    ResolvedPackage | PackageRegistryFailureReason
  >();
  private readonly sdkModulePromise: Promise<DamlLfSdkModule>;
  private sdkModule: DamlLfSdkModule | null = null;

  constructor(private readonly cacheService: PackageCacheService) {
    this.sdkModulePromise = import('@distrohelena/canton-typescript-sdk/daml-lf').then((sdkModule) => {
      this.sdkModule = sdkModule;
      return sdkModule;
    });
  }

  async onModuleInit(): Promise<void> {
    await this.sdkModulePromise;
  }

  async resolveTemplate(
    input: ResolveTemplateInput,
  ): Promise<PackageRegistryResult<ResolvedTemplate>> {
    const resolvedPackage = await this.loadPackageAsync(input.packageId);
    if (typeof resolvedPackage === 'string') {
      return { ok: false, reason: resolvedPackage };
    }

    const template = resolvedPackage.templatesById.get(input.templateId);
    if (!template) {
      return { ok: false, reason: 'unknown_template' };
    }

    return { ok: true, definition: template };
  }

  async resolveChoice(
    input: ResolveChoiceInput,
  ): Promise<PackageRegistryResult<ResolvedChoice>> {
    const templateResult = await this.resolveTemplate(input);
    if (!templateResult.ok) {
      return templateResult;
    }

    const templateChoice =
      templateResult.definition.template.choices?.find(
        (choice) =>
          resolveRawInternedString(
            templateResult.definition.packageRef.rawPackage,
            choice.nameInternedStr,
          ) === input.choice,
      ) ?? null;

    if (!templateChoice) {
      return { ok: false, reason: 'unknown_choice' };
    }

    return {
      ok: true,
      definition: {
        packageId: input.packageId,
        templateId: input.templateId,
        choice: input.choice,
        template: templateResult.definition,
        templateChoice,
        sdkChoice:
          templateResult.definition.sdkTemplate?.choices.find(
            (choice) => choice.name === input.choice,
          ) ?? null,
      },
    };
  }

  async resolveDataType(input: {
    packageId: string;
    typeId: string;
  }): Promise<PackageRegistryResult<ResolvedDataType>> {
    await this.ensureSdkModule();
    return this.resolveDataTypeSync(input);
  }

  async inspectPackage(
    packageId: string,
  ): Promise<PackageRegistryResult<ResolvedPackageInspection>> {
    const resolvedPackage = await this.loadPackageAsync(packageId);
    if (typeof resolvedPackage === 'string') {
      return { ok: false, reason: resolvedPackage };
    }

    const modules = Array.from(
      new Set([
        ...Array.from(resolvedPackage.templatesById.values()).map((template) => template.moduleName),
        ...Array.from(resolvedPackage.dataTypesById.values()).map((dataType) => dataType.moduleName),
      ]),
    ).sort((left, right) => left.localeCompare(right));

    const templates = Array.from(resolvedPackage.templatesById.values())
      .map((template) => ({
        templateId: template.templateId,
        moduleName: template.moduleName,
        entityName: template.entityName,
        createType: template.dataType
          ? this.buildDataTypeNode(
              resolvedPackage,
              template.templateId,
              template.dataType,
              new Set<string>(),
              new Map<string, SdkRawType>(),
              new Set<string>(),
            )
          : null,
      }))
      .sort((left, right) => left.templateId.localeCompare(right.templateId));

    const dataTypes = Array.from(resolvedPackage.dataTypesById.values())
      .map((dataType) => ({
        typeId: dataType.typeId,
        moduleName: dataType.moduleName,
        entityName: dataType.entityName,
        definition: this.buildDataTypeNode(
          resolvedPackage,
          dataType.typeId,
          dataType.dataType,
          new Set<string>(),
          new Map<string, SdkRawType>(),
          new Set<string>(),
        ),
      }))
      .sort((left, right) => left.typeId.localeCompare(right.typeId));

    return {
      ok: true,
      definition: {
        packageId: resolvedPackage.packageId,
        packageName: resolvedPackage.packageName,
        packageVersion: resolvedPackage.packageVersion,
        modules,
        templates,
        dataTypes,
        moduleCount: modules.length,
        templateCount: templates.length,
        dataTypeCount: dataTypes.length,
      },
    };
  }

  resolveDataTypeSync(input: {
    packageId: string;
    typeId: string;
  }): PackageRegistryResult<ResolvedDataType> {
    const resolvedPackage = this.loadPackageSync(input.packageId);
    if (typeof resolvedPackage === 'string') {
      return { ok: false, reason: resolvedPackage };
    }

    const dataType = resolvedPackage.dataTypesById.get(input.typeId);
    if (!dataType) {
      return { ok: false, reason: 'unknown_data_type' };
    }

    return { ok: true, definition: dataType };
  }

  private async loadPackageAsync(
    packageId: string,
  ): Promise<ResolvedPackage | PackageRegistryFailureReason> {
    await this.ensureSdkModule();
    return this.loadPackageSync(packageId);
  }

  private loadPackageSync(
    packageId: string,
  ): ResolvedPackage | PackageRegistryFailureReason {
    const cached = this.packageCache.get(packageId);
    if (cached) {
      return cached;
    }

    const packageBlob = this.cacheService.getPackage(packageId);
    if (!packageBlob) {
      this.packageCache.set(packageId, 'missing_package');
      return 'missing_package';
    }

    try {
      const sdkModule = this.getSdkModuleOrThrow();
      const packageLoader = new sdkModule.DamlLfPackageLoader();
      const rawLoadResult = packageLoader.loadRawPackageOrThrow(packageBlob.data);
      const rawPackage = rawLoadResult.rawPackage as SdkRawPackage;

      let sdkPackage: ResolvedPackage['sdkPackage'] = null;
      let sdkCompilation: ResolvedPackage['sdkCompilation'] = null;
      let sdkSemanticModel: ResolvedPackage['sdkSemanticModel'] = null;

      try {
        sdkPackage = packageLoader.loadPackageOrThrow(packageBlob.data);
        sdkCompilation = sdkModule.DamlLfCompilation.createOrThrow(
          new sdkModule.DamlLfWorkspace([sdkPackage]),
        );
        sdkSemanticModel = sdkCompilation.createSemanticModel();
      } catch {
        sdkPackage = null;
        sdkCompilation = null;
        sdkSemanticModel = null;
      }

      const resolvedPackage = buildResolvedPackage({
        packageId,
        packageName: packageBlob.name,
        packageVersion: packageBlob.version,
        rawPackage,
        sdkPackage,
        sdkCompilation,
        sdkSemanticModel,
      });
      this.packageCache.set(packageId, resolvedPackage);
      return resolvedPackage;
    } catch {
      this.packageCache.set(packageId, 'invalid_package');
      return 'invalid_package';
    }
  }

  private async ensureSdkModule(): Promise<DamlLfSdkModule> {
    return this.sdkModulePromise;
  }

  private getSdkModuleOrThrow(): DamlLfSdkModule {
    if (!this.sdkModule) {
      throw new Error('DAML-LF SDK module has not finished loading');
    }

    return this.sdkModule;
  }

  invalidatePackage(packageId: string): void {
    this.packageCache.delete(packageId);
  }

  private buildDataTypeNode(
    resolvedPackage: ResolvedPackage,
    typeId: string,
    dataType: SdkRawDataType,
    ancestry: Set<string>,
    typeBindings: Map<string, SdkRawType>,
    expandingVariables: Set<string>,
  ): PackageTypeNode {
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(`${resolvedPackage.packageId}::${typeId}`);
    const typeParameters = dataType.params
      .map((parameter) => resolveRawInternedString(resolvedPackage.rawPackage, parameter.varInternedStr))
      .filter((parameter): parameter is string => Boolean(parameter));

    switch (dataType.dataCons.oneofKind) {
      case 'record':
        return {
          kind: 'record',
          label: typeId,
          packageId: resolvedPackage.packageId,
          typeId,
          typeParameters,
          fields: dataType.dataCons.record.fields.map((field) => ({
            name: resolveRawInternedString(resolvedPackage.rawPackage, field.fieldInternedStr) ?? 'Unknown',
            type: this.buildTypeNode(
              resolvedPackage,
              field.type,
              nextAncestry,
              typeBindings,
              expandingVariables,
            ),
          })),
        };
      case 'variant':
        return {
          kind: 'variant',
          label: typeId,
          packageId: resolvedPackage.packageId,
          typeId,
          typeParameters,
          constructors: dataType.dataCons.variant.fields.map((field) => ({
            name: resolveRawInternedString(resolvedPackage.rawPackage, field.fieldInternedStr) ?? 'Unknown',
            type: field.type
              ? this.buildTypeNode(
                  resolvedPackage,
                  field.type,
                  nextAncestry,
                  typeBindings,
                  expandingVariables,
                )
              : null,
          })),
        };
      case 'enum':
        return {
          kind: 'enum',
          label: typeId,
          packageId: resolvedPackage.packageId,
          typeId,
          typeParameters,
          constructors: dataType.dataCons.enum.constructorsInternedStr.map((constructorIndex) => ({
            name:
              resolveRawInternedString(resolvedPackage.rawPackage, constructorIndex) ?? 'Unknown',
            type: null,
          })),
        };
      case 'interface':
        return this.buildInterfaceNode(
          resolvedPackage,
          typeId,
          typeParameters,
          nextAncestry,
          typeBindings,
          expandingVariables,
        );
      default:
        return {
          kind: 'unknown',
          label: typeId,
          packageId: resolvedPackage.packageId,
          typeId,
        };
    }
  }

  private buildInterfaceNode(
    resolvedPackage: ResolvedPackage,
    typeId: string,
    typeParameters: string[],
    ancestry: Set<string>,
    typeBindings: Map<string, SdkRawType>,
    expandingVariables: Set<string>,
  ): PackageTypeNode {
    const interfaceDefinition = resolvedPackage.interfacesById.get(typeId);
    if (!interfaceDefinition) {
      return {
        kind: 'interface',
        label: typeId,
        packageId: resolvedPackage.packageId,
        typeId,
        typeParameters,
      };
    }

    return {
      kind: 'interface',
      label: typeId,
      packageId: resolvedPackage.packageId,
      typeId,
      typeParameters,
      view: interfaceDefinition.view
        ? this.buildTypeNode(
            resolvedPackage,
            interfaceDefinition.view,
            ancestry,
            typeBindings,
            expandingVariables,
          )
        : null,
      requires: interfaceDefinition.requires.map((requiredInterface) =>
        this.buildTypeReferenceNode(
          resolvedPackage,
          requiredInterface,
          ancestry,
          typeBindings,
          expandingVariables,
        ),
      ),
      methods: interfaceDefinition.methods.map((method) => ({
        name:
          resolveRawInternedString(
            resolvedPackage.rawPackage,
            method.methodInternedName,
          ) ?? 'Unknown',
        type: method.type
          ? this.buildTypeNode(
              resolvedPackage,
              method.type,
              ancestry,
              typeBindings,
              expandingVariables,
            )
          : null,
      })),
      choices: interfaceDefinition.choices.map((choice) => ({
        name:
          resolveRawInternedString(
            resolvedPackage.rawPackage,
            choice.nameInternedStr,
          ) ?? 'Unknown',
        consuming: choice.consuming,
        argumentType: choice.argBinder?.type
          ? this.buildTypeNode(
              resolvedPackage,
              choice.argBinder.type,
              ancestry,
              typeBindings,
              expandingVariables,
            )
          : null,
        resultType: choice.retType
          ? this.buildTypeNode(
              resolvedPackage,
              choice.retType,
              ancestry,
              typeBindings,
              expandingVariables,
            )
          : null,
      })),
    };
  }

  private buildTypeNode(
    resolvedPackage: ResolvedPackage,
    rawType: SdkRawType | undefined,
    ancestry: Set<string>,
    typeBindings: Map<string, SdkRawType>,
    expandingVariables: Set<string>,
  ): PackageTypeNode {
    const normalizedType = flattenRawTypeApplication(rawType);
    if (!normalizedType?.sum.oneofKind) {
      return { kind: 'unknown', label: 'Unknown' };
    }

    switch (normalizedType.sum.oneofKind) {
      case 'internedType': {
        return this.buildTypeNode(
          resolvedPackage,
          resolvedPackage.rawPackage.internedTypes[normalizedType.sum.internedType],
          ancestry,
          typeBindings,
          expandingVariables,
        );
      }
      case 'builtin': {
        return {
          kind: 'builtin',
          label: this.formatBuiltinTypeLabel(normalizedType.sum.builtin.builtin),
          arguments: normalizedType.sum.builtin.args.map((argument) =>
            this.buildTypeNode(
              resolvedPackage,
              argument,
              ancestry,
              typeBindings,
              expandingVariables,
            ),
          ),
        };
      }
      case 'nat':
        return {
          kind: 'nat',
          label: normalizedType.sum.nat,
        };
      case 'var': {
        const variableName =
          resolveRawInternedString(
            resolvedPackage.rawPackage,
            normalizedType.sum.var.varInternedStr,
          ) ?? 'a';
        const boundType = typeBindings.get(variableName);
        if (boundType && normalizedType.sum.var.args.length === 0) {
          if (expandingVariables.has(variableName)) {
            return {
              kind: 'type_var',
              label: variableName,
            };
          }

          return this.buildTypeNode(
            resolvedPackage,
            boundType,
            ancestry,
            typeBindings,
            new Set([...expandingVariables, variableName]),
          );
        }

        return {
          kind: 'type_var',
          label: variableName,
          arguments: normalizedType.sum.var.args.map((argument) =>
            this.buildTypeNode(
              resolvedPackage,
              argument,
              ancestry,
              typeBindings,
              expandingVariables,
            ),
          ),
        };
      }
      case 'con':
        return this.buildTypeConNode(
          resolvedPackage,
          normalizedType.sum.con,
          ancestry,
          typeBindings,
          expandingVariables,
        );
      case 'syn':
        return this.buildTypeSynonymNode(
          resolvedPackage,
          normalizedType.sum.syn,
          ancestry,
          typeBindings,
          expandingVariables,
        );
      case 'struct':
        return {
          kind: 'struct',
          label: 'Struct',
          fields: normalizedType.sum.struct.fields.map((field) => ({
            name: resolveRawInternedString(resolvedPackage.rawPackage, field.fieldInternedStr) ?? 'Unknown',
            type: this.buildTypeNode(
              resolvedPackage,
              field.type,
              ancestry,
              typeBindings,
              expandingVariables,
            ),
          })),
        };
      case 'forall': {
        const variables = normalizedType.sum.forall.vars
          .map((variable) =>
            resolveRawInternedString(resolvedPackage.rawPackage, variable.varInternedStr),
          )
          .filter((variable): variable is string => Boolean(variable));

        return {
          kind: 'forall',
          label: variables.length > 0 ? `forall ${variables.join(', ')}` : 'forall',
          typeParameters: variables,
          body: normalizedType.sum.forall.body
            ? this.buildTypeNode(
              resolvedPackage,
              normalizedType.sum.forall.body,
              ancestry,
              typeBindings,
              expandingVariables,
            )
            : null,
        };
      }
      default:
        return {
          kind: 'unknown',
          label: 'Unknown',
        };
    }
  }

  private buildTypeConNode(
    resolvedPackage: ResolvedPackage,
    conType: Extract<SdkRawType['sum'], { oneofKind: 'con' }>['con'],
    ancestry: Set<string>,
    typeBindings: Map<string, SdkRawType>,
    expandingVariables: Set<string>,
  ): PackageTypeNode {
    return this.buildTypeReferenceNode(
      resolvedPackage,
      conType.tycon,
      ancestry,
      typeBindings,
      expandingVariables,
      conType.args,
    );
  }

  private buildTypeReferenceNode(
    resolvedPackage: ResolvedPackage,
    typeReference:
      | {
          nameInternedDname: number;
          module?: {
            moduleNameInternedDname: number;
            packageId?: {
              sum: {
                oneofKind?: 'selfPackageId' | 'importedPackageIdInternedStr' | 'packageImportId';
                importedPackageIdInternedStr?: number;
                packageImportId?: number;
              };
            };
          };
        }
      | undefined,
    ancestry: Set<string>,
    typeBindings: Map<string, SdkRawType>,
    expandingVariables: Set<string>,
    rawArguments: SdkRawType[] = [],
  ): PackageTypeNode {
    const reference = this.resolveTypeReference(resolvedPackage, typeReference);
    const argumentNodes = rawArguments.map((argument) =>
      this.buildTypeNode(
        resolvedPackage,
        argument,
        ancestry,
        typeBindings,
        expandingVariables,
      ),
    );

    if (!reference) {
      return {
        kind: 'type_con',
        label: 'Unknown',
        arguments: argumentNodes,
        note: 'missing_definition',
      };
    }

    const loadedPackage = this.loadPackageSync(reference.packageId);
    if (typeof loadedPackage === 'string') {
      return {
        kind: 'type_con',
        label: reference.typeId,
        packageId: reference.packageId,
        typeId: reference.typeId,
        arguments: argumentNodes,
        note: 'missing_definition',
      };
    }

    const recursiveKey = `${reference.packageId}::${reference.typeId}`;
    if (ancestry.has(recursiveKey)) {
      return {
        kind: 'type_con',
        label: reference.typeId,
        packageId: reference.packageId,
        typeId: reference.typeId,
        arguments: argumentNodes,
        note: 'recursive_reference',
      };
    }

    const referencedDataType = loadedPackage.dataTypesById.get(reference.typeId);
    if (!referencedDataType) {
      return {
        kind: 'type_con',
        label: reference.typeId,
        packageId: reference.packageId,
        typeId: reference.typeId,
        arguments: argumentNodes,
        note: 'missing_definition',
      };
    }

    return {
      kind: 'type_con',
      label: reference.typeId,
      packageId: reference.packageId,
      typeId: reference.typeId,
      arguments: argumentNodes,
      definition: this.buildDataTypeNode(
        loadedPackage,
        reference.typeId,
        referencedDataType.dataType,
        ancestry,
        this.extendTypeBindings(
          loadedPackage.rawPackage,
          referencedDataType.dataType.params,
          rawArguments,
          typeBindings,
        ),
        expandingVariables,
      ),
    };
  }

  private buildTypeSynonymNode(
    resolvedPackage: ResolvedPackage,
    synonymType: Extract<SdkRawType['sum'], { oneofKind: 'syn' }>['syn'],
    ancestry: Set<string>,
    typeBindings: Map<string, SdkRawType>,
    expandingVariables: Set<string>,
  ): PackageTypeNode {
    const reference = this.resolveTypeReference(resolvedPackage, synonymType.tysyn);
    const argumentNodes = synonymType.args.map((argument: SdkRawType) =>
      this.buildTypeNode(
        resolvedPackage,
        argument,
        ancestry,
        typeBindings,
        expandingVariables,
      ),
    );

    if (!reference) {
      return {
        kind: 'synonym',
        label: 'Unknown',
        arguments: argumentNodes,
        note: 'missing_definition',
      };
    }

    const loadedPackage = this.loadPackageSync(reference.packageId);
    if (typeof loadedPackage === 'string') {
      return {
        kind: 'synonym',
        label: reference.typeId,
        packageId: reference.packageId,
        typeId: reference.typeId,
        arguments: argumentNodes,
        note: 'missing_definition',
      };
    }

    const recursiveKey = `${reference.packageId}::${reference.typeId}`;
    if (ancestry.has(recursiveKey)) {
      return {
        kind: 'synonym',
        label: reference.typeId,
        packageId: reference.packageId,
        typeId: reference.typeId,
        arguments: argumentNodes,
        note: 'recursive_reference',
      };
    }

    const synonym = loadedPackage.typeSynonymsById.get(reference.typeId);
    if (!synonym) {
      return {
        kind: 'synonym',
        label: reference.typeId,
        packageId: reference.packageId,
        typeId: reference.typeId,
        arguments: argumentNodes,
        note: 'missing_definition',
      };
    }

    return {
      kind: 'synonym',
      label: reference.typeId,
      packageId: reference.packageId,
      typeId: reference.typeId,
      arguments: argumentNodes,
      typeParameters: synonym.params
        .map((parameter) => resolveRawInternedString(loadedPackage.rawPackage, parameter.varInternedStr))
        .filter((parameter): parameter is string => Boolean(parameter)),
      definition: synonym.type
        ? this.buildTypeNode(
            loadedPackage,
            synonym.type,
            new Set([...ancestry, recursiveKey]),
            this.extendTypeBindings(
              loadedPackage.rawPackage,
              synonym.params,
              synonymType.args,
              typeBindings,
            ),
            expandingVariables,
          )
        : null,
    };
  }

  private extendTypeBindings(
    rawPackage: SdkRawPackage,
    parameters: Array<{ varInternedStr: number }>,
    argumentsList: SdkRawType[],
    existingBindings: Map<string, SdkRawType>,
  ): Map<string, SdkRawType> {
    const nextBindings = new Map(existingBindings);

    parameters.forEach((parameter, index) => {
      const parameterName = resolveRawInternedString(rawPackage, parameter.varInternedStr);
      const argument = argumentsList[index];
      if (parameterName && argument) {
        nextBindings.set(parameterName, argument);
      }
    });

    return nextBindings;
  }

  private resolveTypeReference(
    resolvedPackage: ResolvedPackage,
    typeReference:
      | {
          nameInternedDname: number;
          module?: {
            moduleNameInternedDname: number;
            packageId?: {
              sum: {
                oneofKind?: 'selfPackageId' | 'importedPackageIdInternedStr' | 'packageImportId';
                importedPackageIdInternedStr?: number;
                packageImportId?: number;
              };
            };
          };
        }
      | undefined,
  ): { packageId: string; typeId: string } | null {
    const moduleName = resolveRawDottedName(
      resolvedPackage.rawPackage,
      typeReference?.module?.moduleNameInternedDname,
    );
    const entityName = resolveRawDottedName(
      resolvedPackage.rawPackage,
      typeReference?.nameInternedDname,
    );

    if (!moduleName || !entityName) {
      return null;
    }

    return {
      packageId: resolveRawReferencedPackageId(
        resolvedPackage.rawPackage,
        resolvedPackage.packageId,
        typeReference?.module?.packageId,
      ),
      typeId: `${moduleName}:${entityName}`,
    };
  }

  private formatBuiltinTypeLabel(builtin: number | undefined): string {
    const builtinName = resolveRawBuiltinTypeName(builtin);
    if (!builtinName) {
      return 'Unknown';
    }

    switch (builtinName) {
      case 'INT64':
        return 'Int64';
      case 'CONTRACT_ID':
        return 'ContractId';
      case 'GENMAP':
        return 'GenMap';
      case 'TEXTMAP':
        return 'TextMap';
      default:
        return builtinName
          .toLowerCase()
          .split('_')
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join('');
    }
  }
}

function buildResolvedPackage(
  input: BuildResolvedPackageInput,
): ResolvedPackage {
  const templatesById = new Map<string, ResolvedTemplate>();
  const dataTypesById = new Map<string, ResolvedDataType>();
  const interfacesById = new Map<string, SdkRawInterface>();
  const typeSynonymsById = new Map<string, SdkRawTypeSyn>();
  const sdkTemplatesById = indexSdkTemplates(input.sdkPackage);
  const sdkDataTypesById = indexSdkDataTypes(input.sdkPackage);

  for (const moduleDefinition of input.rawPackage.modules) {
    const moduleName = resolveRawDottedName(
      input.rawPackage,
      moduleDefinition.nameInternedDname,
    );
    if (!moduleName) {
      continue;
    }

    const dataTypesByName = new Map<string, SdkRawDataType>();
    for (const dataType of moduleDefinition.dataTypes) {
      const dataTypeName = resolveRawDottedName(
        input.rawPackage,
        dataType.nameInternedDname,
      );
      if (dataTypeName) {
        dataTypesByName.set(dataTypeName, dataType);
        const typeId = `${moduleName}:${dataTypeName}`;
        dataTypesById.set(typeId, {
          packageId: input.packageId,
          typeId,
          moduleName,
          entityName: dataTypeName,
          dataType,
          sdkDataType: sdkDataTypesById.get(typeId) ?? null,
          packageRef: undefined as never,
        });
      }
    }

    for (const synonym of moduleDefinition.synonyms) {
      const synonymName = resolveRawDottedName(
        input.rawPackage,
        synonym.nameInternedDname,
      );
      if (synonymName) {
        typeSynonymsById.set(`${moduleName}:${synonymName}`, synonym);
      }
    }

    for (const interfaceDefinition of moduleDefinition.interfaces) {
      const interfaceName = resolveRawDottedName(
        input.rawPackage,
        interfaceDefinition.tyconInternedDname,
      );
      if (interfaceName) {
        interfacesById.set(`${moduleName}:${interfaceName}`, interfaceDefinition);
      }
    }

    for (const template of moduleDefinition.templates) {
      const entityName = resolveRawDottedName(
        input.rawPackage,
        template.tyconInternedDname,
      );
      if (!entityName) {
        continue;
      }

      const templateId = `${moduleName}:${entityName}`;
      const resolvedTemplate: ResolvedTemplate = {
        packageId: input.packageId,
        templateId,
        moduleName,
        entityName,
        template,
        dataType: dataTypesByName.get(entityName) ?? null,
        sdkTemplate: sdkTemplatesById.get(templateId) ?? null,
        packageRef: undefined as never,
      };
      templatesById.set(templateId, resolvedTemplate);
    }
  }

  const resolvedPackage: ResolvedPackage = {
    packageId: input.packageId,
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    rawPackage: input.rawPackage,
    templatesById,
    dataTypesById,
    interfacesById,
    typeSynonymsById,
    sdkPackage: input.sdkPackage,
    sdkCompilation: input.sdkCompilation,
    sdkSemanticModel: input.sdkSemanticModel,
  };

  for (const template of templatesById.values()) {
    template.packageRef = resolvedPackage;
  }

  for (const dataType of dataTypesById.values()) {
    dataType.packageRef = resolvedPackage;
  }

  return resolvedPackage;
}

function indexSdkTemplates(
  sdkPackage: ResolvedPackage['sdkPackage'],
): Map<string, NonNullable<ResolvedTemplate['sdkTemplate']>> {
  const templates = new Map<string, NonNullable<ResolvedTemplate['sdkTemplate']>>();

  if (!sdkPackage) {
    return templates;
  }

  for (const moduleDefinition of sdkPackage.modules) {
    for (const definition of moduleDefinition.definitions) {
      if (definition.nodeKind !== 'template') {
        continue;
      }

      const templateDefinition = definition as NonNullable<ResolvedTemplate['sdkTemplate']>;
      const templateId =
        `${moduleDefinition.name}:${templateDefinition.templateId.templateName}`;
      templates.set(templateId, templateDefinition);
    }
  }

  return templates;
}

function indexSdkDataTypes(
  sdkPackage: ResolvedPackage['sdkPackage'],
): Map<string, NonNullable<ResolvedDataType['sdkDataType']>> {
  const dataTypes = new Map<string, NonNullable<ResolvedDataType['sdkDataType']>>();

  if (!sdkPackage) {
    return dataTypes;
  }

  for (const moduleDefinition of sdkPackage.modules) {
    for (const definition of moduleDefinition.definitions) {
      if (definition.nodeKind !== 'dataType') {
        continue;
      }

      dataTypes.set(
        `${moduleDefinition.name}:${definition.name}`,
        definition as NonNullable<ResolvedDataType['sdkDataType']>,
      );
    }
  }

  return dataTypes;
}
