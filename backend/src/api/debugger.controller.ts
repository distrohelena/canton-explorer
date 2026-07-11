import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { DebuggerService } from '../debugger/debugger.service';

@Controller('/api/debugger')
export class DebuggerController {
  constructor(private readonly debuggerService: DebuggerService) {}

  @Post('/sessions')
  createSession(
    @Body() body: { nodeId?: string; offset?: string },
  ) {
    return this.debuggerService.createSession(body.nodeId ?? '', body.offset ?? '');
  }

  @Get('/sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.debuggerService.getSession(sessionId);
  }

  @Get('/sessions/:sessionId/events')
  listEvents(@Param('sessionId') sessionId: string) {
    return this.debuggerService.listEvents(sessionId);
  }

  @Post('/sessions/:sessionId/actions/:action')
  actOnSession(
    @Param('sessionId') sessionId: string,
    @Param('action') action: string,
  ) {
    switch (action) {
      case 'step-back':
        return this.debuggerService.stepBack(sessionId);
      case 'step-into':
        return this.debuggerService.stepInto(sessionId);
      case 'step-over':
        return this.debuggerService.stepOver(sessionId);
      case 'step-out':
        return this.debuggerService.stepOut(sessionId);
      case 'continue':
        return this.debuggerService.continue(sessionId);
      default:
        throw new BadRequestException(`Unsupported debugger action: ${action}`);
    }
  }

  @Post('/sessions/:sessionId/steps/:stepId/select')
  selectStep(
    @Param('sessionId') sessionId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.debuggerService.jumpToStep(sessionId, stepId);
  }

  @Delete('/sessions/:sessionId')
  disposeSession(@Param('sessionId') sessionId: string) {
    this.debuggerService.disposeSession(sessionId);
    return { ok: true };
  }
}
