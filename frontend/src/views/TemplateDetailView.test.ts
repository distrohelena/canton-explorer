import { cleanup, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import TemplateDetailView from './TemplateDetailView.vue';
import { fetchPackageTemplate } from '../lib/api';
import type { PackageInterfaceChoice } from '../types/packages';

vi.mock('../lib/api', () => ({
  fetchPackageTemplate: vi.fn(),
}));

const route = reactive({ hash: '' });

vi.mock('vue-router', () => ({
  useRoute: () => route,
}));

function mockDecodedTemplate(choices: PackageInterfaceChoice[]) {
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
      createType: null,
      choices,
    },
  });
}

function renderChoices() {
  mockDecodedTemplate([
    {
      name: 'A Choice/With:Symbols',
      consuming: true,
      argumentType: null,
      resultType: null,
    },
    {
      name: 'Notify',
      consuming: false,
      argumentType: null,
      resultType: null,
    },
  ]);

  return render(TemplateDetailView, {
    props: {
      packageId: 'pkg',
      templateId: 'Main.Module:Asset',
    },
  });
}

function mockScrollIntoView() {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  return scrollIntoView;
}

describe('TemplateDetailView', () => {
  afterEach(() => {
    cleanup();
    route.hash = '';
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

  it('assigns encoded anchor IDs to choice rows', async () => {
    renderChoices();

    const choice = await screen.findByText('A Choice/With:Symbols');

    expect(choice.closest('.package-detail__list-row')).toHaveAttribute(
      'id',
      'choice-A%20Choice%2FWith%3ASymbols',
    );
  });

  it('scrolls to a matching choice after the template loads', async () => {
    route.hash = '#choice-A Choice/With:Symbols';
    const scrollIntoView = mockScrollIntoView();

    renderChoices();

    await screen.findByText('A Choice/With:Symbols');

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('scrolls to another choice when the route hash changes', async () => {
    const { container } = renderChoices();

    await screen.findByText('Notify');
    const notifyRow = container.querySelector(
      '#choice-Notify',
    );
    if (!notifyRow) {
      throw new Error('Expected the Notify choice row to render');
    }

    const scrollIntoView = vi.fn();
    Object.defineProperty(notifyRow, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    route.hash = '#choice-Notify';

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
  });

  it.each(['', '#choice-Missing', '#other-Archive', '#choice-Incomplete%'])(
    'does not scroll for an invalid or missing hash %j',
    async (hash) => {
      route.hash = hash;
      const scrollIntoView = mockScrollIntoView();

      renderChoices();

      await screen.findByText('A Choice/With:Symbols');
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(0));
    },
  );
});
