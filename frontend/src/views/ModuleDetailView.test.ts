import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModuleDetailView from './ModuleDetailView.vue';
import { fetchPackageModule } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchPackageModule: vi.fn(),
}));

describe('ModuleDetailView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders module loading state while the module request is pending', () => {
    vi.mocked(fetchPackageModule).mockReturnValue(new Promise(() => undefined));

    render(ModuleDetailView, {
      props: {
        packageId: 'pkg',
        moduleName: 'Main.Module',
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

    expect(screen.getByRole('heading', { name: 'Main.Module' })).toBeInTheDocument();
    expect(screen.getByText('Loading module...')).toBeInTheDocument();
  });

  it('renders package metadata and the module templates and data types', async () => {
    vi.mocked(fetchPackageModule).mockResolvedValue({
      packageId: 'pkg',
      name: 'Main Package',
      version: '1.2.3',
      uploadedAt: null,
      packageSize: 1024,
      status: 'decoded',
      moduleName: 'Main.Module',
      templates: [
        {
          templateId: 'Main.Module:Asset',
          moduleName: 'Main.Module',
          entityName: 'Asset',
          createType: null,
          choices: [],
        },
      ],
      dataTypes: [
        {
          typeId: 'Main.Module:AssetData',
          moduleName: 'Main.Module',
          entityName: 'AssetData',
          definition: null,
        },
      ],
    });

    render(ModuleDetailView, {
      props: {
        packageId: 'pkg',
        moduleName: 'Main.Module',
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

    expect(await screen.findByText('Main Package')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    expect(screen.getByText('Main.Module:Asset')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Data Types' })).toBeInTheDocument();
    expect(screen.getByText('Main.Module:AssetData')).toBeInTheDocument();
    expect(
      document.querySelector('a[href="/packages/pkg/templates/Main.Module%3AAsset"]'),
    ).not.toBeNull();
  });
});
