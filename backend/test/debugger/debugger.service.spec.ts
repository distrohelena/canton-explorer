import { describe, expect, it } from '@jest/globals';
import {
  createSyntheticReplaySnapshot,
  flattenSyntheticCreateReplayExpression,
} from '../../src/debugger/debugger.service';

describe('createSyntheticReplaySnapshot', () => {
  it('builds a transaction snapshot for a simulated create entrypoint', () => {
    const argument = {
      kind: 'record',
      fields: [{ label: 'message', value: 'hello' }],
    };

    expect(createSyntheticReplaySnapshot({
      offset: 'simulation:abc',
      packageId: 'pkg-a',
      moduleName: 'DebugPlayground',
      entityName: 'Message',
      argument,
    })).toEqual({
      kind: 'transaction',
      offset: 'simulation:abc',
      updateId: undefined,
      actAs: [],
      readAs: [],
      events: [{
        event: {
          oneofKind: 'created',
          created: {
            contractId: '#simulationabc',
            templateId: {
              packageId: 'pkg-a',
              moduleName: 'DebugPlayground',
              entityName: 'Message',
            },
            createArguments: argument,
          },
        },
      }],
      entrypoint: {
        kind: 'create',
        templateId: {
          packageId: 'pkg-a',
          moduleName: 'DebugPlayground',
          entityName: 'Message',
        },
        argument,
      },
    });
  });
});

describe('flattenSyntheticCreateReplayExpression', () => {
  it('retains the innermost create body while binding the constructor argument', () => {
    const body = { updateExpression: { kind: 'create' } };
    const expression = {
      lambda: {
        parameters: ['_', 'this'],
        body: { lambda: { parameters: ['arg'], body } },
      },
    };

    expect(flattenSyntheticCreateReplayExpression(expression)).toEqual({
      lambda: { parameters: ['arg'], body },
    });
  });
});
