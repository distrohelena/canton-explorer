import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
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
      language: {
        type: String,
        default: 'plaintext',
      },
    },
    template: '<div data-testid="monaco-stub" :data-language="language">{{ modelValue }}</div>',
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

    await renderAt('/debugger?nodeId=cnqs-sv&updateId=42&eventOffset=205');

    expect(await screen.findByRole('heading', { name: 'Launch Context' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'DAML Debugger' })).not.toBeInTheDocument();
    expect(screen.getAllByText('cnqs-sv').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getByText('205')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '42' }),
    ).toHaveAttribute('href', '/nodes/cnqs-sv/updates/205');
    expect(
      screen.getByRole('link', { name: '42' }),
    ).toHaveAttribute('target', '_blank');
    expect(screen.getAllByText('1 / 12').length).toBeGreaterThan(0);
    expect(screen.getByText('Execution Script')).toBeInTheDocument();
    expect(screen.getByText('Main.daml')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-editor-shell')).toBeInTheDocument();
    expect(screen.getByTestId('debugger-editor-shell')).toContainElement(screen.getByTestId('monaco-stub'));
    expect(screen.getByTestId('monaco-stub')).toHaveAttribute('data-language', 'daml');
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
    expect(screen.getByRole('button', { name: 'Step Into' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step Over' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step Out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByTestId('debugger-summary')).not.toContainElement(screen.getByRole('button', { name: 'Step Into' }));
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Real Events' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Replay Events' })).toBeInTheDocument();
    expect(screen.getByText(/Vault\.Archive/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to overview' })).not.toBeInTheDocument();
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
});
