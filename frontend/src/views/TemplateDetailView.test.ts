import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TemplateDetailView from './TemplateDetailView.vue';
import { fetchPackageTemplate } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchPackageTemplate: vi.fn(),
}));

describe('TemplateDetailView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the template heading while loading', () => {
    vi.mocked(fetchPackageTemplate).mockReturnValue(new Promise(() => undefined));

    render(TemplateDetailView, {
      props: {
        packageId: 'pkg',
        templateId: 'Main.Module:Asset',
      },
    });

    expect(screen.getByRole('heading', { name: 'Main.Module:Asset' })).toBeInTheDocument();
    expect(screen.getByText('Loading template...')).toBeInTheDocument();
  });

  it('renders template metadata and create data schema', async () => {
    vi.mocked(fetchPackageTemplate).mockResolvedValue({
      packageId: 'pkg',
      name: 'Main Package',
      version: '1.2.3',
      uploadedAt: null,
      packageSize: 1024,
      status: 'decoded',
      template: {
        templateId: 'Main.Module:Asset',
        moduleName: 'Main.Module',
        entityName: 'Asset',
        createType: {
          kind: 'record',
          label: 'Main.Module:Asset',
          fields: [
            {
              name: 'owner',
              type: { kind: 'builtin', label: 'Party' },
            },
          ],
        },
        choices: [],
      },
    });

    render(TemplateDetailView, {
      props: {
        packageId: 'pkg',
        templateId: 'Main.Module:Asset',
      },
    });

    expect(await screen.findByText('Main Package')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('Main.Module')).toBeInTheDocument();
    expect(screen.getByText('Asset')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('No choices are available for this template.')).toBeInTheDocument();
  });

  it('renders consuming and non-consuming choices with their schemas', async () => {
    vi.mocked(fetchPackageTemplate).mockResolvedValue({
      packageId: 'pkg',
      name: 'Main Package',
      version: '1.2.3',
      uploadedAt: null,
      packageSize: 1024,
      status: 'decoded',
      template: {
        templateId: 'Main.Module:Asset',
        moduleName: 'Main.Module',
        entityName: 'Asset',
        createType: {
          kind: 'record',
          label: 'Main.Module:Asset',
          fields: [],
        },
        choices: [
          {
            name: 'Archive',
            consuming: true,
            argumentType: {
              kind: 'record',
              label: 'Main.Module:ArchiveArgument',
              fields: [
                {
                  name: 'reason',
                  type: { kind: 'builtin', label: 'Text' },
                },
              ],
            },
            resultType: { kind: 'builtin', label: 'Unit' },
          },
          {
            name: 'Notify',
            consuming: false,
            argumentType: null,
            resultType: null,
          },
        ],
      },
    });

    render(TemplateDetailView, {
      props: {
        packageId: 'pkg',
        templateId: 'Main.Module:Asset',
      },
    });

    expect(await screen.findByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Notify')).toBeInTheDocument();
    expect(screen.getByText('Consuming')).toBeInTheDocument();
    expect(screen.getByText('Non-Consuming')).toBeInTheDocument();
    expect(screen.getAllByText('Argument', { exact: true })).toHaveLength(2);
    expect(screen.getAllByText('Result', { exact: true })).toHaveLength(2);
    expect(screen.getByText('Main.Module:ArchiveArgument')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Argument type is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Result type is unavailable.')).toBeInTheDocument();
  });
});
