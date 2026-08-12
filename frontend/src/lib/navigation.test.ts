import { describe, expect, it } from 'vitest';
import { navigationMenus, resolveNavigationContext } from './navigation';

describe('navigation menus', () => {
  it('defines the three approved menus and their direct links', () => {
    expect(navigationMenus.map((menu) => menu.id)).toEqual(['ledger', 'network', 'system']);
    expect(navigationMenus.map((menu) => menu.label)).toEqual(['Ledger', 'Network', 'System']);
    expect(navigationMenus.map((menu) => menu.links)).toEqual([
      [
        { label: 'Home', to: '/' },
        { label: 'Updates', to: '/updates' },
        { label: 'Contracts', to: '/contracts' },
        { label: 'Tokens', to: '/tokens' },
        { label: 'Canton Coin', to: '/canton-coin' },
      ],
      [
        { label: 'Nodes', to: '/nodes' },
        { label: 'Parties', to: '/parties' },
        { label: 'Traffic Purchases', to: '/traffic' },
      ],
      [
        { label: 'Debugger', to: '/debugger' },
        { label: 'Settings', to: '/settings' },
      ],
    ]);
  });

  it.each([
    ['/', 'ledger', 'Home'],
    ['/updates', 'ledger', 'Updates'],
    ['/contracts', 'ledger', 'Contracts'],
    ['/tokens', 'ledger', 'Tokens'],
    ['/tokens/Amulet', 'ledger', 'Tokens'],
    ['/tokens/transfers/update-1', 'ledger', 'Tokens'],
    ['/canton-coin', 'ledger', 'Canton Coin'],
    ['/nodes', 'network', 'Nodes'],
    ['/nodes/participant-1', 'network', 'Nodes'],
    ['/parties', 'network', 'Parties'],
    ['/parties/party-1', 'network', 'Parties'],
    ['/traffic', 'network', 'Traffic Purchases'],
    ['/debugger', 'system', 'Debugger'],
    ['/settings', 'system', 'Settings'],
    ['/nodes/participant-1/updates/42', 'ledger', 'Updates'],
    ['/nodes/participant-1/contracts/00abc', 'ledger', 'Contracts'],
    ['/packages/pkg-1', 'ledger', 'Contracts'],
    ['/packages/by-name/com.example', 'ledger', 'Contracts'],
    ['/namespaces/ns-1', 'ledger', 'Contracts'],
    ['/tx/update-1', 'ledger', 'Updates'],
    ['/search', 'ledger', 'Search'],
  ])('resolves %s to %s/%s', (path, menuId, title) => {
    expect(resolveNavigationContext(path)).toEqual({ menuId, title });
  });

  it('falls back to Explore for an unknown route', () => {
    expect(resolveNavigationContext('/unknown')).toEqual({ menuId: null, title: 'Explore' });
  });
});
