import { render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PackageFamilyView from './PackageFamilyView.vue';
import { fetchPackagesByName } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchPackagesByName: vi.fn(),
}));

describe('PackageFamilyView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state before the package family resolves', () => {
    vi.mocked(fetchPackagesByName).mockReturnValue(new Promise(() => undefined));

    render(PackageFamilyView, {
      props: {
        packageName: 'splice-amulet',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(screen.getByText('Loading package family...')).toBeInTheDocument();
  });

  it('renders all known package versions for a package name', async () => {
    vi.mocked(fetchPackagesByName).mockResolvedValue({
      name: 'splice-amulet',
      packages: [
        {
          packageId: 'splice-amulet-v2',
          name: 'splice-amulet',
          version: '0.1.24',
          uploadedAt: '2026-07-02T12:00:00.000Z',
          packageSize: 960436,
        },
        {
          packageId: 'splice-amulet-v1',
          name: 'splice-amulet',
          version: '0.1.14',
          uploadedAt: '2026-07-01T12:00:00.000Z',
          packageSize: 950000,
        },
      ],
    });

    const formatMock = vi
      .fn()
      .mockReturnValueOnce('Jul 2, 2026')
      .mockReturnValueOnce('12:00:00 PM')
      .mockReturnValueOnce('Jul 1, 2026')
      .mockReturnValueOnce('12:00:00 PM');
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      function MockDateTimeFormat() {
        return {
          format: formatMock,
        } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat,
    );

    const { container } = render(PackageFamilyView, {
      props: {
        packageName: 'splice-amulet',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'splice-amulet Packages' })).toBeInTheDocument();
    expect(screen.getByText('Known versions of splice-amulet')).toBeInTheDocument();
    expect(screen.getByText('splice-amulet-v2')).toBeInTheDocument();
    expect(screen.getByText('0.1.24')).toBeInTheDocument();
    expect(screen.getByText('960,436 bytes')).toBeInTheDocument();
    expect(screen.getByText('splice-amulet-v1')).toBeInTheDocument();
    expect(screen.getByText('0.1.14')).toBeInTheDocument();
    expect(screen.getByText('950,000 bytes')).toBeInTheDocument();
    expect(screen.getAllByText('Jul 2, 2026')).toHaveLength(1);
    expect(screen.getAllByText('Jul 1, 2026')).toHaveLength(1);
    expect(container.querySelector('a[href="/packages/splice-amulet-v2"]')).not.toBeNull();
    expect(container.querySelector('a[href="/packages/splice-amulet-v1"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');
  });
});
