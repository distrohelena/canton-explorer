<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { fetchBranding } from './lib/api';
import {
  navigationMenus,
  resolveNavigationContext,
  type NavigationMenu,
  type NavigationMenuId,
} from './lib/navigation';
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
const openNavigationMenuId = ref<NavigationMenuId | null>(null);
const pointerOpenedNavigationMenuId = ref<NavigationMenuId | null>(null);
const navigationMenuTriggers = new Map<NavigationMenuId, HTMLButtonElement>();
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
const navigationContext = computed(() => resolveNavigationContext(route.path));
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

function displayNavigationLabel(menu: NavigationMenu): string {
  return navigationContext.value.menuId === menu.id
    ? navigationContext.value.title
    : menu.label;
}

function setNavigationMenuTrigger(menuId: NavigationMenuId, element: Element | null) {
  if (element instanceof HTMLButtonElement) {
    navigationMenuTriggers.set(menuId, element);
  } else {
    navigationMenuTriggers.delete(menuId);
  }
}

function openNavigationMenu(menuId: NavigationMenuId) {
  openNavigationMenuId.value = menuId;
  pointerOpenedNavigationMenuId.value = menuId;
}

function toggleNavigationMenu(menuId: NavigationMenuId) {
  if (pointerOpenedNavigationMenuId.value === menuId) {
    pointerOpenedNavigationMenuId.value = null;
    return;
  }

  openNavigationMenuId.value = openNavigationMenuId.value === menuId ? null : menuId;
  pointerOpenedNavigationMenuId.value = null;
}

function closeNavigationMenu() {
  openNavigationMenuId.value = null;
  pointerOpenedNavigationMenuId.value = null;
}

function handleNavigationEscape(menuId: NavigationMenuId) {
  closeNavigationMenu();
  navigationMenuTriggers.get(menuId)?.focus();
}

function handleNavigationFocusout(event: FocusEvent, menuId: NavigationMenuId) {
  const wrapper = event.currentTarget;
  const nextTarget = event.relatedTarget;
  if (wrapper instanceof Element && nextTarget instanceof Node && wrapper.contains(nextTarget)) {
    return;
  }

  if (nextTarget instanceof Element && nextTarget.closest('.app-navigation')) {
    queueMicrotask(() => {
      if (openNavigationMenuId.value === menuId) {
        closeNavigationMenu();
      }
    });
    return;
  }

  if (!(wrapper instanceof Element) || !(nextTarget instanceof Node) || !wrapper.contains(nextTarget)) {
    closeNavigationMenu();
  }
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest('.app-navigation')) {
    return;
  }

  closeNavigationMenu();
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
    closeNavigationMenu();
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
            <div
              v-for="menu in navigationMenus"
              :key="menu.id"
              class="app-navigation"
              @pointerenter="openNavigationMenu(menu.id)"
              @pointerleave="closeNavigationMenu"
              @focusout="handleNavigationFocusout($event, menu.id)"
            >
              <button
                :id="`app-navigation-trigger-${menu.id}`"
                type="button"
                class="app-navigation__button"
                :aria-controls="`app-navigation-menu-${menu.id}`"
                :aria-expanded="openNavigationMenuId === menu.id"
                :title="displayNavigationLabel(menu)"
                :ref="(element) => setNavigationMenuTrigger(menu.id, element)"
                @click="toggleNavigationMenu(menu.id)"
                @keydown.enter.prevent="toggleNavigationMenu(menu.id)"
                @keydown.space.prevent="toggleNavigationMenu(menu.id)"
                @keydown.esc.prevent.stop="handleNavigationEscape(menu.id)"
              >
                <span class="app-navigation__button-label">{{ displayNavigationLabel(menu) }}</span>
                <svg
                  class="app-navigation__arrow"
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
                v-if="openNavigationMenuId === menu.id"
                :id="`app-navigation-menu-${menu.id}`"
                class="app-navigation__menu"
                :aria-label="`${menu.label} navigation`"
                @keydown.esc.prevent.stop="handleNavigationEscape(menu.id)"
              >
                <RouterLink
                  v-for="link in menu.links"
                  :key="link.to"
                  class="app-navigation__link"
                  :to="link.to"
                  @click="closeNavigationMenu"
                >
                  {{ link.label }}
                </RouterLink>
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
