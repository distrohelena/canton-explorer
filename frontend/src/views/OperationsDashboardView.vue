<script setup lang="ts">
import NodeStatusCard from '../components/NodeStatusCard.vue';
import { useNodes } from '../composables/useNodes';

const { nodes, loading, error, refresh } = useNodes();
</script>

<template>
  <section class="dashboard">
    <div class="dashboard__hero">
      <div class="dashboard__hero-copy">
        <h2>Connected Nodes</h2>
        <p class="dashboard__lede">Nodes currently reachable from this explorer.</p>
      </div>
      <div class="dashboard__controls">
        <button type="button" class="dashboard__refresh" @click="refresh">Refresh</button>
      </div>
    </div>

    <p v-if="loading" class="dashboard__message">Loading node status...</p>
    <p v-else-if="error" class="dashboard__message dashboard__message--error">{{ error }}</p>
    <div v-else class="dashboard__grid">
      <NodeStatusCard v-for="node in nodes" :key="node.id" :node="node" />
    </div>
  </section>
</template>
