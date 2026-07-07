import type {
  DamlLfChoice as SdkDamlLfChoice,
  DamlLfCompilation as SdkDamlLfCompilation,
  DamlLfDataType as SdkDamlLfDataType,
  DamlLfPackage as SdkDamlLfPackage,
  DamlLfPackageLoadResult as SdkDamlLfPackageLoadResult,
  DamlLfSemanticModel as SdkDamlLfSemanticModel,
  DamlLfTemplate as SdkDamlLfTemplate,
} from 'canton-typescript-sdk/daml-lf';
import type {
  PackageDataTypeSummary,
  PackageTemplateSummary,
} from '../domain/node.types';

export type SdkRawPackage = SdkDamlLfPackageLoadResult['rawPackage'];
export type SdkRawModule = SdkRawPackage['modules'][number];
export type SdkRawTemplate = SdkRawModule['templates'][number];
export type SdkRawTemplateChoice = SdkRawTemplate['choices'][number];
export type SdkRawDataType = SdkRawModule['dataTypes'][number];
export type SdkRawInterface = SdkRawModule['interfaces'][number];
export type SdkRawTypeSyn = SdkRawModule['synonyms'][number];
export type SdkRawType = SdkRawPackage['internedTypes'][number];

export type PackageRegistryFailureReason =
  | 'missing_package'
  | 'invalid_package'
  | 'unknown_template'
  | 'unknown_choice'
  | 'unknown_data_type';

export type PackageRegistryResult<T> =
  | { ok: true; definition: T }
  | { ok: false; reason: PackageRegistryFailureReason };

export interface ResolvedDataType {
  packageId: string;
  typeId: string;
  moduleName: string;
  entityName: string;
  dataType: SdkRawDataType;
  packageRef: ResolvedPackage;
  sdkDataType: SdkDamlLfDataType | null;
}

export interface ResolvedPackage {
  packageId: string;
  packageName: string | null;
  packageVersion: string | null;
  rawPackage: SdkRawPackage;
  templatesById: Map<string, ResolvedTemplate>;
  dataTypesById: Map<string, ResolvedDataType>;
  interfacesById: Map<string, SdkRawInterface>;
  typeSynonymsById: Map<string, SdkRawTypeSyn>;
  sdkPackage: SdkDamlLfPackage | null;
  sdkCompilation: SdkDamlLfCompilation | null;
  sdkSemanticModel: SdkDamlLfSemanticModel | null;
}

export interface ResolvedTemplate {
  packageId: string;
  templateId: string;
  moduleName: string;
  entityName: string;
  template: SdkRawTemplate;
  dataType: SdkRawDataType | null;
  packageRef: ResolvedPackage;
  sdkTemplate: SdkDamlLfTemplate | null;
}

export interface ResolvedChoice {
  packageId: string;
  templateId: string;
  choice: string;
  template: ResolvedTemplate;
  templateChoice: SdkRawTemplateChoice;
  sdkChoice: SdkDamlLfChoice | null;
}

export interface ResolvedPackageInspection {
  packageId: string;
  packageName: string | null;
  packageVersion: string | null;
  modules: string[];
  templates: PackageTemplateSummary[];
  dataTypes: PackageDataTypeSummary[];
  moduleCount: number;
  templateCount: number;
  dataTypeCount: number;
}
