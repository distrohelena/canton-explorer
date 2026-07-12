import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { GrpcClientFactory } from '../grpc/grpc-client.factory';
import { NodeConfigService } from '../config/node-config.service';
import type { NodeConfig } from '../config/node-config.schema';
import type {
  NodeDecodeState,
  NodeDecodedDamlValue,
  NodeUpdateDetailEvent,
} from '../domain/node.types';
import { PackageCacheService } from '../packages/package-cache.service';
import { PackageSyncService } from '../packages/package-sync.service';
import { PqsSummaryService } from '../pqs/pqs-summary.service';

type DebuggerSdkModule = typeof import('@distrohelena/canton-typescript-sdk/debugger');
type DamlLfSdkModule = typeof import('@distrohelena/canton-typescript-sdk/daml-lf');
type RootSdkModule = typeof import('@distrohelena/canton-typescript-sdk');

type DebuggerCapableClient = {
  updateService: {
    getUpdateByOffsetAsync(request: unknown): Promise<unknown>;
  };
  userManagementService: {
    listUserRightsAsync(request: unknown): Promise<{
      rights?: Array<{
        type?: string;
        party?: string;
      }>;
    }>;
  };
  eventQueryService: {
    getEventsByContractIdAsync(request: unknown): Promise<unknown>;
  };
  contractService: {
    getContractAsync(request: unknown): Promise<unknown>;
  };
  participantPackageService: {
    getPackageReferencesAsync(request: unknown): Promise<{ dars: Array<{ main: string }> }>;
    getDarAsync(request: unknown): Promise<{ payload: Uint8Array }>;
  };
  disposeAsync?(): Promise<void>;
};

type DebuggerPackageReadService = DebuggerCapableClient['participantPackageService'];

type ReplaySessionStoreLike = {
  getSessionMetadataOrThrow(sessionId: string): {
    sessionId?: string;
    offset?: string;
    stepCount?: number;
  };
  getCurrentStepOrThrow(sessionId: string): ReplayStepLike;
  advanceIntoOrThrow(sessionId: string): unknown;
  advanceBackOrThrow(sessionId: string): unknown;
  advanceOverOrThrow(sessionId: string): unknown;
  advanceOutOrThrow(sessionId: string): unknown;
  continueOrThrow(sessionId: string): unknown;
  setCurrentStepByIdOrThrow(sessionId: string, stepId: string): unknown;
  getTraceSliceOrThrow(sessionId: string, startIndex: number, endIndex: number): readonly ReplayStepLike[];
  dispose(sessionId: string): void;
};

type ReplayScopeVariableLike = {
  name?: string;
  kind?: string;
  value?: string;
  contractType?: string;
};

type ReplayScopeLike = {
  frameId?: string;
  name?: string;
  variables?: ReplayScopeVariableLike[];
};

type ReplayTemplateIdLike = {
  packageId?: string;
  moduleName?: string;
  entityName?: string;
};

type ReplayStateDeltaLike = {
  kind?: string;
  eventOrdinal?: number;
  comparisonKey?: string;
  createdContractId?: string;
  targetContractId?: string;
  templateId?: ReplayTemplateIdLike;
  choice?: string;
  choiceArgument?: unknown;
  payload?: unknown;
  consuming?: boolean;
};

type ReplayStepLike = {
  stepId?: string;
  stepIndex: number;
  phase: string;
  stackFrames?: Array<{ frameId?: string; name?: string }>;
  scopes?: ReplayScopeLike[];
  locals?: unknown[];
  arguments?: unknown[];
  sourceLocation?: {
    path?: string;
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
  valuePreview?: {
    kind: string;
    display: string;
  };
  stateDelta?: ReplayStateDeltaLike;
};

type DebuggerSessionArtifacts = {
  nodeId: string;
  updateId: string | null;
  offset: string;
  sourceFilesByPath: Map<string, string>;
  realEvents: NodeUpdateDetailEvent[];
};

type LocalDebugDarEntry = {
  mainPackageId: string;
  payload: Uint8Array;
};

export interface DebuggerSessionResponse {
  sessionId: string;
  nodeId: string;
  updateId: string | null;
  offset: string;
  stepCount: number;
  currentStepIndex: number;
  isTerminal: boolean;
  currentStep: DebuggerStepResponse;
  source: {
    path: string;
    content: string;
    startLine: number | null;
    startColumn: number | null;
    endLine: number | null;
    endColumn: number | null;
  } | null;
}

export interface DebuggerTemplateIdResponse {
  packageId: string | null;
  moduleName: string | null;
  entityName: string | null;
}

export interface DebuggerStateDeltaResponse {
  kind: string | null;
  eventOrdinal: number | null;
  comparisonKey: string | null;
  createdContractId: string | null;
  targetContractId: string | null;
  templateId: DebuggerTemplateIdResponse | null;
  choice: string | null;
  choiceArgument: unknown;
  payload: unknown;
  consuming: boolean | null;
}

export interface DebuggerScopeVariableResponse {
  name: string | null;
  kind: string | null;
  value: string | null;
  contractType: string | null;
}

export interface DebuggerScopeResponse {
  frameId: string | null;
  name: string | null;
  variables: DebuggerScopeVariableResponse[];
}

export interface DebuggerStepResponse {
  stepId: string | null;
  stepIndex: number;
  phase: string;
  stackFrames: Array<{ frameId: string | null; name: string | null }>;
  scopes: DebuggerScopeResponse[];
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
  stateDelta: DebuggerStateDeltaResponse | null;
}

export interface DebuggerEventResponse {
  stepId: string | null;
  stepIndex: number;
  phase: string;
  kind: string | null;
  eventOrdinal: number | null;
  comparisonKey: string | null;
  createdContractId: string | null;
  targetContractId: string | null;
  templateId: DebuggerTemplateIdResponse | null;
  choice: string | null;
  choiceArgument: unknown;
  payload: unknown;
  consuming: boolean | null;
  sourceLocation: DebuggerStepResponse['sourceLocation'];
}

export interface DebuggerEventListResponse {
  sessionId: string;
  currentStepId: string | null;
  realEvents: DebuggerRealEventResponse[];
  replayEvents: DebuggerEventResponse[];
}

export interface DebuggerRealEventResponse {
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

@Injectable()
export class DebuggerService {
  private sdkModulesPromise?: Promise<{
    debuggerSdk: DebuggerSdkModule;
    damlLfSdk: DamlLfSdkModule;
    rootSdk: RootSdkModule;
  }>;

  private sessionStore: ReplaySessionStoreLike | null = null;
  private readonly sessionArtifacts = new Map<string, DebuggerSessionArtifacts>();

  constructor(
    private readonly grpcClientFactory: GrpcClientFactory,
    private readonly packageCacheService: PackageCacheService,
    private readonly packageSyncService: PackageSyncService,
    private readonly pqsSummaryService: PqsSummaryService,
    @Optional() private readonly nodeConfigService?: NodeConfigService,
  ) {}

  async createSession(nodeId: string, offset: string): Promise<DebuggerSessionResponse> {
    const normalizedNodeId = nodeId.trim();
    const normalizedOffset = offset.trim();

    if (!normalizedNodeId) {
      throw new BadRequestException('nodeId is required');
    }

    if (!normalizedOffset) {
      throw new BadRequestException('offset is required');
    }

    const node = this.getNodeConfig(normalizedNodeId);
    if (node.mode !== 'pqs_with_grpc') {
      throw new BadRequestException(`Node ${node.id} does not support debugger replay without gRPC`);
    }

    const { debuggerSdk, damlLfSdk } = await this.loadSdkModules();
    const sessionStore = await this.getSessionStore();
    const client = (await this.grpcClientFactory.create(node)) as unknown as DebuggerCapableClient;
    const packageReadService = await this.createPackageReadService(client);
    let stage = 'bootstrap';

    try {
      stage = 'load-update-detail';
      const updateDetail = await this.pqsSummaryService.fetchUpdateDetail(node, normalizedOffset);
      stage = 'resolve-replay-parties';
      const replayAccess = await this.resolveReplayAccess(node, client, updateDetail);

      stage = 'load-update';
      const updateLoader = new debuggerSdk.ReplayUpdateLoader({
        updateService: client.updateService as never,
        visibleParties: replayAccess.updateVisibleParties,
      });
      const snapshot = await updateLoader.loadOrThrowAsync(normalizedOffset);
      stage = 'build-environment';
      const environmentBuilder = new debuggerSdk.LedgerReplayEnvironmentBuilder({
        contractService: this.createReplayContractService(node, client) as never,
        eventQueryService: this.createReplayEventQueryService(node, client) as never,
        queryingParties: replayAccess.queryParties,
      });
      const environment = await environmentBuilder.buildOrThrowAsync(snapshot as never);
      stage = 'resolve-artifacts';
      const artifactResolver = new debuggerSdk.ReplayArtifactResolver({
        participantPackageService: packageReadService as never,
      });
      const resolvedArtifacts = await artifactResolver.resolveAsync(environment.packageIds);

      stage = 'sync-packages';
      await this.packageSyncService.syncPackagesById(node, [...resolvedArtifacts.packageIds]);

      stage = 'load-compilation';
      const compilation = this.loadCompilationOrThrow(damlLfSdk, resolvedArtifacts.packageIds);
      stage = 'load-source-bundles';
      const sourceBundles = await this.loadSourceBundles(
        packageReadService,
        resolvedArtifacts.dars,
        damlLfSdk,
      );
      stage = 'index-sources';
      const indexedCompilation = debuggerSdk.SourceIndexedCompilation.createOrThrow(
        compilation,
        sourceBundles,
      );
      stage = 'load-session';
      const sessionLoader = new debuggerSdk.LedgerReplaySessionLoader({
        updateLoader: {
          loadOrThrowAsync: async () => snapshot as never,
        },
        environmentBuilder: {
          buildOrThrowAsync: async () => environment,
        },
        definitionResolver: new debuggerSdk.ReplayEntrypointDefinitionResolver(indexedCompilation),
        sourceMapper: new debuggerSdk.DamlSourceMapper(indexedCompilation),
        evaluator: new damlLfSdk.DamlLfEvaluator(compilation),
        determinismValidator: new debuggerSdk.ReplayDeterminismValidator(),
      });
      const debuggerClient = new debuggerSdk.LedgerReplayDebuggerClient({
        sessionLoader,
        sessionStore: sessionStore as never,
      });
      stage = 'create-session';
      const session = await debuggerClient.loadSessionAsync(
        new debuggerSdk.ReplaySessionRequest({
          offset: normalizedOffset,
        }),
      );

      if (!session.sessionId) {
        throw new Error('Replay session did not return a session id');
      }

      this.sessionArtifacts.set(session.sessionId, {
        nodeId: node.id,
        updateId: snapshot.updateId ?? null,
        offset: snapshot.offset,
        sourceFilesByPath: this.flattenSourceFiles(sourceBundles),
        realEvents: updateDetail.events ?? [],
      });

      return this.getSession(session.sessionId);
    } catch (error) {
      console.error('[DebuggerService] createSession failed at stage:', stage, error);
      const message = error instanceof Error ? error.message : 'Debugger session bootstrap failed';
      if (message.includes('debug/source-map.json')) {
        throw new BadRequestException(
          'Debugger requires DAR source maps, but the relevant DAR does not contain debug/source-map.json.',
        );
      }

      if (message.includes('UPDATE_NOT_FOUND')) {
        throw new NotFoundException(
          'Update not found on this node, or not visible to the configured ledger user.',
        );
      }

      if (this.isReplayVisibilityError(message)) {
        throw new BadRequestException(
          'Debug offset is not fully visible in any connected gRPC node.',
        );
      }

      throw new InternalServerErrorException(message);
    } finally {
      await client.disposeAsync?.();
    }
  }

  getSession(sessionId: string): DebuggerSessionResponse {
    const sessionStore = this.getSessionStoreSync();
    const artifacts = this.sessionArtifacts.get(sessionId);

    if (!artifacts) {
      throw new NotFoundException(`Unknown debugger session: ${sessionId}`);
    }

    const metadata = sessionStore.getSessionMetadataOrThrow(sessionId);
    const currentStep = sessionStore.getCurrentStepOrThrow(sessionId);
    const sourceLocation = currentStep.sourceLocation;
    const sourcePath = sourceLocation?.path ?? null;
    const sourceContent = sourcePath ? artifacts.sourceFilesByPath.get(sourcePath) ?? null : null;

    return {
      sessionId,
      nodeId: artifacts.nodeId,
      updateId: artifacts.updateId,
      offset: artifacts.offset,
      stepCount: metadata.stepCount ?? 0,
      currentStepIndex: currentStep.stepIndex,
      isTerminal:
        typeof metadata.stepCount === 'number'
          ? currentStep.stepIndex >= Math.max(0, metadata.stepCount - 1)
          : false,
      currentStep: this.mapStep(currentStep),
      source:
        sourcePath && sourceContent !== null
          ? {
              path: sourcePath,
              content: sourceContent,
              startLine: sourceLocation?.startLine ?? null,
              startColumn: sourceLocation?.startColumn ?? null,
              endLine: sourceLocation?.endLine ?? null,
              endColumn: sourceLocation?.endColumn ?? null,
            }
          : null,
    };
  }

  listEvents(sessionId: string): DebuggerEventListResponse {
    const sessionStore = this.getSessionStoreSync();
    const metadata = sessionStore.getSessionMetadataOrThrow(sessionId);
    const currentStep = sessionStore.getCurrentStepOrThrow(sessionId);
    const artifacts = this.sessionArtifacts.get(sessionId);

    if (!artifacts) {
      throw new NotFoundException(`Unknown debugger session: ${sessionId}`);
    }

    const trace = sessionStore.getTraceSliceOrThrow(sessionId, 0, metadata.stepCount ?? 0);

    return {
      sessionId,
      currentStepId: currentStep.stepId ?? null,
      realEvents: artifacts.realEvents.map((event) => this.mapRealEvent(event)),
      replayEvents: trace
        .filter((step) => step.stateDelta !== undefined)
        .map((step) => this.mapEvent(step)),
    };
  }

  stepInto(sessionId: string): DebuggerSessionResponse {
    this.getSessionStoreSync().advanceIntoOrThrow(sessionId);
    return this.getSession(sessionId);
  }

  stepBack(sessionId: string): DebuggerSessionResponse {
    this.getSessionStoreSync().advanceBackOrThrow(sessionId);
    return this.getSession(sessionId);
  }

  stepOver(sessionId: string): DebuggerSessionResponse {
    this.getSessionStoreSync().advanceOverOrThrow(sessionId);
    return this.getSession(sessionId);
  }

  stepOut(sessionId: string): DebuggerSessionResponse {
    this.getSessionStoreSync().advanceOutOrThrow(sessionId);
    return this.getSession(sessionId);
  }

  continue(sessionId: string): DebuggerSessionResponse {
    this.getSessionStoreSync().continueOrThrow(sessionId);
    return this.getSession(sessionId);
  }

  jumpToStep(sessionId: string, stepId: string): DebuggerSessionResponse {
    this.getSessionStoreSync().setCurrentStepByIdOrThrow(sessionId, stepId);
    return this.getSession(sessionId);
  }

  disposeSession(sessionId: string): void {
    this.getSessionStoreSync().dispose(sessionId);
    this.sessionArtifacts.delete(sessionId);
  }

  private async loadSdkModules() {
    if (!this.sdkModulesPromise) {
      this.sdkModulesPromise = Promise.all([
        import('@distrohelena/canton-typescript-sdk'),
        import('@distrohelena/canton-typescript-sdk/debugger'),
        import('@distrohelena/canton-typescript-sdk/daml-lf'),
      ]).then(([rootSdk, debuggerSdk, damlLfSdk]) => ({ rootSdk, debuggerSdk, damlLfSdk }));
    }

    return this.sdkModulesPromise;
  }

  private async getSessionStore(): Promise<ReplaySessionStoreLike> {
    if (!this.sessionStore) {
      const { debuggerSdk } = await this.loadSdkModules();
      this.sessionStore = new debuggerSdk.InMemoryReplaySessionStore() as unknown as ReplaySessionStoreLike;
    }

    return this.sessionStore;
  }

  private getSessionStoreSync(): ReplaySessionStoreLike {
    if (!this.sessionStore) {
      throw new NotFoundException('Debugger session store is not initialized');
    }

    return this.sessionStore;
  }

  private getNodeConfig(id: string): NodeConfig {
    const node = this.nodeConfigService?.list().find((candidate) => candidate.id === id);
    if (!node) {
      throw new NotFoundException(`Unknown node: ${id}`);
    }

    return node;
  }

  private loadCompilationOrThrow(
    damlLfSdk: DamlLfSdkModule,
    packageIds: readonly string[],
  ) {
    const packageLoader = new damlLfSdk.DamlLfPackageLoader();
    const packages = packageIds.map((packageId) => {
      const cachedPackage = this.packageCacheService.getPackage(packageId);
      if (!cachedPackage) {
        throw new NotFoundException(`Missing cached package for debugger replay: ${packageId}`);
      }

      return packageLoader.loadPackageOrThrow(cachedPackage.data);
    });

    return damlLfSdk.DamlLfCompilation.createOrThrow(
      new damlLfSdk.DamlLfWorkspace(packages),
    );
  }

  private async loadSourceBundles(
    packageReadService: DebuggerPackageReadService,
    dars: readonly { main: string }[],
    damlLfSdk: DamlLfSdkModule,
  ) {
    const { rootSdk } = await this.loadSdkModules();
    const sourceBundleLoader = new damlLfSdk.DarSourceBundleLoader();
    const sourceBundles = [];

    for (const dar of dars) {
      const response = await packageReadService.getDarAsync(
        new rootSdk.GetDarRequest({
          mainPackageId: dar.main,
        }),
      );
      sourceBundles.push(await sourceBundleLoader.loadSourceBundleOrThrowAsync(response.payload));
    }

    return sourceBundles;
  }

  private flattenSourceFiles(
    sourceBundles: Array<{
      sourceFiles: ReadonlyArray<{
        path: string;
        content: string;
      }>;
    }>,
  ): Map<string, string> {
    const sourceFiles = new Map<string, string>();

    for (const bundle of sourceBundles) {
      for (const sourceFile of bundle.sourceFiles) {
        if (!sourceFiles.has(sourceFile.path)) {
          sourceFiles.set(sourceFile.path, sourceFile.content);
        }
      }
    }

    return sourceFiles;
  }

  private createReplayContractService(
    node: Extract<NodeConfig, { mode: 'pqs_with_grpc' }>,
    client: DebuggerCapableClient,
  ): DebuggerCapableClient['contractService'] {
    return {
      getContractAsync: async (request: unknown) => {
        try {
          return await client.contractService.getContractAsync(request);
        } catch (error) {
          const fallback = await this.buildPqsReplayCreatedEvent(node, request);

          if (fallback) {
            return {
              createdEvent: fallback,
            };
          }

          throw error;
        }
      },
    };
  }

  private createReplayEventQueryService(
    node: Extract<NodeConfig, { mode: 'pqs_with_grpc' }>,
    client: DebuggerCapableClient,
  ): DebuggerCapableClient['eventQueryService'] {
    return {
      getEventsByContractIdAsync: async (request: unknown) => {
        try {
          return await client.eventQueryService.getEventsByContractIdAsync(request);
        } catch (error) {
          const fallback = await this.buildPqsReplayCreatedEvent(node, request);

          if (fallback) {
            return {
              created: {
                createdEvent: fallback,
                synchronizerId: 'pqs-fallback',
              },
            };
          }

          throw error;
        }
      },
    };
  }

  private mapStep(step: ReplayStepLike): DebuggerStepResponse {
    return {
      stepId: step.stepId ?? null,
      stepIndex: step.stepIndex,
      phase: step.phase,
      stackFrames: (step.stackFrames ?? []).map((frame) => ({
        frameId: frame.frameId ?? null,
        name: frame.name ?? null,
      })),
      scopes: (step.scopes ?? []).map((scope) => this.mapScope(scope)),
      locals: [...(step.locals ?? [])],
      arguments: [...(step.arguments ?? [])],
      sourceLocation: this.mapSourceLocation(step.sourceLocation),
      valuePreview: step.valuePreview
        ? {
            kind: step.valuePreview.kind,
            display: step.valuePreview.display,
          }
        : null,
      stateDelta: this.mapStateDelta(step.stateDelta),
    };
  }

  private mapEvent(step: ReplayStepLike): DebuggerEventResponse {
    const stateDelta = this.mapStateDelta(step.stateDelta);

    return {
      stepId: step.stepId ?? null,
      stepIndex: step.stepIndex,
      phase: step.phase,
      kind: stateDelta?.kind ?? null,
      eventOrdinal: stateDelta?.eventOrdinal ?? null,
      comparisonKey: stateDelta?.comparisonKey ?? null,
      createdContractId: stateDelta?.createdContractId ?? null,
      targetContractId: stateDelta?.targetContractId ?? null,
      templateId: stateDelta?.templateId ?? null,
      choice: stateDelta?.choice ?? null,
      choiceArgument: stateDelta?.choiceArgument ?? null,
      payload: stateDelta?.payload ?? null,
      consuming: stateDelta?.consuming ?? null,
      sourceLocation: this.mapSourceLocation(step.sourceLocation),
    };
  }

  private mapRealEvent(event: NodeUpdateDetailEvent): DebuggerRealEventResponse {
    return {
      eventId: event.eventId ?? null,
      eventKind: event.eventKind,
      contractId: event.contractId ?? null,
      packageId: event.packageId ?? null,
      templateId: event.templateId ?? null,
      choice: event.choice ?? null,
      witnesses: [...(event.witnesses ?? [])],
      createData:
        event.createData?.status === 'decoded' ? event.createData.value : null,
      exerciseArgument:
        event.exerciseData?.argument.status === 'decoded'
          ? event.exerciseData.argument.value
          : null,
      exerciseResult:
        event.exerciseData?.result.status === 'decoded'
          ? event.exerciseData.result.value
          : null,
    };
  }

  private mapScope(scope: ReplayScopeLike): DebuggerScopeResponse {
    return {
      frameId: scope.frameId ?? null,
      name: scope.name ?? null,
      variables: (scope.variables ?? []).map((variable) => ({
        name: variable.name ?? null,
        kind: variable.kind ?? null,
        value: variable.value ?? null,
        contractType: variable.contractType ?? null,
      })),
    };
  }

  private mapStateDelta(stateDelta?: ReplayStateDeltaLike): DebuggerStateDeltaResponse | null {
    if (!stateDelta) {
      return null;
    }

    return {
      kind: stateDelta.kind ?? null,
      eventOrdinal: stateDelta.eventOrdinal ?? null,
      comparisonKey: stateDelta.comparisonKey ?? null,
      createdContractId: stateDelta.createdContractId ?? null,
      targetContractId: stateDelta.targetContractId ?? null,
      templateId: stateDelta.templateId
        ? {
            packageId: stateDelta.templateId.packageId ?? null,
            moduleName: stateDelta.templateId.moduleName ?? null,
            entityName: stateDelta.templateId.entityName ?? null,
          }
        : null,
      choice: stateDelta.choice ?? null,
      choiceArgument: stateDelta.choiceArgument ?? null,
      payload: stateDelta.payload ?? null,
      consuming: stateDelta.consuming ?? null,
    };
  }

  private mapSourceLocation(
    sourceLocation?: ReplayStepLike['sourceLocation'],
  ): DebuggerStepResponse['sourceLocation'] {
    return sourceLocation
      ? {
          path: sourceLocation.path ?? null,
          startLine: sourceLocation.startLine ?? null,
          startColumn: sourceLocation.startColumn ?? null,
          endLine: sourceLocation.endLine ?? null,
          endColumn: sourceLocation.endColumn ?? null,
        }
      : null;
  }

  private async buildPqsReplayCreatedEvent(
    node: NodeConfig,
    request: unknown,
  ): Promise<
    | {
        contractId: string;
        templateId: {
          packageId: string;
          moduleName: string;
          entityName: string;
        };
        createArguments: unknown;
      }
    | null
  > {
    const contractId =
      request && typeof request === 'object' && 'contractId' in request
        ? (request as { contractId?: unknown }).contractId
        : undefined;

    if (typeof contractId !== 'string' || contractId.length === 0) {
      return null;
    }

    let contractDetail;

    try {
      contractDetail = await this.pqsSummaryService.fetchContractDetail(node, contractId);
    } catch {
      return null;
    }

    if (contractDetail.contractData?.status !== 'decoded') {
      return null;
    }

    const templateId = this.parseTemplateIdentifier(
      contractDetail.packageId,
      contractDetail.templateId,
    );

    if (!templateId) {
      return null;
    }

    return {
      contractId,
      templateId,
      createArguments: this.toReplayLedgerValue(contractDetail.contractData),
    };
  }

  private parseTemplateIdentifier(
    packageId: string | null,
    templateId: string | null,
  ): {
    packageId: string;
    moduleName: string;
    entityName: string;
  } | null {
    if (!packageId || !templateId) {
      return null;
    }

    const separatorIndex = templateId.lastIndexOf(':');

    if (separatorIndex <= 0 || separatorIndex >= templateId.length - 1) {
      return null;
    }

    return {
      packageId,
      moduleName: templateId.slice(0, separatorIndex),
      entityName: templateId.slice(separatorIndex + 1),
    };
  }

  private toReplayLedgerValue(
    state: NodeDecodeState<NodeDecodedDamlValue>,
  ): unknown {
    if (state.status !== 'decoded') {
      return undefined;
    }

    return this.decodeNodeValue(state.value);
  }

  private decodeNodeValue(value: NodeDecodedDamlValue): unknown {
    if (
      typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
    ) {
      return value;
    }

    switch (value.kind) {
      case 'contract_id':
        return {
          sum: {
            oneofKind: 'contractId',
            contractId: value.value,
          },
        };
      case 'record':
        return {
          fields: value.fields.map((field) => ({
            label: field.label,
            value: this.decodeNodeValue(field.value),
          })),
        };
      case 'variant':
        return {
          sum: {
            oneofKind: 'variant',
            variant: {
              constructor: value.constructor,
              value: value.value === null ? undefined : this.decodeNodeValue(value.value),
            },
          },
        };
      case 'enum':
        return {
          sum: {
            oneofKind: 'enum',
            enum: {
              constructor: value.constructor,
            },
          },
        };
      case 'list':
        return {
          sum: {
            oneofKind: 'list',
            list: {
              elements: value.items.map((item) => this.decodeNodeValue(item)),
            },
          },
        };
      case 'optional':
        return {
          sum: {
            oneofKind: 'optional',
            optional:
              value.value === null
                ? {}
                : {
                    value: this.decodeNodeValue(value.value),
                  },
          },
        };
      case 'text_map':
        return {
          sum: {
            oneofKind: 'textMap',
            textMap: {
              entries: value.entries.map((entry) => ({
                key: entry.key,
                value: this.decodeNodeValue(entry.value),
              })),
            },
          },
        };
      case 'gen_map':
        return {
          sum: {
            oneofKind: 'genMap',
            genMap: {
              entries: value.entries.map((entry) => ({
                key: this.decodeNodeValue(entry.key),
                value: this.decodeNodeValue(entry.value),
              })),
            },
          },
        };
      case 'unit':
        return {
          sum: {
            oneofKind: 'unit',
          },
        };
      default:
        return undefined;
    }
  }

  private collectVisibleParties(updateDetail: {
    parties: string[];
    events: Array<{ witnesses: string[] }>;
  }): string[] {
    return [
      ...new Set([
        ...(updateDetail.parties ?? []),
        ...updateDetail.events.flatMap((event) => event.witnesses ?? []),
      ]),
    ].filter((party) => typeof party === 'string' && party.length > 0);
  }

  private async resolveReplayAccess(
    node: Extract<NodeConfig, { mode: 'pqs_with_grpc' }>,
    client: DebuggerCapableClient,
    updateDetail: {
      parties: string[];
      events: Array<{ witnesses: string[] }>;
    },
  ): Promise<{
    updateVisibleParties?: string[];
    queryParties?: string[];
  }> {
    const grantedAccess = await this.fetchGrantedReplayAccess(node, client);
    const detailParties = this.collectVisibleParties(updateDetail);

    if (grantedAccess.canReadAsAnyParty) {
      return {
        updateVisibleParties: undefined,
        queryParties: detailParties.length > 0 ? detailParties : undefined,
      };
    }

    const grantedParties = grantedAccess.parties;

    if (grantedParties.length === 0) {
      return {
        updateVisibleParties: detailParties.length > 0 ? detailParties : undefined,
        queryParties: detailParties.length > 0 ? detailParties : undefined,
      };
    }

    if (detailParties.length === 0) {
      return {
        updateVisibleParties: grantedParties,
        queryParties: grantedParties,
      };
    }

    const grantedPartySet = new Set(grantedParties);
    const overlappingParties = detailParties.filter((party) => grantedPartySet.has(party));

    const parties = overlappingParties.length > 0 ? overlappingParties : grantedParties;
    return {
      updateVisibleParties: parties,
      queryParties: parties,
    };
  }

  private async fetchGrantedReplayAccess(
    node: Extract<NodeConfig, { mode: 'pqs_with_grpc' }>,
    client: DebuggerCapableClient,
  ): Promise<{
    parties: string[];
    canReadAsAnyParty: boolean;
  }> {
    const authConfig = node.grpc.auth;
    if (!authConfig || authConfig.kind !== 'shared_secret_jwt') {
      return {
        parties: [],
        canReadAsAnyParty: false,
      };
    }

    const response = await client.userManagementService.listUserRightsAsync({
      userId: authConfig.user,
    });

    const rights = response.rights ?? [];

    return {
      canReadAsAnyParty: rights.some((right) => right?.type === 'canReadAsAnyParty'),
      parties: [
        ...new Set(
          rights
            .filter(
              (right): right is { type: string; party: string } =>
                typeof right?.type === 'string'
                && (right.type === 'canActAs' || right.type === 'canReadAs')
                && typeof right.party === 'string'
                && right.party.length > 0,
            )
            .map((right) => right.party),
        ),
      ],
    };
  }

  private async createPackageReadService(
    client: DebuggerCapableClient,
  ): Promise<DebuggerPackageReadService> {
    const localDebugDars = await this.loadLocalDebugDars();

    if (localDebugDars.size === 0) {
      return client.participantPackageService;
    }

    return {
      getPackageReferencesAsync: async (request: unknown) => {
        const packageId = this.extractPackageId(request);
        const localDar = packageId ? localDebugDars.get(packageId) : undefined;

        if (localDar) {
          return {
            dars: [{ main: localDar.mainPackageId }],
          };
        }

        return client.participantPackageService.getPackageReferencesAsync(request);
      },
      getDarAsync: async (request: unknown) => {
        const mainPackageId = this.extractMainPackageId(request);
        const localDar = mainPackageId ? localDebugDars.get(mainPackageId) : undefined;

        if (localDar) {
          return {
            payload: localDar.payload,
          };
        }

        return client.participantPackageService.getDarAsync(request);
      },
    };
  }

  private async loadLocalDebugDars(): Promise<Map<string, LocalDebugDarEntry>> {
    const directory = this.getLocalDebugDarDirectory();
    const entries = new Map<string, LocalDebugDarEntry>();

    if (!directory || !this.pathExists(directory, 'directory')) {
      return entries;
    }

    const { damlLfSdk } = await this.loadSdkModules();
    const archiveLoader = new damlLfSdk.DarArchiveLoader();
    const packageLoader = new damlLfSdk.DamlLfPackageLoader();
    const sourceBundleLoader = new damlLfSdk.DarSourceBundleLoader();

    for (const filePath of this.listDarFiles(directory)) {
      try {
        const payload = readFileSync(filePath);
        await sourceBundleLoader.loadSourceBundleOrThrowAsync(payload);
        const archive = await archiveLoader.loadDarOrThrowAsync(payload);
        const mainPackage = packageLoader.loadPackageOrThrow(archive.mainPackageEntry.bytes);

        entries.set(mainPackage.packageId, {
          mainPackageId: mainPackage.packageId,
          payload,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[DebuggerService] Skipping local debug DAR ${filePath}: ${message}`);
      }
    }

    return entries;
  }

  private isReplayVisibilityError(message: string): boolean {
    return (
      message.includes('CONTRACT_EVENTS_NOT_FOUND')
      || message.includes('CONTRACT_PAYLOAD_NOT_FOUND')
      || message.includes('Contract events not found, or not visible.')
      || message.includes('Contract payload not found, or not visible.')
    );
  }

  private getLocalDebugDarDirectory(): string | null {
    const configuredDirectory = this.nodeConfigService?.getDebuggerConfig().localDarDirectory?.trim();
    if (configuredDirectory) {
      return resolve(configuredDirectory);
    }

    const currentWorkingDirectoryPath = resolve(process.cwd(), 'debug-dars');
    if (this.pathExists(currentWorkingDirectoryPath, 'directory')) {
      return currentWorkingDirectoryPath;
    }

    const parentDirectoryPath = resolve(process.cwd(), '..', 'debug-dars');
    if (this.pathExists(parentDirectoryPath, 'directory')) {
      return parentDirectoryPath;
    }

    return currentWorkingDirectoryPath;
  }

  private listDarFiles(rootDir: string): string[] {
    const files: string[] = [];

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = resolve(rootDir, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.listDarFiles(absolutePath));
        continue;
      }

      if (entry.isFile() && absolutePath.endsWith('.dar')) {
        files.push(absolutePath);
      }
    }

    return files.sort();
  }

  private pathExists(candidatePath: string, kind: 'directory' | 'file'): boolean {
    try {
      const stats = statSync(candidatePath);
      return kind === 'directory' ? stats.isDirectory() : stats.isFile();
    } catch {
      return false;
    }
  }

  private extractPackageId(request: unknown): string | null {
    if (!request || typeof request !== 'object') {
      return null;
    }

    const candidate = (request as { packageId?: unknown }).packageId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }

  private extractMainPackageId(request: unknown): string | null {
    if (!request || typeof request !== 'object') {
      return null;
    }

    const candidate = (request as { mainPackageId?: unknown }).mainPackageId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }
}
