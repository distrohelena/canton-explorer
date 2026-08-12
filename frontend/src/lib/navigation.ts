export type NavigationMenuId = 'ledger' | 'network' | 'system';

export interface NavigationLink {
  label: string;
  to: string;
}

export interface NavigationGroup {
  label: string;
  links: readonly NavigationLink[];
}

export interface NavigationMenu {
  id: NavigationMenuId;
  label: string;
  groups: readonly NavigationGroup[];
}

export interface NavigationContext {
  menuId: NavigationMenuId | null;
  title: string;
}

export const navigationMenus: readonly NavigationMenu[] = [
  {
    id: 'ledger',
    label: 'Ledger',
    groups: [
      {
        label: 'Ledger',
        links: [
          { label: 'Home', to: '/' },
          { label: 'Updates', to: '/updates' },
          { label: 'Contracts', to: '/contracts' },
        ],
      },
      {
        label: 'Assets',
        links: [
          { label: 'Tokens', to: '/tokens' },
          { label: 'Canton Coin', to: '/canton-coin' },
        ],
      },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    groups: [
      {
        label: 'Network',
        links: [
          { label: 'Nodes', to: '/nodes' },
          { label: 'Parties', to: '/parties' },
        ],
      },
      {
        label: 'Traffic',
        links: [{ label: 'Traffic Purchases', to: '/traffic' }],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    groups: [
      {
        label: 'Tools',
        links: [
          { label: 'Debugger', to: '/debugger' },
          { label: 'Settings', to: '/settings' },
        ],
      },
    ],
  },
];

interface NavigationRouteRule {
  matches: (path: string) => boolean;
  context: NavigationContext;
}

function matchesPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

const navigationRouteRules: readonly NavigationRouteRule[] = [
  { matches: (path) => path === '/', context: { menuId: 'ledger', title: 'Home' } },
  {
    matches: (path) => /^\/nodes\/[^/]+\/updates(?:\/|$)/.test(path),
    context: { menuId: 'ledger', title: 'Updates' },
  },
  {
    matches: (path) => /^\/nodes\/[^/]+\/contracts(?:\/|$)/.test(path),
    context: { menuId: 'ledger', title: 'Contracts' },
  },
  { matches: (path) => matchesPath(path, '/tokens'), context: { menuId: 'ledger', title: 'Tokens' } },
  {
    matches: (path) => matchesPath(path, '/packages') || matchesPath(path, '/namespaces'),
    context: { menuId: 'ledger', title: 'Contracts' },
  },
  { matches: (path) => matchesPath(path, '/tx'), context: { menuId: 'ledger', title: 'Updates' } },
  { matches: (path) => matchesPath(path, '/search'), context: { menuId: 'ledger', title: 'Search' } },
  { matches: (path) => matchesPath(path, '/updates'), context: { menuId: 'ledger', title: 'Updates' } },
  { matches: (path) => matchesPath(path, '/contracts'), context: { menuId: 'ledger', title: 'Contracts' } },
  {
    matches: (path) => matchesPath(path, '/canton-coin'),
    context: { menuId: 'ledger', title: 'Canton Coin' },
  },
  { matches: (path) => matchesPath(path, '/nodes'), context: { menuId: 'network', title: 'Nodes' } },
  { matches: (path) => matchesPath(path, '/parties'), context: { menuId: 'network', title: 'Parties' } },
  {
    matches: (path) => matchesPath(path, '/traffic'),
    context: { menuId: 'network', title: 'Traffic Purchases' },
  },
  { matches: (path) => matchesPath(path, '/debugger'), context: { menuId: 'system', title: 'Debugger' } },
  { matches: (path) => matchesPath(path, '/settings'), context: { menuId: 'system', title: 'Settings' } },
];

export function resolveNavigationContext(path: string): NavigationContext {
  return (
    navigationRouteRules.find((rule) => rule.matches(path))?.context ?? {
      menuId: null,
      title: 'Explore',
    }
  );
}
