import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import DebuggerEventList from './DebuggerEventList.vue';

describe('DebuggerEventList', () => {
  it('renders ledger events and emits the selected step id', async () => {
    const { emitted } = render(DebuggerEventList, {
      props: {
        currentStepId: 'step-1',
        realEvents: [
          {
            stepId: 'step-1',
            stepIndex: 1,
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
              startLine: 869,
              startColumn: 1,
              endLine: 869,
              endColumn: 18,
            },
          },
          {
            stepId: 'step-5',
            stepIndex: 5,
            phase: 'stateEffect',
            kind: 'create',
            eventOrdinal: 1,
            comparisonKey: 'event-1',
            createdContractId: 'created-1',
            targetContractId: null,
            templateId: {
              packageId: 'pkg-main',
              moduleName: 'Main',
              entityName: 'Audit',
            },
            choice: null,
            choiceArgument: null,
            payload: {
              owner: 'Alice',
            },
            consuming: null,
            sourceLocation: {
              path: 'Main.daml',
              startLine: 900,
              startColumn: 1,
              endLine: 900,
              endColumn: 18,
            },
          },
        ],
        replayEvents: [
          {
            stepId: 'step-1',
            stepIndex: 1,
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
              startLine: 869,
              startColumn: 1,
              endLine: 869,
              endColumn: 18,
            },
          },
        ],
      },
    });

    expect(screen.getByText('Ledger Events')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Real Events' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Replay Events' })).toBeInTheDocument();
    expect(screen.getByText(/Vault\.Archive/)).toBeInTheDocument();
    expect(screen.getByText(/Audit/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('tab', { name: 'Replay Events' }));
    expect(screen.getByText(/Vault\.Archive/)).toBeInTheDocument();
    expect(screen.queryByText(/Audit/)).not.toBeInTheDocument();

    await fireEvent.click(screen.getByTestId('debugger-event-1'));

    expect(screen.getByTestId('debugger-event-details-1')).toBeInTheDocument();
    expect(screen.getByText('Choice Argument')).toBeInTheDocument();
    expect(screen.getByText('Payload')).toBeInTheDocument();
    expect(screen.getByText('{}')).toBeInTheDocument();
    expect(emitted().selectStep).toBeUndefined();

    await fireEvent.click(screen.getByRole('tab', { name: 'Real Events' }));
    await fireEvent.click(screen.getByTestId('real-debugger-event-1'));

    expect(emitted().selectStep).toEqual([['step-1']]);
  });
});
