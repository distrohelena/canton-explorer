<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchPackagesByName } from '../lib/api';
import type { PackageFamilyResponse } from '../types/packages';

const props = defineProps<{ packageName: string }>();

const packageFamily = ref<PackageFamilyResponse | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    packageFamily.value = await fetchPackagesByName(props.packageName);
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

const packages = computed(() =>
  (packageFamily.value?.packages ?? []).map((entry) => ({
    ...entry,
    uploadedAtLines: formatRecordTime(entry.uploadedAt),
  })),
);
</script>

<template>
  <section class="package-detail">
    <p v-if="error" class="node-detail__message node-detail__message--error">{{ error }}</p>
    <p v-else-if="!packageFamily" class="node-detail__message">Loading package family...</p>
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
            <h2>{{ packageFamily.name }} Packages</h2>
            <p class="package-family__subtitle">Known versions of {{ packageFamily.name }}</p>
          </div>
        </header>

        <section class="node-detail__section package-detail__section--decoded">
          <h3>Versions</h3>
          <p v-if="packages.length === 0" class="update-detail__empty">
            No cached packages are known for this package name.
          </p>
          <div v-else class="package-detail__list">
            <div
              v-for="entry in packages"
              :key="entry.packageId"
              class="package-family__row"
            >
              <div class="package-family__primary">
                <RouterLink class="contract-detail__link" :to="`/packages/${entry.packageId}`">
                  {{ entry.packageId }}
                </RouterLink>
              </div>
              <div class="package-family__meta">
                <span class="package-family__version">{{ entry.version ?? 'n/a' }}</span>
                <span class="package-family__size">{{ formatPackageSize(entry.packageSize) }}</span>
                <span v-if="entry.uploadedAtLines" class="update-detail__time">
                  <span class="update-detail__time-date">{{ entry.uploadedAtLines.date }}</span>
                  <span class="update-detail__time-clock">{{ entry.uploadedAtLines.time }}</span>
                </span>
                <span v-else class="package-family__size">n/a</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
