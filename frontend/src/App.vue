<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { fetchBranding } from './lib/api';
import type { BrandingConfig } from './types/branding';

const router = useRouter();
const route = useRoute();
const searchTerm = ref('');
const explorerVersion = __CANTON_EXPLORER_VERSION__;
const THEME_STORAGE_KEY = 'canton-explorer-theme';
const DEFAULT_APPLICATION_TITLE = 'Canton Explorer';
const DEFAULT_HEADER_TITLE = 'Canton Explorer';
type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

const branding = ref<BrandingConfig>({
  applicationTitle: DEFAULT_APPLICATION_TITLE,
  headerTitle: DEFAULT_HEADER_TITLE,
});
const previousDocumentTitle = document.title;
const themePreference = ref<ThemePreference>('system');
const systemPrefersDark = ref(false);
const exploreMenuOpen = ref(false);
let systemThemeQuery: MediaQueryList | null = null;
let removeSystemThemeListener: (() => void) | null = null;

const resolvedTheme = computed<ResolvedTheme>(() =>
  themePreference.value === 'system'
    ? systemPrefersDark.value
      ? 'dark'
      : 'light'
    : themePreference.value,
);
const isDebuggerRoute = computed(() => route.path === '/debugger');
const exploreLabel = computed(() => {
  if (route.path === '/') {
    return 'Updates';
  }

  if (route.path.startsWith('/contracts')) {
    return 'Contracts';
  }

  if (route.path.startsWith('/nodes')) {
    return 'Nodes';
  }

  if (route.path.startsWith('/parties')) {
    return 'Parties';
  }

  if (route.path.startsWith('/tokens')) {
    return 'Tokens';
  }

  if (route.path === '/canton-coin') {
    return 'Canton Coin';
  }

  if (route.path.startsWith('/traffic')) {
    return 'Traffic Purchases';
  }

  if (route.path === '/debugger') {
    return 'Debugger';
  }

  if (route.path === '/settings') {
    return 'Settings';
  }

  return 'Explore';
});
const themeToggleLabel = computed(() =>
  resolvedTheme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
);
const themeToggleIcon = computed(() => (resolvedTheme.value === 'dark' ? '☀' : '☾'));

async function submitSearch() {
  const trimmed = searchTerm.value.trim();
  if (!trimmed) {
    return;
  }

  await router.push({
    path: '/search',
    query: { q: trimmed },
  });
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

function toggleExploreMenu() {
  exploreMenuOpen.value = !exploreMenuOpen.value;
}

function closeExploreMenu() {
  exploreMenuOpen.value = false;
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest('.app-explore')) {
    return;
  }

  closeExploreMenu();
}

async function loadBranding() {
  try {
    branding.value = await fetchBranding();
  } catch {
    // Keep the independent defaults when configured branding is unavailable.
  }
}

watch(themePreference, (preference) => {
  if (preference === 'system') {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
});

watch(
  () => [route.path, route.query.q] as const,
  ([path, rawQuery]) => {
    if (path !== '/search') {
      return;
    }

    const queryValue = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
    searchTerm.value = typeof queryValue === 'string' ? queryValue.trim() : '';
  },
  { immediate: true },
);

watch(
  () => route.path,
  () => {
    closeExploreMenu();
  },
);

watch(
  resolvedTheme,
  (theme) => {
    applyTheme(theme);
  },
  { immediate: true },
);

watch(
  () => branding.value.applicationTitle,
  (applicationTitle) => {
    document.title = applicationTitle;
  },
  { immediate: true },
);

onMounted(() => {
  void loadBranding();
});

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
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
  document.removeEventListener('click', handleDocumentClick);
  removeSystemThemeListener?.();
  document.title = previousDocumentTitle;
});
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--debugger': isDebuggerRoute }" :data-theme="resolvedTheme">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-titlebar">
          <RouterLink class="app-brand" to="/">
            <img class="app-brand__logo" src="/cantonexplorer.png" alt="" />
            <h1 class="app-brand__title">{{ branding.headerTitle }}</h1>
          </RouterLink>
          <div class="app-toolbar">
            <div class="app-explore">
              <button
                id="explore-menu-button"
                type="button"
                class="app-explore__button"
                aria-controls="explore-menu"
                :aria-expanded="exploreMenuOpen"
                title="Explore"
                @click="toggleExploreMenu"
              >
                {{ exploreLabel }}
                <svg
                  class="app-explore__arrow"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.75"
                  />
                </svg>
              </button>
              <nav
                v-if="exploreMenuOpen"
                id="explore-menu"
                class="app-explore__menu"
                aria-label="Explore"
              >
                <div class="app-explore__group" aria-labelledby="ledger-menu-label">
                  <span id="ledger-menu-label" class="app-explore__group-label">Ledger</span>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/" @click="closeExploreMenu">
                    Updates
                  </RouterLink>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/contracts" @click="closeExploreMenu">
                    Contracts
                  </RouterLink>
                </div>
                <div class="app-explore__group" aria-labelledby="network-menu-label">
                  <span id="network-menu-label" class="app-explore__group-label">Network</span>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/nodes" @click="closeExploreMenu">
                    Nodes
                  </RouterLink>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/parties" @click="closeExploreMenu">
                    Parties
                  </RouterLink>
                </div>
                <div class="app-explore__group" aria-labelledby="assets-menu-label">
                  <span id="assets-menu-label" class="app-explore__group-label">Assets</span>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/tokens" @click="closeExploreMenu">
                    Tokens
                  </RouterLink>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/canton-coin" @click="closeExploreMenu">
                    Canton Coin
                  </RouterLink>
                </div>
                <div class="app-explore__group" aria-labelledby="traffic-menu-label">
                  <span id="traffic-menu-label" class="app-explore__group-label">Traffic</span>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/traffic" @click="closeExploreMenu">
                    Traffic Purchases
                  </RouterLink>
                </div>
                <div class="app-explore__group" aria-labelledby="tools-menu-label">
                  <span id="tools-menu-label" class="app-explore__group-label">Tools</span>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/debugger" @click="closeExploreMenu">
                    Debugger
                  </RouterLink>
                  <RouterLink class="app-explore__link app-explore__group-link" to="/settings" @click="closeExploreMenu">
                    Settings
                  </RouterLink>
                </div>
              </nav>
            </div>
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
    <div class="app-frame" :class="{ 'app-frame--debugger': isDebuggerRoute }">
      <main class="app-main">
        <RouterView />
      </main>
    </div>
    <footer v-if="!isDebuggerRoute" class="app-footer">
      <div class="app-footer__inner">
        <p class="app-footer__text">
          powered by
          <a
            class="app-footer__package"
            href="https://www.npmjs.com/package/@distrohelena/canton-typescript-sdk"
            target="_blank"
            rel="noreferrer"
          >
            @distrohelena/canton-typescript-sdk
          </a>
          <span> · version {{ explorerVersion }}</span>
        </p>
      </div>
    </footer>
  </div>
</template>
