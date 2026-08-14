import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import DebuggerTemplatePicker from './DebuggerTemplatePicker.vue';

describe('DebuggerTemplatePicker', () => {
  afterEach(cleanup);

  it('keeps the template catalog retry local to the template panel', async () => {
    const { emitted } = render(DebuggerTemplatePicker, {
      props: {
        options: [],
        error: 'Template catalog unavailable',
        modelValue: {
          templateId: 'Main:Asset',
          packageId: 'pkg-a',
          packageName: null,
          packageVersion: null,
          nodeId: 'participant-1',
          nodeLabel: 'Participant 1',
          mode: 'pqs_with_grpc',
          simulationKind: 'create',
          contractId: null,
        },
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Retry templates' }));

    expect(emitted().retryTemplates).toEqual([[]]);
  });
});
