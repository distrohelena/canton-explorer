export interface TemplateFilterEntry {
  templateId: string;
  packageId?: string;
  packageName?: string | null;
  packageVersion?: string | null;
}

export interface TemplateFilterResponse {
  templates: TemplateFilterEntry[];
}
