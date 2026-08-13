<script setup lang="ts">
import { ref, watch } from 'vue';
import PackageTypeInlineSchema from '../components/PackageTypeInlineSchema.vue';
import PackageTypeTree from '../components/PackageTypeTree.vue';
import { fetchPackageModule } from '../lib/api';
import type { PackageModuleDetailResponse } from '../types/packages';

const props = defineProps<{ packageId: string; moduleName: string }>();

const moduleDetail = ref<PackageModuleDetailResponse | null>(null);
const error = ref<string | null>(null);

async function loadModuleDetail() {
  moduleDetail.value = null;
  error.value = null;

  try {
    moduleDetail.value = await fetchPackageModule(props.packageId, props.moduleName);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
}

watch(() => [props.packageId, props.moduleName], loadModuleDetail, { immediate: true });

function formatPackageSize(packageSize: number | null): string {
  if (packageSize === null) {
    return 'n/a';
  }

  return `${new Intl.NumberFormat().format(packageSize)} bytes`;
}

function packageSectionEmptyMessage(section: 'templates' | 'dataTypes'): string {
  return section === 'templates'
    ? 'No template definitions are present in this module.'
    : 'No data type definitions are present in this module.';
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
            <h2>{{ props.moduleName }}</h2>
          </div>
        </header>

        <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
        <p v-else-if="!moduleDetail" class="node-detail__message inline-loading" role="status">
          <span class="node-updates__spinner" aria-hidden="true"></span>
          <span>Loading module...</span>
        </p>

        <div v-else class="node-detail__sections">
          <section class="node-detail__section package-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid package-detail__summary-grid">
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <dt>Package ID</dt>
                <dd class="update-detail__id">{{ moduleDetail.packageId }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Package Name</dt>
                <dd>{{ moduleDetail.name ?? 'n/a' }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Version</dt>
                <dd>{{ moduleDetail.version ?? 'n/a' }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Package Size</dt>
                <dd>{{ formatPackageSize(moduleDetail.packageSize) }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Status</dt>
                <dd>{{ moduleDetail.status === 'decoded' ? 'Decoded' : 'Not Available' }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Templates</h3>
            <p v-if="moduleDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded module structure is not available for this package.
            </p>
            <p v-else-if="moduleDetail.templates.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('templates') }}
            </p>
            <div v-else class="package-detail__list">
              <div
                v-for="template in moduleDetail.templates"
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
            <p v-if="moduleDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded module structure is not available for this package.
            </p>
            <p v-else-if="moduleDetail.dataTypes.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('dataTypes') }}
            </p>
            <div v-else class="package-detail__list">
              <div
                v-for="dataType in moduleDetail.dataTypes"
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
