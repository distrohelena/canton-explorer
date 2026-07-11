export interface PackageSeenOnNode {
  nodeId: string;
  packageName: string | null;
  packageVersion: string | null;
  seenAt: string;
}

export interface PackageTypeField {
  name: string;
  type: PackageTypeNode;
}

export interface PackageTypeConstructor {
  name: string;
  type: PackageTypeNode | null;
}

export interface PackageInterfaceMethod {
  name: string;
  type: PackageTypeNode | null;
}

export interface PackageInterfaceChoice {
  name: string;
  consuming: boolean;
  argumentType: PackageTypeNode | null;
  resultType: PackageTypeNode | null;
}

export interface PackageTypeNode {
  kind:
    | 'builtin'
    | 'type_var'
    | 'type_con'
    | 'record'
    | 'variant'
    | 'enum'
    | 'interface'
    | 'struct'
    | 'forall'
    | 'nat'
    | 'synonym'
    | 'unknown';
  label: string;
  packageId?: string | null;
  typeId?: string | null;
  arguments?: PackageTypeNode[];
  typeParameters?: string[];
  fields?: PackageTypeField[];
  constructors?: PackageTypeConstructor[];
  view?: PackageTypeNode | null;
  requires?: PackageTypeNode[];
  methods?: PackageInterfaceMethod[];
  choices?: PackageInterfaceChoice[];
  body?: PackageTypeNode | null;
  definition?: PackageTypeNode | null;
  note?: 'recursive_reference' | 'missing_definition' | 'unsupported';
}

export interface PackageTemplateSummary {
  templateId: string;
  moduleName: string;
  entityName: string;
  createType: PackageTypeNode | null;
}

export interface PackageDataTypeSummary {
  typeId: string;
  moduleName: string;
  entityName: string;
  definition: PackageTypeNode | null;
}

export interface PackageDetailResponse {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
  status: 'decoded' | 'invalid_package' | 'missing_package' | 'not_available';
  seenOnNodes: PackageSeenOnNode[];
  moduleCount: number;
  templateCount: number;
  dataTypeCount: number;
  modules: string[];
  templates: PackageTemplateSummary[];
  dataTypes: PackageDataTypeSummary[];
}

export interface PackageFamilyEntry {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
}

export interface PackageFamilyResponse {
  name: string;
  packages: PackageFamilyEntry[];
}
