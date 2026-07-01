<script setup lang="ts">
import NodeStatusCard from '../components/NodeStatusCard.vue';
import { useNodes } from '../composables/useNodes';

const { nodes, loading, error, refresh } = useNodes();
</script>

<template>
  <section class="dashboard">
    <div class="dashboard__toolbar">
      <div>
        <p class="eyebrow">Landing View</p>
        <h2>Operations Dashboard</h2>
      </div>
      <button type="button" @click="refresh">Refresh</button>
    </div>

    <p v-if="loading">Loading node status...</p>
    <p v-else-if="error">{{ error }}</p>
    <div v-else class="dashboard__grid">
      <NodeStatusCard v-for="node in nodes" :key="node.id" :node="node" />
    </div>
  </section>
</template>
