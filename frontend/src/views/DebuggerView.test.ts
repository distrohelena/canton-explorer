import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent } from 'vue';
import DebuggerView from './DebuggerView.vue';
import { createDebuggerSession, fetchDebuggerEvents } from '../lib/api';

vi.mock('../components/MonacoCodeSurface.vue', () => ({
  default: defineComponent({
    props: {
      modelValue: {
        type: String,
        required: true,
      },
    },
    template: '<div data-testid="monaco-stub">{{ modelValue }}</div>',
  }),
}));

vi.mock('../lib/api', () => ({
  createDebuggerSession: vi.fn(),
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
      ],
    });

    router.push(path);
    await router.isReady();

    return render(
      {
        template: '<RouterView />',
      },
      {
        global: {
          plugins: [router],
        },
      },
    );
  }

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

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    expect(await screen.findByRole('heading', { name: 'Launch Context' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'DAML Debugger' })).not.toBeInTheDocument();
    expect(screen.getAllByText('cnqs-sv').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getByText('205')).toBeInTheDocument();
    expect(screen.getAllByText('1 / 12').length).toBeGreaterThan(0);
    expect(screen.getByText('Execution Script')).toBeInTheDocument();
    expect(screen.getByText('Main.daml')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-editor-shell')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-editor-shell')).toContainElement(screen.getByTestId('monaco-stub'));
    expect(screen.getByRole('button', { name: 'Step Into' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step Over' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step Out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByTestId('debugger-summary')).toContainElement(screen.getByRole('button', { name: 'Step Into' }));
    expect(screen.getByText('In-Scope Variables')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('Ledger Events')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Real Events' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Replay Events' })).toBeInTheDocument();
    expect(screen.getByText(/Vault\.Archive/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to overview' })).not.toBeInTheDocument();
  });
});
