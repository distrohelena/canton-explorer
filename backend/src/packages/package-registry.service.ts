import { Injectable } from '@nestjs/common';
import type {
  DamlLfDataType,
  DamlLfPackage,
  DamlLfTemplate,
  DamlLfTemplateChoice,
  PackageRegistryFailureReason,
  PackageRegistryResult,
  ResolvedChoice,
  ResolvedDataType,
  ResolvedPackageInspection,
  ResolvedPackage,
  ResolvedTemplate,
} from './daml-decoder.types';
import { loadArchiveRoot } from './daml-lf-loader';
import { PackageCacheService } from './package-cache.service';

interface ResolveTemplateInput {
  packageId: string;
  templateId: string;
}

interface ResolveChoiceInput extends ResolveTemplateInput {
  choice: string;
}

interface DamlLfArchive {
  payload?: Uint8Array;
}

interface DamlLfArchivePayload {
  daml_lf_2?: Uint8Array;
}

@Injectable()
export class PackageRegistryService {
  private readonly archiveRoot = loadArchiveRoot();
  private readonly archiveType = this.archiveRoot.lookupType('daml_lf.Archive');
  private readonly archivePayloadType =
    this.archiveRoot.lookupType('daml_lf.ArchivePayload');
  private readonly packageType = this.archiveRoot.lookupType('daml_lf_2.Package');
  private readonly packageCache = new Map<
    string,
    ResolvedPackage | PackageRegistryFailureReason
  >();

  constructor(private readonly cacheService: PackageCacheService) {}

  async resolveTemplate(
    input: ResolveTemplateInput,
  ): Promise<PackageRegistryResult<ResolvedTemplate>> {
    const resolvedPackage = this.loadPackage(input.packageId);
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
          resolveInternedString(
            templateResult.definition.packageRef.strings,
            choice.name_interned_str,
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
      },
    };
  }

  async resolveDataType(input: {
    packageId: string;
    typeId: string;
  }): Promise<PackageRegistryResult<ResolvedDataType>> {
    return this.resolveDataTypeSync(input);
  }

  async inspectPackage(
    packageId: string,
  ): Promise<PackageRegistryResult<ResolvedPackageInspection>> {
    const resolvedPackage = this.loadPackage(packageId);
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
    const resolvedPackage = this.loadPackage(input.packageId);
    if (typeof resolvedPackage === 'string') {
      return { ok: false, reason: resolvedPackage };
    }

    const dataType = resolvedPackage.dataTypesById.get(input.typeId);
    if (!dataType) {
      return { ok: false, reason: 'unknown_data_type' };
    }

    return { ok: true, definition: dataType };
  }

  private loadPackage(
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
      const archive = this.archiveType.decode(packageBlob.data) as DamlLfArchive;
      if (!archive.payload) {
        throw new Error('Missing archive payload');
      }

      const payload = this.archivePayloadType.decode(
        archive.payload,
      ) as DamlLfArchivePayload;
      if (!payload.daml_lf_2) {
        throw new Error('Missing LF2 package payload');
      }

      const packageObject = this.packageType.toObject(
        this.packageType.decode(payload.daml_lf_2),
        {
          arrays: true,
          bytes: String,
          enums: String,
          longs: Number,
        },
      ) as DamlLfPackage;

      const resolvedPackage = buildResolvedPackage(
        packageId,
        packageBlob.name,
        packageBlob.version,
        packageObject,
      );
      this.packageCache.set(packageId, resolvedPackage);
      return resolvedPackage;
    } catch {
      this.packageCache.set(packageId, 'invalid_package');
      return 'invalid_package';
    }
  }
}

function buildResolvedPackage(
  packageId: string,
  packageName: string | null,
  packageVersion: string | null,
  pkg: DamlLfPackage,
): ResolvedPackage {
  const strings = pkg.interned_strings ?? [];
  const dottedNames = (pkg.interned_dotted_names ?? []).map((entry) =>
    (entry.segments_interned_str ?? [])
      .map((index) => strings[index] ?? '')
      .filter((segment) => segment.length > 0)
      .join('.'),
  );
  const internedTypes = pkg.interned_types ?? [];
  const templatesById = new Map<string, ResolvedTemplate>();
  const dataTypesById = new Map<string, ResolvedDataType>();

  for (const moduleDefinition of pkg.modules ?? []) {
    const moduleName = resolveDottedName(
      dottedNames,
      moduleDefinition.name_interned_dname,
    );
    if (!moduleName) {
      continue;
    }

    const dataTypesByName = new Map<string, DamlLfDataType>();
    for (const dataType of moduleDefinition.data_types ?? []) {
      const dataTypeName = resolveDottedName(
        dottedNames,
        dataType.name_interned_dname,
      );
      if (dataTypeName) {
        dataTypesByName.set(dataTypeName, dataType);
        const typeId = `${moduleName}:${dataTypeName}`;
        dataTypesById.set(typeId, {
          packageId,
          typeId,
          moduleName,
          entityName: dataTypeName,
          dataType,
          packageRef: undefined as never,
        });
      }
    }

    for (const template of moduleDefinition.templates ?? []) {
      const entityName = resolveDottedName(
        dottedNames,
        template.tycon_interned_dname,
      );
      if (!entityName) {
        continue;
      }

      const templateId = `${moduleName}:${entityName}`;
      const resolvedTemplate: ResolvedTemplate = {
        packageId,
        templateId,
        moduleName,
        entityName,
        template,
        dataType: dataTypesByName.get(entityName) ?? null,
        packageRef: undefined as never,
      };
      templatesById.set(templateId, resolvedTemplate);
    }
  }

  const resolvedPackage: ResolvedPackage = {
    packageId,
    packageName,
    packageVersion,
    strings,
    dottedNames,
    internedTypes,
    templatesById,
    dataTypesById,
  };

  for (const template of templatesById.values()) {
    template.packageRef = resolvedPackage;
  }

  for (const dataType of dataTypesById.values()) {
    dataType.packageRef = resolvedPackage;
  }

  return resolvedPackage;
}

function resolveDottedName(
  dottedNames: string[],
  index: number | undefined,
): string | null {
  if (typeof index !== 'number') {
    return null;
  }

  return dottedNames[index] ?? null;
}

function resolveInternedString(
  strings: string[],
  index: number | undefined,
): string | null {
  if (typeof index !== 'number') {
    return null;
  }

  return strings[index] ?? null;
}
