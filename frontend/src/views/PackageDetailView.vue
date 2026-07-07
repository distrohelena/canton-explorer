<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import PackageTypeInlineSchema from '../components/PackageTypeInlineSchema.vue';
import PackageTypeTree from '../components/PackageTypeTree.vue';
import { fetchPackageDetail } from '../lib/api';
import type { PackageDetailResponse } from '../types/packages';

const props = defineProps<{ packageId: string }>();

const packageDetail = ref<PackageDetailResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    packageDetail.value = await fetchPackageDetail(props.packageId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
});

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

function formatDecodeStatus(status: PackageDetailResponse['status']): string {
  switch (status) {
    case 'decoded':
      return 'Decoded';
    case 'invalid_package':
      return 'Invalid Package';
    case 'missing_package':
      return 'Missing Package';
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
  if (!packageDetail.value) {
    return 'Package';
  }

  return `${packageDetail.value.name ?? packageDetail.value.packageId} Package`;
});

const uploadedAtLines = computed(() =>
  packageDetail.value ? formatRecordTime(packageDetail.value.uploadedAt) : null,
);

const seenOnNodes = computed(() =>
  (packageDetail.value?.seenOnNodes ?? []).map((node) => ({
    ...node,
    seenAtLines: formatRecordTime(node.seenAt),
  })),
);

const packageFamilyPath = computed(() => {
  if (!packageDetail.value?.name) {
    return null;
  }

  return `/packages/by-name/${encodeURIComponent(packageDetail.value.name)}`;
});
</script>

<template>
  <section class="package-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!packageDetail" class="node-detail__message">Loading package detail...</p>
    <div v-else class="node-page">
      <div class="node-page__rail">
        <RouterLink class="node-detail__back" to="/" aria-label="Back to overview">
          ←
        </RouterLink>
      </div>

      <div class="node-page__main package-detail__content">
        <header class="node-detail__hero">
          <div>
            <p class="activity-home__eyebrow">Packages</p>
            <h2>{{ heading }}</h2>
          </div>
        </header>

        <div class="node-detail__sections">
          <section class="node-detail__section package-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid package-detail__summary-grid">
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <dt>Package ID</dt>
                <dd class="update-detail__id">{{ packageDetail.packageId }}</dd>
              </div>
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <div class="package-detail__summary-pair">
                  <div class="package-detail__summary-subitem">
                    <dt>Package Name</dt>
                    <dd v-if="packageDetail.name && packageFamilyPath">
                      <RouterLink class="contract-detail__link" :to="packageFamilyPath">
                        {{ packageDetail.name }}
                      </RouterLink>
                    </dd>
                    <dd v-else>{{ packageDetail.name ?? 'n/a' }}</dd>
                  </div>
                  <div class="package-detail__summary-subitem">
                    <dt>Version</dt>
                    <dd v-if="packageDetail.version && packageFamilyPath">
                      <RouterLink class="contract-detail__link" :to="packageFamilyPath">
                        {{ packageDetail.version }}
                      </RouterLink>
                    </dd>
                    <dd v-else>{{ packageDetail.version ?? 'n/a' }}</dd>
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
                    <dd>{{ formatPackageSize(packageDetail.packageSize) }}</dd>
                  </div>
                </div>
              </div>
              <div class="package-detail__summary-item">
                <dt>Decode Status</dt>
                <dd>{{ formatDecodeStatus(packageDetail.status) }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Modules</dt>
                <dd>{{ packageDetail.moduleCount }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Templates</dt>
                <dd>{{ packageDetail.templateCount }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Data Types</dt>
                <dd>{{ packageDetail.dataTypeCount }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section package-detail__section--nodes">
            <h3>Seen On Nodes</h3>
            <p v-if="packageDetail.seenOnNodes.length === 0" class="update-detail__empty">
              No node presence recorded for this package.
            </p>
            <div v-else class="package-detail__seen-list">
              <div
                v-for="node in seenOnNodes"
                :key="`${node.nodeId}-${node.seenAt}`"
                class="package-detail__seen-row"
              >
                <div>
                  <p class="package-detail__seen-node">{{ node.nodeId }}</p>
                  <p class="package-detail__seen-meta">
                    {{ node.packageName ?? packageDetail.name ?? packageDetail.packageId }}
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
            <p v-if="packageDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded package structure is not available for this package.
            </p>
            <p v-else-if="packageDetail.modules.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('modules') }}
            </p>
            <div v-else class="package-detail__list">
              <div
                v-for="moduleName in packageDetail.modules"
                :key="moduleName"
                class="package-detail__list-row"
              >
                {{ moduleName }}
              </div>
            </div>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Templates</h3>
            <p v-if="packageDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded package structure is not available for this package.
            </p>
            <p v-else-if="packageDetail.templates.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('templates') }}
            </p>
            <div v-else class="package-detail__list">
              <div
                v-for="template in packageDetail.templates"
                :key="template.templateId"
                class="package-detail__list-row package-detail__list-row--stacked"
              >
                <div class="package-detail__entry-title">{{ template.templateId }}</div>
                <PackageTypeTree v-if="template.createType" :node="template.createType" />
              </div>
            </div>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Data Types</h3>
            <p v-if="packageDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded package structure is not available for this package.
            </p>
            <p v-else-if="packageDetail.dataTypes.length === 0" class="update-detail__empty">
              {{ packageSectionEmptyMessage('dataTypes') }}
            </p>
            <div v-else class="package-detail__list">
              <div
                v-for="dataType in packageDetail.dataTypes"
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
