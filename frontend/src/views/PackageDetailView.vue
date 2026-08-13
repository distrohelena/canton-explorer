<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PackageTypeInlineSchema from '../components/PackageTypeInlineSchema.vue';
import PackageTypeTree from '../components/PackageTypeTree.vue';
import {
  fetchPackageDataTypes,
  fetchPackageModules,
  fetchPackageNodes,
  fetchPackageSummary,
  fetchPackageTemplates,
} from '../lib/api';
import type {
  PackageDetailDataTypesResponse,
  PackageDetailModulesResponse,
  PackageDetailNodesResponse,
  PackageDetailStatus,
  PackageDetailSummaryResponse,
  PackageDetailTemplatesResponse,
} from '../types/packages';

const props = defineProps<{ packageId: string }>();

const packageSummary = ref<PackageDetailSummaryResponse | null>(null);
const packageNodes = ref<PackageDetailNodesResponse | null>(null);
const packageModules = ref<PackageDetailModulesResponse | null>(null);
const packageTemplates = ref<PackageDetailTemplatesResponse | null>(null);
const packageDataTypes = ref<PackageDetailDataTypesResponse | null>(null);
const summaryLoading = ref(false);
const nodesLoading = ref(false);
const modulesLoading = ref(false);
const templatesLoading = ref(false);
const dataTypesLoading = ref(false);
const summaryError = ref<string | null>(null);
const nodesError = ref<string | null>(null);
const modulesError = ref<string | null>(null);
const templatesError = ref<string | null>(null);
const dataTypesError = ref<string | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function loadPackageSummary() {
  summaryLoading.value = true;
  summaryError.value = null;
  packageSummary.value = null;

  try {
    packageSummary.value = await fetchPackageSummary(props.packageId);
  } catch (error) {
    summaryError.value = getErrorMessage(error);
  } finally {
    summaryLoading.value = false;
  }
}

async function loadPackageNodes() {
  nodesLoading.value = true;
  nodesError.value = null;
  packageNodes.value = null;

  try {
    packageNodes.value = await fetchPackageNodes(props.packageId);
  } catch (error) {
    nodesError.value = getErrorMessage(error);
  } finally {
    nodesLoading.value = false;
  }
}

async function loadPackageModules() {
  modulesLoading.value = true;
  modulesError.value = null;
  packageModules.value = null;

  try {
    packageModules.value = await fetchPackageModules(props.packageId);
  } catch (error) {
    modulesError.value = getErrorMessage(error);
  } finally {
    modulesLoading.value = false;
  }
}

async function loadPackageTemplates() {
  templatesLoading.value = true;
  templatesError.value = null;
  packageTemplates.value = null;

  try {
    packageTemplates.value = await fetchPackageTemplates(props.packageId);
  } catch (error) {
    templatesError.value = getErrorMessage(error);
  } finally {
    templatesLoading.value = false;
  }
}

async function loadPackageDataTypes() {
  dataTypesLoading.value = true;
  dataTypesError.value = null;
  packageDataTypes.value = null;

  try {
    packageDataTypes.value = await fetchPackageDataTypes(props.packageId);
  } catch (error) {
    dataTypesError.value = getErrorMessage(error);
  } finally {
    dataTypesLoading.value = false;
  }
}

function loadPackageSections() {
  void loadPackageSummary();
  void loadPackageNodes();
  void loadPackageModules();
  void loadPackageTemplates();
  void loadPackageDataTypes();
}

watch(() => props.packageId, loadPackageSections, { immediate: true });

function formatRecordTime(recordTime: string | null): { date: string; time: string } | null {
  if (!recordTime) {
    return null;
  }

  const parsed = new Date(recordTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(parsed),
    time: new Intl.DateTimeFormat(undefined, {
      timeStyle: 'medium',
    }).format(parsed),
  };
}

function formatPackageSize(packageSize: number | null): string {
  if (packageSize === null) {
    return 'n/a';
  }

  return `${new Intl.NumberFormat().format(packageSize)} bytes`;
}

function formatDecodeStatus(status: PackageDetailStatus): string {
  switch (status) {
    case 'decoded':
      return 'Decoded';
    case 'invalid_package':
      return 'Invalid Package';
    case 'missing_package':
      return 'Missing Package';
    case 'not_available':
      return 'Not Available';
  }
}

function packageSectionEmptyMessage(section: 'modules' | 'templates' | 'dataTypes'): string {
  switch (section) {
    case 'modules':
      return 'No decoded modules are present in this package.';
    case 'templates':
      return 'No template definitions are present in this package.';
    case 'dataTypes':
      return 'No data type definitions are present in this package.';
  }
}

const heading = computed(() => {
  if (!packageSummary.value) {
    return 'Package';
  }

  return `${packageSummary.value.name ?? packageSummary.value.packageId} Package`;
});

const uploadedAtLines = computed(() =>
  packageSummary.value ? formatRecordTime(packageSummary.value.uploadedAt) : null,
);

const seenOnNodes = computed(() =>
  (packageNodes.value?.seenOnNodes ?? []).map((node) => ({
    ...node,
    seenAtLines: formatRecordTime(node.seenAt),
  })),
);

const packageFamilyPath = computed(() => {
  if (!packageSummary.value?.name) {
    return null;
  }

  return `/packages/by-name/${encodeURIComponent(packageSummary.value.name)}`;
});

function packageModulePath(moduleName: string): string {
  return `/packages/${encodeURIComponent(props.packageId)}/modules/${encodeURIComponent(moduleName)}`;
}

function packageTemplatePath(templateId: string): string {
  return `/packages/${encodeURIComponent(props.packageId)}/templates/${encodeURIComponent(templateId)}`;
}
</script>

<template>
  <section class="package-detail">
    <div class="node-page">
      <div class="node-page__main package-detail__content">
        <header class="node-detail__hero">
          <div>
            <h2>{{ heading }}</h2>
          </div>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section package-detail__section--summary">
            <h3>Summary</h3>
            <div v-if="summaryLoading" class="inline-loading" role="status" aria-label="Loading summary">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading summary...</span>
            </div>
            <p v-else-if="summaryError" class="node-detail__message node-detail__message--error">
              {{ summaryError }}
            </p>
            <dl v-else-if="packageSummary" class="detail-grid package-detail__summary-grid">
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <dt>Package ID</dt>
                <dd class="update-detail__id">{{ packageSummary.packageId }}</dd>
              </div>
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <div class="package-detail__summary-pair">
                  <div class="package-detail__summary-subitem">
                    <dt>Package Name</dt>
                    <dd v-if="packageSummary.name && packageFamilyPath">
                      <RouterLink class="contract-detail__link" :to="packageFamilyPath">
                        {{ packageSummary.name }}
                      </RouterLink>
                    </dd>
                    <dd v-else>{{ packageSummary.name ?? 'n/a' }}</dd>
                  </div>
                  <div class="package-detail__summary-subitem">
                    <dt>Version</dt>
                    <dd v-if="packageSummary.version && packageFamilyPath">
                      <RouterLink class="contract-detail__link" :to="packageFamilyPath">
                        {{ packageSummary.version }}
                      </RouterLink>
                    </dd>
                    <dd v-else>{{ packageSummary.version ?? 'n/a' }}</dd>
                  </div>
                </div>
              </div>
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <div class="package-detail__summary-pair">
                  <div class="package-detail__summary-subitem">
                    <dt>Uploaded At</dt>
                    <dd v-if="uploadedAtLines" class="update-detail__time">
                      <span class="update-detail__time-date">
                        {{ uploadedAtLines.date }}
                      </span>
                      <span class="update-detail__time-clock">
                        {{ uploadedAtLines.time }}
                      </span>
                    </dd>
                    <dd v-else>n/a</dd>
                  </div>
                  <div class="package-detail__summary-subitem">
                    <dt>Package Size</dt>
                    <dd>{{ formatPackageSize(packageSummary.packageSize) }}</dd>
                  </div>
                </div>
              </div>
              <div class="package-detail__summary-item">
                <dt>Decode Status</dt>
                <dd>{{ formatDecodeStatus(packageSummary.status) }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Modules</dt>
                <dd>{{ packageSummary.moduleCount }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Templates</dt>
                <dd>{{ packageSummary.templateCount }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Data Types</dt>
                <dd>{{ packageSummary.dataTypeCount }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section package-detail__section--nodes">
            <h3>Seen On Nodes</h3>
            <div v-if="nodesLoading" class="inline-loading" role="status" aria-label="Loading observed nodes">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading observed nodes...</span>
            </div>
            <p v-else-if="nodesError" class="node-detail__message node-detail__message--error">
              {{ nodesError }}
            </p>
            <p v-else-if="packageNodes?.seenOnNodes.length === 0" class="update-detail__empty">
              No node presence recorded for this package.
            </p>
            <div v-else-if="packageNodes" class="package-detail__seen-list">
              <div
                v-for="node in seenOnNodes"
                :key="`${node.nodeId}-${node.seenAt}`"
                class="package-detail__seen-row"
              >
                <div>
                  <p class="package-detail__seen-node">{{ node.nodeId }}</p>
                  <p class="package-detail__seen-meta">
                    {{ node.packageName ?? packageSummary?.name ?? props.packageId }}
                  </p>
                </div>
                <div v-if="node.seenAtLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{ node.seenAtLines.date }}</span>
                  <span class="update-detail__time-clock">{{ node.seenAtLines.time }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Modules</h3>
            <div v-if="modulesLoading" class="inline-loading" role="status" aria-label="Loading modules">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading modules...</span>
            </div>
            <p v-else-if="modulesError" class="node-detail__message node-detail__message--error">
              {{ modulesError }}
            </p>
            <p v-else-if="packageModules?.status !== 'decoded'" class="update-detail__empty">
              Decoded package structure is not available for this package.
            </p>
            <p v-else-if="packageModules?.modules.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('modules') }}
            </p>
            <div v-else-if="packageModules" class="package-detail__list">
              <div
                v-for="moduleName in packageModules.modules"
                :key="moduleName"
                class="package-detail__list-row"
              >
                <RouterLink class="contract-detail__link" :to="packageModulePath(moduleName)">
                  {{ moduleName }}
                </RouterLink>
              </div>
            </div>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Templates</h3>
            <div v-if="templatesLoading" class="inline-loading" role="status" aria-label="Loading templates">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading templates...</span>
            </div>
            <p v-else-if="templatesError" class="node-detail__message node-detail__message--error">
              {{ templatesError }}
            </p>
            <p v-else-if="packageTemplates?.status !== 'decoded'" class="update-detail__empty">
              Decoded package structure is not available for this package.
            </p>
            <p v-else-if="packageTemplates?.templates.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('templates') }}
            </p>
            <div v-else-if="packageTemplates" class="package-detail__list">
              <div
                v-for="template in packageTemplates.templates"
                :key="template.templateId"
                class="package-detail__list-row package-detail__list-row--stacked"
              >
                <div class="package-detail__entry-title">
                  <RouterLink class="contract-detail__link" :to="packageTemplatePath(template.templateId)">
                    {{ template.templateId }}
                  </RouterLink>
                </div>
                <PackageTypeTree v-if="template.createType" :node="template.createType" />
              </div>
            </div>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Data Types</h3>
            <div v-if="dataTypesLoading" class="inline-loading" role="status" aria-label="Loading data types">
              <span class="node-updates__spinner" aria-hidden="true"></span>
              <span>Loading data types...</span>
            </div>
            <p v-else-if="dataTypesError" class="node-detail__message node-detail__message--error">
              {{ dataTypesError }}
            </p>
            <p v-else-if="packageDataTypes?.status !== 'decoded'" class="update-detail__empty">
              Decoded package structure is not available for this package.
            </p>
            <p v-else-if="packageDataTypes?.dataTypes.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('dataTypes') }}
            </p>
            <div v-else-if="packageDataTypes" class="package-detail__list">
              <div
                v-for="dataType in packageDataTypes.dataTypes"
                :key="dataType.typeId"
                class="package-detail__list-row package-detail__list-row--stacked"
              >
                <div class="package-detail__entry-title">{{ dataType.typeId }}</div>
                <PackageTypeInlineSchema
                  v-if="dataType.definition"
                  :node="dataType.definition"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
