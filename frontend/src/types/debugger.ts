export interface DebuggerTemplateId {
  packageId: string | null;
  moduleName: string | null;
  entityName: string | null;
}

export interface DebuggerStateDelta {
  kind: string | null;
  eventOrdinal: number | null;
  comparisonKey: string | null;
  createdContractId: string | null;
  targetContractId: string | null;
  templateId: DebuggerTemplateId | null;
  choice: string | null;
  choiceArgument: unknown;
  payload: unknown;
  consuming: boolean | null;
}

export interface DebuggerScopeVariable {
  name: string | null;
  kind: string | null;
  value: string | null;
}

export interface DebuggerScope {
  frameId: string | null;
  name: string | null;
  variables: DebuggerScopeVariable[];
}

export interface DebuggerStep {
  stepId: string | null;
  stepIndex: number;
  phase: string;
  stackFrames: Array<{
    frameId: string | null;
    name: string | null;
  }>;
  scopes: DebuggerScope[];
  locals: unknown[];
  arguments: unknown[];
  sourceLocation: {
    path: string | null;
    startLine: number | null;
    startColumn: number | null;
    endLine: number | null;
    endColumn: number | null;
  } | null;
  valuePreview: {
    kind: string;
    display: string;
  } | null;
  stateDelta: DebuggerStateDelta | null;
}

export interface DebuggerReplayEventSummary {
  stepId: string | null;
  stepIndex: number;
  phase: string;
  kind: string | null;
  eventOrdinal: number | null;
  comparisonKey: string | null;
  createdContractId: string | null;
  targetContractId: string | null;
  templateId: DebuggerTemplateId | null;
  choice: string | null;
  choiceArgument: unknown;
  payload: unknown;
  consuming: boolean | null;
  sourceLocation: DebuggerStep['sourceLocation'];
}

export interface DebuggerRealEventSummary {
  eventId: string | null;
  eventKind: 'create' | 'consuming_exercise' | 'non_consuming_exercise';
  contractId: string | null;
  packageId: string | null;
  templateId: string | null;
  choice: string | null;
  witnesses: string[];
  createData: unknown;
  exerciseArgument: unknown;
  exerciseResult: unknown;
}

export interface DebuggerEventListResponse {
  sessionId: string;
  currentStepId: string | null;
  realEvents: DebuggerRealEventSummary[];
  replayEvents: DebuggerReplayEventSummary[];
}

export interface DebuggerSessionResponse {
  sessionId: string;
  nodeId: string;
  updateId: string | null;
  offset: string;
  stepCount: number;
  currentStepIndex: number;
  isTerminal: boolean;
  currentStep: DebuggerStep;
  source: {
    path: string;
    content: string;
    startLine: number | null;
    startColumn: number | null;
    endLine: number | null;
    endColumn: number | null;
  } | null;
}
