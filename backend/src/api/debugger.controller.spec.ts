import { BadRequestException } from '@nestjs/common';
import { DebuggerController } from './debugger.controller';

describe('DebuggerController', () => {
  function createController() {
    const debuggerService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      listEvents: jest.fn(),
      stepBack: jest.fn(),
      stepInto: jest.fn(),
      stepOver: jest.fn(),
      stepOut: jest.fn(),
      continue: jest.fn(),
      jumpToStep: jest.fn(),
      disposeSession: jest.fn(),
    };

    return {
      controller: new DebuggerController(debuggerService as never),
      debuggerService,
    };
  }

  it('routes the step-back debugger action', () => {
    const { controller, debuggerService } = createController();

    controller.actOnSession('session-1', 'step-back');

    expect(debuggerService.stepBack).toHaveBeenCalledWith('session-1');
  });

  it('routes the event list request', () => {
    const { controller, debuggerService } = createController();

    controller.listEvents('session-1');

    expect(debuggerService.listEvents).toHaveBeenCalledWith('session-1');
  });

  it('routes explicit step selection by step id', () => {
    const { controller, debuggerService } = createController();

    controller.selectStep('session-1', 'step-2');

    expect(debuggerService.jumpToStep).toHaveBeenCalledWith('session-1', 'step-2');
  });

  it('rejects unsupported debugger actions', () => {
    const { controller } = createController();

    expect(() => controller.actOnSession('session-1', 'rewind-all')).toThrow(
      BadRequestException,
    );
  });
});
