<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-titlebar">
          <h1 class="app-brand">Canton Explorer</h1>
          <div class="app-toolbar">
            <nav class="app-nav" aria-label="Primary">
              <RouterLink class="nav-button" to="/">⌂ Home</RouterLink>
              <RouterLink class="nav-button" to="/nodes">Nodes</RouterLink>
            </nav>
            <input
              class="app-search"
              type="text"
              placeholder="Search by Update ID or Party ID..."
            />
          </div>
        </div>
      </div>
    </header>
    <div class="app-frame">
      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>
