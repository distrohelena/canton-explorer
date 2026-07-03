export type PackageRegistryFailureReason =
  | 'missing_package'
  | 'invalid_package'
  | 'unknown_template'
  | 'unknown_choice'
  | 'unknown_data_type';

export type PackageRegistryResult<T> =
  | { ok: true; definition: T }
  | { ok: false; reason: PackageRegistryFailureReason };

export interface DamlLfInternedDottedName {
  segments_interned_str?: number[];
}

export interface DamlLfTemplateChoice {
  name_interned_str?: number;
  consuming?: boolean;
  arg_binder?: Record<string, unknown> | null;
  ret_type?: Record<string, unknown> | null;
}

export interface DamlLfType {
  interned_type?: number;
  var_interned_str?: number;
  con?: {
    args?: DamlLfType[];
    tycon?: {
      module?: {
        package_id?: {
          self_package_id?: Record<string, unknown>;
          imported_package_id_interned_str?: number;
        };
        module_name_interned_dname?: number;
      };
      name_interned_dname?: number;
    };
  } | null;
  builtin?: {
    args?: DamlLfType[];
    builtin?: string;
  } | null;
}

export interface DamlLfTypeParameter {
  var_interned_str?: number;
}

export interface DamlLfRecordField {
  type?: DamlLfType;
  field_interned_str?: number;
}

export interface DamlLfVariantField {
  type?: DamlLfType;
  constructor_interned_str?: number;
}

export interface DamlLfTemplate {
  tycon_interned_dname?: number;
  choices?: DamlLfTemplateChoice[];
}

export interface DamlLfDataType {
  params?: DamlLfTypeParameter[];
  name_interned_dname?: number;
  record?: Record<string, unknown> | null;
  variant?: Record<string, unknown> | null;
  enum?: Record<string, unknown> | null;
}

export interface DamlLfModule {
  name_interned_dname?: number;
  templates?: DamlLfTemplate[];
  data_types?: DamlLfDataType[];
}

export interface DamlLfPackageMetadata {
  name_interned_str?: number;
  version_interned_str?: number;
}

export interface DamlLfPackage {
  modules?: DamlLfModule[];
  interned_strings?: string[];
  interned_dotted_names?: DamlLfInternedDottedName[];
  interned_types?: DamlLfType[];
  metadata?: DamlLfPackageMetadata | null;
}

export interface ResolvedDataType {
  packageId: string;
  typeId: string;
  moduleName: string;
  entityName: string;
  dataType: DamlLfDataType;
  packageRef: ResolvedPackage;
}

export interface ResolvedPackage {
  packageId: string;
  packageName: string | null;
  packageVersion: string | null;
  strings: string[];
  dottedNames: string[];
  internedTypes: DamlLfType[];
  templatesById: Map<string, ResolvedTemplate>;
  dataTypesById: Map<string, ResolvedDataType>;
}

export interface ResolvedTemplate {
  packageId: string;
  templateId: string;
  moduleName: string;
  entityName: string;
  template: DamlLfTemplate;
  dataType: DamlLfDataType | null;
  packageRef: ResolvedPackage;
}

export interface ResolvedChoice {
  packageId: string;
  templateId: string;
  choice: string;
  template: ResolvedTemplate;
  templateChoice: DamlLfTemplateChoice;
}

export interface ResolvedPackageInspection {
  packageId: string;
  packageName: string | null;
  packageVersion: string | null;
  modules: string[];
  templates: Array<{
    templateId: string;
    moduleName: string;
    entityName: string;
  }>;
  dataTypes: Array<{
    typeId: string;
    moduleName: string;
    entityName: string;
  }>;
  moduleCount: number;
  templateCount: number;
  dataTypeCount: number;
}
