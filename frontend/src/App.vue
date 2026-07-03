<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';

const router = useRouter();
const searchTerm = ref('');
const THEME_STORAGE_KEY = 'canton-explorer-theme';
type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

const themePreference = ref<ThemePreference>('system');
const systemPrefersDark = ref(false);
let systemThemeQuery: MediaQueryList | null = null;
let removeSystemThemeListener: (() => void) | null = null;

const resolvedTheme = computed<ResolvedTheme>(() =>
  themePreference.value === 'system'
    ? systemPrefersDark.value
      ? 'dark'
      : 'light'
    : themePreference.value,
);
const themeToggleLabel = computed(() =>
  resolvedTheme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
);
const themeToggleIcon = computed(() => (resolvedTheme.value === 'dark' ? '☀' : '☾'));

async function submitSearch() {
  const trimmed = searchTerm.value.trim();
  if (!trimmed) {
    return;
  }

  await router.push(`/parties/${encodeURIComponent(trimmed)}`);
}

function readStoredThemePreference(): ThemePreference {
  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedValue === 'light' || storedValue === 'dark' ? storedValue : 'system';
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function syncSystemThemePreference() {
  systemPrefersDark.value = systemThemeQuery?.matches ?? false;
}

function toggleTheme() {
  themePreference.value = resolvedTheme.value === 'dark' ? 'light' : 'dark';
}

watch(themePreference, (preference) => {
  if (preference === 'system') {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
});

watch(
  resolvedTheme,
  (theme) => {
    applyTheme(theme);
  },
  { immediate: true },
);

onMounted(() => {
  themePreference.value = readStoredThemePreference();
  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  syncSystemThemePreference();

  const handleSystemThemeChange = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches;
  };

  if ('addEventListener' in systemThemeQuery) {
    systemThemeQuery.addEventListener('change', handleSystemThemeChange);
    removeSystemThemeListener = () => {
      systemThemeQuery?.removeEventListener('change', handleSystemThemeChange);
    };
    return;
  }

  const legacySystemThemeQuery = systemThemeQuery as MediaQueryList & {
    addListener: (listener: (event: MediaQueryListEvent) => void) => void;
    removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
  };

  legacySystemThemeQuery.addListener(handleSystemThemeChange);
  removeSystemThemeListener = () => {
    legacySystemThemeQuery.removeListener(handleSystemThemeChange);
  };
});

onBeforeUnmount(() => {
  removeSystemThemeListener?.();
});
</script>

<template>
  <div class="app-shell" :data-theme="resolvedTheme">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-titlebar">
          <RouterLink class="app-brand" to="/">
            <img class="app-brand__logo" src="/cantonexplorer.png" alt="" />
            <h1 class="app-brand__title">Canton Explorer</h1>
          </RouterLink>
          <div class="app-toolbar">
            <nav class="app-nav" aria-label="Primary">
              <RouterLink class="nav-button" to="/">Home</RouterLink>
              <RouterLink class="nav-button" to="/nodes">Nodes</RouterLink>
              <RouterLink class="nav-button" to="/parties">Parties</RouterLink>
            </nav>
            <form class="app-search-form" @submit.prevent="submitSearch">
              <input
                v-model="searchTerm"
                class="app-search"
                type="text"
                placeholder="Search"
                @keydown.enter.prevent="submitSearch"
              />
            </form>
            <button
              type="button"
              class="app-theme-toggle"
              :aria-label="themeToggleLabel"
              :title="themeToggleLabel"
              @click="toggleTheme"
            >
              {{ themeToggleIcon }}
            </button>
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
