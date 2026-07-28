import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent } from 'vue';
import DebuggerView from './DebuggerView.vue';
import {
  createDebuggerSession,
  fetchDebuggerSessions,
  fetchNodeContracts,
  fetchNodeTemplates,
  fetchNodes,
  fetchDebuggerEvents,
  fetchDebuggerSession,
  jumpDebuggerSessionToStep,
  stepDebuggerSession,
} from '../lib/api';

vi.mock('../components/MonacoCodeSurface.vue', () => ({
  default: defineComponent({
    props: {
      modelValue: {
        type: String,
        required: true,
      },
      language: {
        type: String,
        default: 'plaintext',
      },
      hoverVariables: {
        type: Array,
        default: () => [],
      },
    },
    template:
      '<div data-testid="monaco-stub" :data-language="language" :data-hover-count="hoverVariables.length" :data-hover-json="JSON.stringify(hoverVariables)">{{ modelValue }}</div>',
  }),
}));

vi.mock('../lib/api', () => ({
  createDebuggerSession: vi.fn(),
  fetchDebuggerSessions: vi.fn(),
  fetchNodeContracts: vi.fn(),
  fetchNodeTemplates: vi.fn(),
  fetchNodes: vi.fn(),
  fetchDebuggerSession: vi.fn(),
  fetchDebuggerEvents: vi.fn(),
  jumpDebuggerSessionToStep: vi.fn(),
  stepDebuggerSession: vi.fn(),
}));

describe('DebuggerView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function renderAt(path: string) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/debugger', component: DebuggerView },
        { path: '/nodes/:nodeId/updates/:offset', component: { template: '<div>Update detail</div>' } },
      ],
    });

    router.push(path);
    await router.isReady();

    const rendered = render(
      {
        template: '<RouterView />',
      },
      {
        global: {
          plugins: [router],
        },
      },
    );

    return {
      ...rendered,
      router,
    };
  }

  it('opens a full-screen template search from the combobox', async () => {
    vi.mocked(fetchDebuggerSessions).mockResolvedValue([]);
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_with_grpc',
      },
      {
        id: 'participant-2',
        label: 'Participant 2',
        role: 'participant',
        mode: 'pqs_only',
      },
    ] as never);
    vi.mocked(fetchNodeTemplates).mockImplementation(async (nodeId) => ({
      templates:
        nodeId === 'participant-1'
          ? [{ templateId: 'Main:Asset' }, { templateId: 'Main:Wallet' }]
          : [{ templateId: 'Other:Holding' }],
    }));

    await renderAt('/debugger');

    expect(await screen.findByRole('heading', { name: 'Debugger' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'New Simulation' }));
    expect(screen.getByRole('heading', { name: 'Choose simulation' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Create / })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Exercise New/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Exercise Existing/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select a node' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose a template' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('option', { name: /Exercise New/ }));
    expect(screen.getByRole('heading', { name: 'Choose template to create' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Participant 1.*PQS \+ gRPC/s })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Participant 2.*PQS only/s })).toBeInTheDocument();

    await fireEvent.click(await screen.findByRole('option', { name: /Participant 1.*PQS \+ gRPC/s }));
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toBeInTheDocument();
    expect(screen.getByText('Main:Asset')).toBeInTheDocument();
    expect(screen.getByText('Main:Wallet')).toBeInTheDocument();
    expect(screen.queryByText('Other:Holding')).not.toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Search templates' });
    await fireEvent.update(search, 'wallet');
    expect(screen.getByText('Main:Wallet')).toBeInTheDocument();
    expect(screen.queryByText('Main:Asset')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('option', { name: /Main:Wallet.*Participant 1/s }));

    expect(screen.getByTestId('debugger-template-picker-selection')).toHaveTextContent('Exercise New');
    expect(screen.getByTestId('debugger-template-picker-selection')).toHaveTextContent('Main:Wallet');

    expect(fetchNodeTemplates).toHaveBeenCalledWith('participant-1');
    expect(fetchNodeTemplates).toHaveBeenCalledWith('participant-2');
    expect(createDebuggerSession).not.toHaveBeenCalled();
  });

  it('lists previously started sessions and opens a selected session', async () => {
    vi.mocked(fetchDebuggerSessions).mockResolvedValue([
      {
        sessionId: 'session-1',
        nodeId: 'participant-1',
        updateId: 'update-1',
        offset: '42',
        stepCount: 12,
        currentStepIndex: 3,
        isTerminal: false,
        createdAt: '2026-07-22T12:00:00Z',
      },
    ]);

    const { router } = await renderAt('/debugger');

    expect(await screen.findByRole('heading', { name: 'Debug Sessions' })).toBeInTheDocument();
    expect(screen.getByText('session-1')).toBeInTheDocument();
    expect(screen.getByText('participant-1')).toBeInTheDocument();
    expect(screen.getByText('4 / 12')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Open session session-1' }));

    await waitFor(() => expect(router.currentRoute.value.query.sessionId).toBe('session-1'));
    expect(router.currentRoute.value.query.updateId).toBe('update-1');
    expect(router.currentRoute.value.query.nodeId).toBeUndefined();
    expect(router.currentRoute.value.query.eventOffset).toBeUndefined();
  });

  it('shows active contracts for Exercise Existing after the node is selected', async () => {
    vi.mocked(fetchDebuggerSessions).mockResolvedValue([]);
    vi.mocked(fetchNodes).mockResolvedValue([
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        mode: 'pqs_with_grpc',
      },
    ] as never);
    vi.mocked(fetchNodeTemplates).mockResolvedValue({
      templates: [{ templateId: 'Main:Asset' }],
    });
    vi.mocked(fetchNodeContracts).mockResolvedValue({
      nodeId: 'participant-1',
      label: 'Participant 1',
      limit: 100,
      nextBefore: null,
      nextAfter: null,
      contracts: [
        {
          contractId: '00active',
          templateId: 'Main:Asset',
          createdRecordTime: '2026-07-22T12:00:00Z',
        },
      ],
    });

    await renderAt('/debugger');
    await fireEvent.click(screen.getByRole('button', { name: 'New Simulation' }));

    await fireEvent.click(screen.getByRole('option', { name: /Exercise Existing/ }));
    await fireEvent.click(await screen.findByRole('option', { name: /Participant 1.*PQS \+ gRPC/s }));

    expect(await screen.findByRole('heading', { name: 'Select active contract' })).toBeInTheDocument();
    const contract = await screen.findByRole('option', { name: /00active.*Main:Asset/s });
    expect(contract).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Search templates' })).not.toBeInTheDocument();

    await fireEvent.click(contract);

    expect(screen.getByTestId('debugger-template-picker-selection')).toHaveTextContent('Exercise Existing');
    expect(screen.getByTestId('debugger-template-picker-selection')).toHaveTextContent('00active');
    expect(fetchNodeContracts).toHaveBeenCalledWith('participant-1', { limit: 100 });
  });

  it('renders the debugger shell with route-driven launch context', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
                contractType: null,
              },
            ],
          },
        ],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'Main.daml',
          startLine: 10,
          startColumn: 1,
          endLine: 12,
          endColumn: 20,
        },
        valuePreview: null,
        stateDelta: {
          kind: 'exercise',
          eventOrdinal: 0,
          comparisonKey: 'event-0',
          createdContractId: null,
          targetContractId: '00abc',
          templateId: {
            packageId: 'pkg-main',
            moduleName: 'Main',
            entityName: 'Vault',
          },
          choice: 'Archive',
          choiceArgument: {},
          payload: null,
          consuming: null,
        },
      },
      source: {
        path: 'Main.daml',
        content: 'template Main where\n  signatory issuer\n',
        startLine: 10,
        startColumn: 1,
        endLine: 12,
        endColumn: 20,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-0',
      realEvents: [],
      replayEvents: [
        {
          stepId: 'step-0',
          stepIndex: 0,
          phase: 'stateEffect',
          kind: 'exercise',
          eventOrdinal: 0,
          comparisonKey: 'event-0',
          createdContractId: null,
          targetContractId: '00abc',
          templateId: {
            packageId: 'pkg-main',
            moduleName: 'Main',
            entityName: 'Vault',
          },
          choice: 'Archive',
          choiceArgument: {},
          payload: null,
          consuming: null,
          sourceLocation: {
            path: 'Main.daml',
            startLine: 10,
            startColumn: 1,
            endLine: 12,
            endColumn: 20,
          },
        },
      ],
    });

    const { router } = await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    expect(await screen.findByRole('heading', { name: 'Launch Context' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'DAML Debugger' })).not.toBeInTheDocument();
    expect(screen.getAllByText('cnqs-sv').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: '205' }),
    ).toHaveAttribute('href', '/nodes/cnqs-sv/updates/205');
    expect(
      screen.getByRole('link', { name: '205' }),
    ).toHaveAttribute('target', '_blank');
    expect(
      screen.getByRole('link', { name: '42' }),
    ).toHaveAttribute('href', '/nodes/cnqs-sv/updates/205');
    expect(
      screen.getByRole('link', { name: '42' }),
    ).toHaveAttribute('target', '_blank');
    expect(screen.getAllByText('1 / 12').length).toBeGreaterThan(0);
    expect(screen.getByText('Execution Script')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Main.daml' })).toBeInTheDocument();
    expect(screen.getByTestId('debugger-editor-shell')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-editor-shell')).toContainElement(screen.getByTestId('monaco-stub'));
    expect(screen.getByTestId('monaco-stub')).toHaveAttribute('data-language', 'daml');
    expect(screen.getByRole('tab', { name: 'Main.daml' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('debugger-editor-divider')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-floating-controls')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-summary-context')).toContainElement(
      screen.getByRole('heading', { name: 'Launch Context' }),
    );
    expect(screen.getByTestId('debugger-summary-context')).toContainElement(
      screen.getByRole('heading', { name: 'In-Scope Variables' }),
    );
    expect(screen.getByTestId('debugger-summary-events')).toContainElement(
      screen.getByRole('heading', { name: 'Ledger Events' }),
    );
    const controlPanel = screen.getByTestId('debugger-control-panel');
    expect(within(controlPanel).getByText('Step Into')).toBeInTheDocument();
    expect(within(controlPanel).getByText('Step Back')).toBeInTheDocument();
    expect(within(controlPanel).getByText('Step Over')).toBeInTheDocument();
    expect(within(controlPanel).getByText('Step Out')).toBeInTheDocument();
    expect(within(controlPanel).getByText('Continue')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-summary')).not.toContainElement(within(controlPanel).getByText('Step Into'));
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Real Events' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Replay Events' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to overview' })).not.toBeInTheDocument();
    await waitFor(() => expect(router.currentRoute.value.query.sessionId).toBe('session-1'));
    await waitFor(() => expect(router.currentRoute.value.query.stepId).toBe('step-0'));
    expect(router.currentRoute.value.query.nodeId).toBeUndefined();
    expect(router.currentRoute.value.query.eventOffset).toBeUndefined();
  });

  it('centers debugger launch errors without the generic error border', async () => {
    vi.mocked(createDebuggerSession).mockRejectedValue(
      new Error('Debug offset is not fully visible in any connected gRPC node.'),
    );

    await renderAt('/debugger?updateId=update-64');

    const error = await screen.findByText(
      'Debug offset is not fully visible in any connected gRPC node.',
    );

    expect(error).toHaveClass('debugger-view__error-state');
    expect(error).not.toHaveClass('node-detail__message--error');
  });

  it('centers the debugger loading state without the generic message border', async () => {
    vi.mocked(createDebuggerSession).mockImplementation(
      () => new Promise(() => {}),
    );

    await renderAt('/debugger?updateId=update-64');

    const loading = await screen.findByText('Loading debugger session...');

    expect(loading).toHaveClass('debugger-view__loading-state');
    expect(loading).not.toHaveClass('node-detail__message');
  });

  it('opens stepped-into source files as persistent editor tabs', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'Main.daml',
          startLine: 10,
          startColumn: 1,
          endLine: 12,
          endColumn: 20,
        },
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'Main.daml',
        content: 'template Main where\n  signatory issuer\n',
        startLine: 10,
        startColumn: 1,
        endLine: 12,
        endColumn: 20,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-0',
      realEvents: [],
      replayEvents: [],
    });
    vi.mocked(stepDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 1,
      isTerminal: false,
      currentStep: {
        stepId: 'step-1',
        stepIndex: 1,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'Vault.daml',
          startLine: 30,
          startColumn: 1,
          endLine: 36,
          endColumn: 18,
        },
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'Vault.daml',
        content: 'choice Archive : ()\n  controller owner\n  do pure ()\n',
        startLine: 30,
        startColumn: 1,
        endLine: 36,
        endColumn: 18,
      },
    });

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    expect(screen.getByRole('tab', { name: 'Main.daml' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('monaco-stub')).toHaveTextContent('template Main where');

    await fireEvent.click(screen.getByText('Step Into'));

    expect(screen.getByRole('tab', { name: 'Main.daml' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vault.daml' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('monaco-stub')).toHaveTextContent('choice Archive : ()');

    await fireEvent.click(screen.getByRole('tab', { name: 'Main.daml' }));

    expect(screen.getByRole('tab', { name: 'Main.daml' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Vault.daml' })).toBeInTheDocument();
    expect(screen.getByTestId('monaco-stub')).toHaveTextContent('template Main where');
  });

  it('passes only proven scoped variables for the active source hovers', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
                contractType: null,
                sourceLocation: {
                  path: 'daml\\Main.daml',
                  startLine: 2,
                  startColumn: 12,
                  endLine: 2,
                  endColumn: 17,
                },
              },
              {
                name: 'owner',
                kind: 'text',
                value: 'Bob',
                contractType: null,
              },
              {
                name: 'issuer',
                kind: 'text',
                value: 'Issuer',
                contractType: null,
                sourceLocation: {
                  path: 'daml\\Main.daml',
                  startLine: 3,
                  startColumn: null,
                  endLine: 3,
                  endColumn: 18,
                },
              },
              {
                name: 'observer',
                kind: 'text',
                value: 'Observer',
                contractType: null,
                sourceLocation: {
                  path: 'daml\\Other.daml',
                  startLine: 4,
                  startColumn: 5,
                  endLine: 4,
                  endColumn: 13,
                },
              },
              {
                name: 'controller',
                kind: 'text',
                value: null,
                contractType: null,
                sourceLocation: {
                  path: 'daml\\Main.daml',
                  startLine: 5,
                  startColumn: 3,
                  endLine: 5,
                  endColumn: 13,
                },
              },
            ],
          },
        ],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'daml/Main.daml',
          startLine: 1,
          startColumn: 1,
          endLine: 6,
          endColumn: 1,
        },
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'daml/Main.daml',
        content: 'template Main where\n  signatory owner\n  observer issuer\n',
        startLine: 1,
        startColumn: 1,
        endLine: 6,
        endColumn: 1,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-0',
      realEvents: [],
      replayEvents: [],
    });

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    expect(await screen.findByTestId('monaco-stub')).toHaveAttribute('data-hover-count', '1');
  });

  it('falls back to the exact current-step identifier when variable ranges are unavailable', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
                contractType: null,
                sourceLocation: null,
              },
              {
                name: 'issuer',
                kind: 'text',
                value: 'Issuer',
                contractType: null,
                sourceLocation: null,
              },
            ],
          },
        ],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'daml/Main.daml',
          startLine: 2,
          startColumn: 13,
          endLine: 2,
          endColumn: 18,
          precision: 'exact',
        },
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'daml/Main.daml',
        content: 'template Main where\n  signatory owner\n',
        startLine: 1,
        startColumn: 1,
        endLine: 2,
        endColumn: 18,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-0',
      realEvents: [],
      replayEvents: [],
    });

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    expect(await screen.findByTestId('monaco-stub')).toHaveAttribute('data-hover-count', '1');
  });

  it('derives all proven parameter hovers from the current DAML function', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 2,
      isTerminal: false,
      currentStep: {
        stepId: 'step-110',
        stepIndex: 2,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'args',
                kind: 'ledgerValue',
                value: 'BaseDepositArgs',
                contractType: null,
                sourceLocation: null,
              },
              {
                name: 'operation',
                kind: 'text',
                value: 'should-not-hover',
                contractType: null,
                sourceLocation: null,
              },
            ],
          },
        ],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'daml/Oz/Vault/Base/Core.daml',
          startLine: 4,
          startColumn: 44,
          endLine: 4,
          endColumn: 58,
          precision: 'exact',
        },
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'daml/Oz/Vault/Base/Core.daml',
        content: [
          '-- helper',
          '',
          'executeBaseDepositLike vaultIdentity vaultParty assetInstrumentId shareTokenCid virtualAssets virtualShares name symbol args = do',
          '  validateBaseOperationPositiveAmount args.operation args.amount',
        ].join('\n'),
        startLine: 4,
        startColumn: 44,
        endLine: 4,
        endColumn: 58,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-110',
      realEvents: [],
      replayEvents: [],
    });

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    const monacoStub = await screen.findByTestId('monaco-stub');
    expect(monacoStub).toHaveAttribute('data-hover-count', '3');
    expect(monacoStub).toHaveAttribute(
      'data-hover-json',
      JSON.stringify([
        {
          name: 'args',
          kind: 'ledgerValue',
          value: 'BaseDepositArgs',
          contractType: null,
          range: {
            startLine: 3,
            startColumn: 121,
            endLine: 3,
            endColumn: 125,
          },
        },
        {
          name: 'args',
          kind: 'ledgerValue',
          value: 'BaseDepositArgs',
          contractType: null,
          range: {
            startLine: 4,
            startColumn: 39,
            endLine: 4,
            endColumn: 43,
          },
        },
        {
          name: 'args',
          kind: 'ledgerValue',
          value: 'BaseDepositArgs',
          contractType: null,
          range: {
            startLine: 4,
            startColumn: 54,
            endLine: 4,
            endColumn: 58,
          },
        },
      ]),
    );
  });

  it('lets the user resize the editor panel with the splitter keyboard controls', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: null,
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'Main.daml',
        content: 'template Main where\n  signatory issuer\n',
        startLine: 10,
        startColumn: 1,
        endLine: 12,
        endColumn: 20,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-0',
      realEvents: [],
      replayEvents: [],
    });

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    const workspace = await screen.findByTestId('debugger-workspace');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(workspace, 'clientWidth', {
      configurable: true,
      value: 1200,
    });

    const divider = screen.getByTestId('debugger-editor-divider');

    await fireEvent.keyDown(divider, { key: 'ArrowRight' });

    expect(workspace.getAttribute('style')).toContain('grid-template-columns: 760px 14px minmax(320px, 1fr);');

    await fireEvent.keyDown(divider, { key: 'ArrowLeft' });

    expect(workspace.getAttribute('style')).toContain('grid-template-columns: 712px 14px minmax(320px, 1fr);');
  });

  it('lets the user drag the floating control panel within the workspace', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: null,
        valuePreview: null,
        stateDelta: null,
      },
      source: {
        path: 'Main.daml',
        content: 'template Main where\n  signatory issuer\n',
        startLine: 10,
        startColumn: 1,
        endLine: 12,
        endColumn: 20,
      },
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-0',
      realEvents: [],
      replayEvents: [],
    });

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    const workspace = await screen.findByTestId('debugger-workspace');
    const floatingControls = screen.getByTestId('debugger-floating-controls');
    const handle = screen.getByTestId('debugger-control-panel-handle');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(workspace, 'clientWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(workspace, 'clientHeight', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(floatingControls, 'offsetWidth', {
      configurable: true,
      value: 420,
    });
    Object.defineProperty(floatingControls, 'offsetHeight', {
      configurable: true,
      value: 108,
    });
    Object.defineProperty(workspace, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 100,
        top: 50,
        right: 1300,
        bottom: 850,
        width: 1200,
        height: 800,
        x: 100,
        y: 50,
        toJSON: () => '',
      }),
    });
    Object.defineProperty(floatingControls, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 320,
        top: 74,
        right: 740,
        bottom: 182,
        width: 420,
        height: 108,
        x: 320,
        y: 74,
        toJSON: () => '',
      }),
    });

    await fireEvent.pointerDown(handle, {
      pointerId: 1,
      clientX: 360,
      clientY: 90,
    });
    await fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 560,
      clientY: 180,
    });

    expect(floatingControls.getAttribute('style')).toContain('left: 420px; top: 114px;');

    await fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 560,
      clientY: 180,
    });
  });

  it('restores a debugger session and selected step from the route query', async () => {
    vi.mocked(fetchDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: null,
        valuePreview: null,
        stateDelta: null,
      },
      source: null,
    });
    vi.mocked(jumpDebuggerSessionToStep).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 7,
      isTerminal: false,
      currentStep: {
        stepId: 'step-7',
        stepIndex: 7,
        phase: 'stateEffect',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: null,
        valuePreview: null,
        stateDelta: null,
      },
      source: null,
    });
    vi.mocked(fetchDebuggerEvents).mockResolvedValue({
      sessionId: 'session-1',
      currentStepId: 'step-7',
      realEvents: [],
      replayEvents: [],
    });

    const { router } = await renderAt(
      '/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205&sessionId=session-1&stepId=step-7',
    );

    expect((await screen.findAllByText('8 / 12')).length).toBeGreaterThan(0);
    await waitFor(() => expect(fetchDebuggerSession).toHaveBeenCalledWith('session-1'));
    await waitFor(() => expect(jumpDebuggerSessionToStep).toHaveBeenCalledWith('session-1', 'step-7'));
    await waitFor(() => expect(router.currentRoute.value.query.sessionId).toBe('session-1'));
    await waitFor(() => expect(router.currentRoute.value.query.stepId).toBe('step-7'));
  });

  it('updates the route query when the current debugger step changes', async () => {
    vi.mocked(createDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 0,
      isTerminal: false,
      currentStep: {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: null,
        valuePreview: null,
        stateDelta: null,
      },
      source: null,
    });
    vi.mocked(stepDebuggerSession).mockResolvedValue({
      sessionId: 'session-1',
      nodeId: 'cnqs-sv',
      updateId: '42',
      offset: '205',
      stepCount: 12,
      currentStepIndex: 1,
      isTerminal: false,
      currentStep: {
        stepId: 'step-1',
        stepIndex: 1,
        phase: 'stateEffect',
        stackFrames: [],
        scopes: [],
        locals: [],
        arguments: [],
        sourceLocation: null,
        valuePreview: null,
        stateDelta: null,
      },
      source: null,
    });
    vi.mocked(fetchDebuggerEvents)
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        currentStepId: 'step-0',
        realEvents: [],
        replayEvents: [],
      })
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        currentStepId: 'step-1',
        realEvents: [],
        replayEvents: [],
      });

    const { router } = await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    await screen.findAllByText('1 / 12');
    await fireEvent.click(within(screen.getByTestId('debugger-control-panel')).getByText('Step Into'));

    await waitFor(() => expect(stepDebuggerSession).toHaveBeenCalledWith('session-1', 'step-into'));
    expect((await screen.findAllByText('2 / 12')).length).toBeGreaterThan(0);
    await waitFor(() => expect(router.currentRoute.value.query.sessionId).toBe('session-1'));
    await waitFor(() => expect(router.currentRoute.value.query.stepId).toBe('step-1'));
  });
});
