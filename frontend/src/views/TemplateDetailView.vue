<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import PackageTypeTree from '../components/PackageTypeTree.vue';
import { fetchPackageTemplate } from '../lib/api';
import { choiceAnchorId, choiceNameFromHash } from '../lib/template-anchor';
import type { PackageTemplateDetailResponse } from '../types/packages';

const props = defineProps<{ packageId: string; templateId: string }>();
const route = useRoute();

const templateDetail = ref<PackageTemplateDetailResponse | null>(null);
const error = ref<string | null>(null);

async function loadTemplateDetail() {
  templateDetail.value = null;
  error.value = null;

  try {
    templateDetail.value = await fetchPackageTemplate(props.packageId, props.templateId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
}

watch(() => [props.packageId, props.templateId], loadTemplateDetail, { immediate: true });

watch([() => route.hash, templateDetail], async ([hash, detail]) => {
  if (!detail) {
    return;
  }

  const choiceName = choiceNameFromHash(hash);
  const anchorId = choiceName ? choiceAnchorId(choiceName) : null;
  if (!anchorId) {
    return;
  }

  await nextTick();

  const target = document.getElementById(anchorId);
  if (target) {
    target.scrollIntoView();
  }
});

function formatPackageSize(packageSize: number | null): string {
  if (packageSize === null) {
    return 'n/a';
  }

  return `${new Intl.NumberFormat().format(packageSize)} bytes`;
}
</script>

<template>
  <section class="package-detail">
    <div class="node-page">
      <div class="node-page__main package-detail__content">
        <header class="node-detail__hero">
          <div>
            <h2>{{ props.templateId }}</h2>
          </div>
        </header>

        <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
        <p v-else-if="!templateDetail" class="node-detail__message inline-loading" role="status">
          <span class="node-updates__spinner" aria-hidden="true"></span>
          <span>Loading template...</span>
        </p>

        <div v-else class="node-detail__sections">
          <section class="node-detail__section package-detail__section--summary">
            <h3>Summary</h3>
            <dl class="detail-grid package-detail__summary-grid">
              <div class="package-detail__summary-item package-detail__summary-item--full-row">
                <dt>Package ID</dt>
                <dd class="update-detail__id">{{ templateDetail.packageId }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Package Name</dt>
                <dd>{{ templateDetail.name ?? 'n/a' }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Version</dt>
                <dd>{{ templateDetail.version ?? 'n/a' }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Module</dt>
                <dd>{{ templateDetail.template?.moduleName ?? 'n/a' }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Entity</dt>
                <dd>{{ templateDetail.template?.entityName ?? 'n/a' }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Package Size</dt>
                <dd>{{ formatPackageSize(templateDetail.packageSize) }}</dd>
              </div>
              <div class="package-detail__summary-item">
                <dt>Status</dt>
                <dd>{{ templateDetail.status === 'decoded' ? 'Decoded' : 'Not Available' }}</dd>
              </div>
            </dl>
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Create Data</h3>
            <p v-if="templateDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded template structure is not available for this package.
            </p>
            <p v-else-if="!templateDetail.template" class="update-detail__empty">
              Template definition not found in this package.
            </p>
            <p v-else-if="!templateDetail.template.createType" class="update-detail__empty">
              No create data type is available for this template.
            </p>
            <PackageTypeTree
              v-else
              :node="templateDetail.template.createType"
            />
          </section>

          <section class="node-detail__section package-detail__section--decoded">
            <h3>Choices</h3>
            <p v-if="templateDetail.status !== 'decoded'" class="update-detail__empty">
              Decoded template structure is not available for this package.
            </p>
            <p v-else-if="!templateDetail.template" class="update-detail__empty">
              Template definition not found in this package.
            </p>
            <p v-else-if="templateDetail.template.choices.length === 0" class="update-detail__empty">
              No choices are available for this template.
            </p>
            <div v-else class="package-detail__list">
              <div
                v-for="choice in templateDetail.template.choices"
                :key="choice.name"
                :id="choiceAnchorId(choice.name) ?? undefined"
                class="package-detail__list-row package-detail__list-row--stacked"
              >
                <div class="package-detail__entry-title">{{ choice.name }}</div>
                <div class="package-tree__choice">
                  <div class="package-tree__meta">
                    {{ choice.consuming ? 'Consuming' : 'Non-Consuming' }}
                  </div>
                  <div class="package-tree__group">
                    <div class="package-tree__group-title">Argument</div>
                    <div v-if="choice.argumentType" class="package-tree__children">
                      <PackageTypeTree :node="choice.argumentType" />
                    </div>
                    <p v-else class="update-detail__empty">Argument type is unavailable.</p>
                  </div>
                  <div class="package-tree__group">
                    <div class="package-tree__group-title">Result</div>
                    <div v-if="choice.resultType" class="package-tree__children">
                      <PackageTypeTree :node="choice.resultType" />
                    </div>
                    <p v-else class="update-detail__empty">Result type is unavailable.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
