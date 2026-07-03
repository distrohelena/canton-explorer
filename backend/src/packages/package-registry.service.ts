import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  PackageRegistryFailureReason,
  PackageRegistryResult,
  ResolvedChoice,
  ResolvedDataType,
  ResolvedPackageInspection,
  ResolvedPackage,
  ResolvedTemplate,
  SdkRawDataType,
  SdkRawPackage,
  SdkRawTemplate,
  SdkRawTemplateChoice,
} from './daml-decoder.types';
import { resolveRawDottedName, resolveRawInternedString } from './daml-lf-raw.util';
import { PackageCacheService } from './package-cache.service';

type DamlLfSdkModule = typeof import('canton-typescript-sdk/daml-lf');

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
    this.sdkModulePromise = import('canton-typescript-sdk/daml-lf').then((sdkModule) => {
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
      }))
      .sort((left, right) => left.templateId.localeCompare(right.templateId));

    const dataTypes = Array.from(resolvedPackage.dataTypesById.values())
      .map((dataType) => ({
        typeId: dataType.typeId,
        moduleName: dataType.moduleName,
        entityName: dataType.entityName,
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
}

function buildResolvedPackage(
  input: BuildResolvedPackageInput,
): ResolvedPackage {
  const templatesById = new Map<string, ResolvedTemplate>();
  const dataTypesById = new Map<string, ResolvedDataType>();
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
