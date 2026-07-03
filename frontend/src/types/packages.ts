export interface PackageSeenOnNode {
  nodeId: string;
  packageName: string | null;
  packageVersion: string | null;
  seenAt: string;
}

export interface PackageTemplateSummary {
  templateId: string;
  moduleName: string;
  entityName: string;
}

export interface PackageDataTypeSummary {
  typeId: string;
  moduleName: string;
  entityName: string;
}

export interface PackageDetailResponse {
  packageId: string;
  name: string | null;
  version: string | null;
  uploadedAt: string | null;
  packageSize: number | null;
  status: 'decoded' | 'invalid_package' | 'missing_package';
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
