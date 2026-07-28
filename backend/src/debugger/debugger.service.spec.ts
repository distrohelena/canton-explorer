import { DebuggerService } from './debugger.service';
import { BadRequestException } from '@nestjs/common';

describe('DebuggerService', () => {
  function createService() {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const steps = [
      {
        stepId: 'step-0',
        stepIndex: 0,
        phase: 'enterExpression',
        stackFrames: [{ frameId: 'frame-1', name: 'Archive' }],
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [{ name: 'owner', kind: 'text', value: 'Alice' }],
          },
        ],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'Main.daml',
          startLine: 858,
          startColumn: 1,
          endLine: 858,
          endColumn: 20,
          precision: 'fallback',
        },
      },
      {
        stepId: 'step-1',
        stepIndex: 1,
        phase: 'stateEffect',
        stackFrames: [{ frameId: 'frame-1', name: 'Archive' }],
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
                sourceLocation: {
                  path: 'Main.daml',
                  startLine: 10,
                  startColumn: 14,
                  endLine: 10,
                  endColumn: 19,
                },
              },
            ],
          },
        ],
        locals: [],
        arguments: [],
        sourceLocation: {
          path: 'Main.daml',
          startLine: 869,
          startColumn: 1,
          endLine: 869,
          endColumn: 18,
          precision: 'exact',
        },
        stateDelta: {
          kind: 'exercise',
          eventOrdinal: 0,
          comparisonKey: 'event-0',
          targetContractId: '00abc',
          templateId: {
            packageId: 'pkg-main',
            moduleName: 'Main',
            entityName: 'Vault',
          },
          choice: 'Archive',
          choiceArgument: { note: 'archived' },
        },
      },
      {
        stepId: 'step-2',
        stepIndex: 2,
        phase: 'stateEffect',
        stackFrames: [{ frameId: 'frame-1', name: 'Archive' }],
        scopes: [],
        locals: [],
        arguments: [],
        stateDelta: {
          kind: 'create',
          eventOrdinal: 1,
          comparisonKey: 'event-1',
          createdContractId: 'created-1',
          templateId: {
            packageId: 'pkg-main',
            moduleName: 'Main',
            entityName: 'Audit',
          },
          payload: { owner: 'Alice' },
        },
      },
      {
        stepId: 'step-3',
        stepIndex: 3,
        phase: 'stateEffect',
        stackFrames: [{ frameId: 'frame-1', name: 'Archive' }],
        scopes: [],
        locals: [],
        arguments: [],
        stateDelta: {
          kind: 'archive',
          eventOrdinal: 2,
          comparisonKey: 'event-2',
          targetContractId: '00abc',
          templateId: {
            packageId: 'pkg-main',
            moduleName: 'Main',
            entityName: 'Vault',
          },
        },
      },
    ];
    const sessionStore = {
      getSessionMetadataOrThrow: jest.fn(() => ({
        sessionId: 'session-1',
        offset: '1685',
        stepCount: steps.length,
      })),
      getCurrentStepOrThrow: jest.fn(() => steps[1]),
      getTraceSliceOrThrow: jest.fn(() => steps),
      advanceIntoOrThrow: jest.fn(),
      advanceBackOrThrow: jest.fn(),
      advanceOverOrThrow: jest.fn(),
      advanceOutOrThrow: jest.fn(),
      continueOrThrow: jest.fn(),
      setCurrentStepByIdOrThrow: jest.fn(),
      dispose: jest.fn(),
    };

    (service as never as { sessionStore: unknown }).sessionStore = sessionStore;
    (
      service as never as {
        sessionArtifacts: Map<string, unknown>;
      }
    ).sessionArtifacts = new Map([
      [
        'session-1',
        {
          nodeId: 'cnqs-extra-1',
          updateId: 'update-1',
          offset: '1685',
          createdAt: '2026-07-22T12:00:00.000Z',
          sourceFilesByPath: new Map([['Main.daml', 'choice Archive = do\n  archive self']]),
          realEvents: [
            {
              eventKind: 'consuming_exercise',
              eventId: '#0:0',
              contractId: '00abc',
              packageId: 'pkg-main',
              templateId: 'Main:Vault',
              choice: 'Archive',
              witnesses: ['Alice'],
              createData: null,
              exerciseData: {
                argument: {
                  status: 'decoded',
                  value: {
                    kind: 'record',
                    fields: [],
                  },
                },
                result: {
                  status: 'decoded',
                  value: {
                    kind: 'unit',
                  },
                },
              },
              raw: {},
            },
          ],
        },
      ],
    ]);

    return { service, sessionStore };
  }

  it('maps the richer canonical step surface into the session response', () => {
    const { service } = createService();

    expect(service.getSession('session-1').currentStep).toEqual(
      expect.objectContaining({
        stepId: 'step-1',
        stepIndex: 1,
        scopes: [
          expect.objectContaining({
            frameId: 'frame-1',
            variables: [
              expect.objectContaining({
                name: 'owner',
                value: 'Alice',
                sourceLocation: {
                  path: 'Main.daml',
                  startLine: 10,
                  startColumn: 14,
                  endLine: 10,
                  endColumn: 19,
                  precision: null,
                },
              }),
            ],
          }),
        ],
        sourceLocation: {
          path: 'Main.daml',
          startLine: 869,
          startColumn: 1,
          endLine: 869,
          endColumn: 18,
          precision: 'exact',
        },
        stateDelta: expect.objectContaining({
          kind: 'exercise',
          eventOrdinal: 0,
          comparisonKey: 'event-0',
          targetContractId: '00abc',
        }),
      }),
    );
  });

  it('lists the stored debugger sessions with current progress', () => {
    const { service } = createService();

    expect(service.listSessions()).toEqual([
      {
        sessionId: 'session-1',
        nodeId: 'cnqs-extra-1',
        updateId: 'update-1',
        offset: '1685',
        stepCount: 4,
        currentStepIndex: 1,
        isTerminal: false,
        createdAt: '2026-07-22T12:00:00.000Z',
      },
    ]);
  });

  it('lists canonical ledger events separately from the current step response', () => {
    const { service } = createService();

    expect(service.listEvents('session-1').replayEvents.map((event) => event.kind)).toEqual([
      'exercise',
      'create',
      'archive',
    ]);
    expect(service.listEvents('session-1').realEvents.map((event) => event.eventKind)).toEqual([
      'consuming_exercise',
    ]);
  });

  it('surfaces a high-level visibility error when replay cannot hydrate hidden contracts', async () => {
    const grpcClientFactory = {
      create: jest.fn().mockResolvedValue({
        updateService: {
          getUpdateByIdAsync: jest.fn().mockResolvedValue({ update: {} }),
        },
        disposeAsync: jest.fn().mockResolvedValue(undefined),
      }),
    };
    const pqsSummaryService = {
      fetchUpdateDetailById: jest.fn().mockResolvedValue({
        parties: ['Alice'],
        events: [],
      }),
    };
    const nodeConfigService = {
      list: jest.fn().mockReturnValue([
        {
          id: 'cnqs-app-provider',
          mode: 'pqs_with_grpc',
          grpc: {},
        },
      ]),
      getDebuggerConfig: jest.fn().mockReturnValue({}),
    };
    const service = new DebuggerService(
      grpcClientFactory as never,
      {} as never,
      {} as never,
      pqsSummaryService as never,
      nodeConfigService as never,
    );

    (service as never as { loadSdkModules: () => Promise<unknown> }).loadSdkModules = async () => ({
      debuggerSdk: {
        ReplayUpdateLoader: class {
          async loadOrThrowAsync() {
            return {
              offset: '249',
              updateId: 'update-1',
              entrypoint: {
                kind: 'exercise',
                argument: {},
              },
              events: [],
            };
          }
        },
        LedgerReplayEnvironmentBuilder: class {
          async buildOrThrowAsync() {
            throw new Error(
              'CONTRACT_EVENTS_NOT_FOUND(11,abcd1234): Contract events not found, or not visible.',
            );
          }
        },
      },
      damlLfSdk: {},
      rootSdk: {},
    });
    (service as never as { getSessionStore: () => Promise<unknown> }).getSessionStore = async () => ({
      dispose: jest.fn(),
    });
    (service as never as { createPackageReadService: () => Promise<unknown> }).createPackageReadService =
      async () => ({});

    await expect(service.createSession('update-1')).rejects.toThrow(
      new BadRequestException('Debug offset is not fully visible in any connected gRPC node.'),
    );
  });

  it('uses the update id for grpc replay lookup when one is provided', async () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const getUpdateByIdAsync = jest.fn().mockResolvedValue({ update: {} });
    const replayService = (
      service as never as {
        createReplayUpdateService: (client: unknown, updateId?: string) => {
          getUpdateByOffsetAsync(request: unknown): Promise<unknown>;
        };
      }
    ).createReplayUpdateService(
      { updateService: { getUpdateByIdAsync } },
      'update-64',
    );

    await replayService.getUpdateByOffsetAsync({ updateFormat: { verbose: true } });

    expect(getUpdateByIdAsync).toHaveBeenCalledWith({
      updateId: 'update-64',
      updateFormat: { verbose: true },
    });
  });

  it('excludes contract archives that occur after the replay snapshot', () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const filterHistory = (
      service as never as {
        filterReplayEventHistoryAtOffset: (response: unknown, offset: string) => unknown;
      }
    ).filterReplayEventHistoryAtOffset;
    const response = {
      created: { createdEvent: { offset: '105' } },
      archived: { archivedEvent: { offset: '240' } },
    };

    expect(filterHistory(response, '122')).toEqual({
      created: response.created,
      archived: undefined,
    });
    expect(filterHistory(response, '300')).toEqual(response);
  });

  it('uses the update record time as the replay clock', () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const withReplayRecordTime = (
      service as never as {
        withReplayRecordTime: <T extends { offset: string }>(environment: T, recordTime: string | null) => T;
      }
    ).withReplayRecordTime;

    expect(withReplayRecordTime({ offset: '122', packageIds: [] }, '2026-07-28T00:14:29.731Z')).toEqual({
      offset: '2026-07-28T00:14:29.731Z',
      packageIds: [],
    });
    expect(withReplayRecordTime({ offset: '122' }, null)).toEqual({ offset: '122' });
  });

  it('preserves microseconds when converting replay timestamps', () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const formatIsoToDamlTimestamp = (
      service as never as { formatIsoToDamlTimestamp: (value: string) => string | null }
    ).formatIsoToDamlTimestamp;

    expect(formatIsoToDamlTimestamp('2026-07-28T00:14:29.731413Z')).toBe('1785197669731413');
  });

  it('uses the self-signed es256 subject when resolving debugger rights', async () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const listUserRightsAsync = jest.fn().mockResolvedValue({
      rights: [
        { type: 'canReadAs', party: 'Alice' },
        { type: 'canReadAsAnyParty' },
      ],
    });

    const result = await (
      service as never as {
        fetchGrantedReplayAccess: (
          node: unknown,
          client: unknown,
        ) => Promise<{ parties: string[]; canReadAsAnyParty: boolean }>;
      }
    ).fetchGrantedReplayAccess(
      {
        grpc: {
          auth: {
            kind: 'self_signed_es256',
            sub: 'ledger-api-user',
            aud: 'https://canton.network.global',
            privateKeyEnv: 'CANTON_ES256_PRIVATE_JWK',
          },
        },
      },
      { userManagementService: { listUserRightsAsync } },
    );

    expect(listUserRightsAsync).toHaveBeenCalledWith({
      userId: 'ledger-api-user',
      identityProviderId: '',
    });
    expect(result).toEqual({ parties: ['Alice'], canReadAsAnyParty: true });
  });

  it('recognizes raw protobuf rights returned by the grpc user-management client', async () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const listUserRightsAsync = jest.fn().mockResolvedValue({
      rights: [
        {
          kind: {
            oneofKind: 'canReadAsAnyParty',
            canReadAsAnyParty: {},
          },
        },
      ],
    });

    const result = await (
      service as never as {
        fetchGrantedReplayAccess: (
          node: unknown,
          client: unknown,
        ) => Promise<{ parties: string[]; canReadAsAnyParty: boolean }>;
      }
    ).fetchGrantedReplayAccess(
      {
        grpc: {
          auth: {
            kind: 'shared_secret_jwt',
            user: 'ledger-api-user',
            audience: 'https://canton.network.global',
            secret: 'unsafe',
          },
        },
      },
      { userManagementService: { listUserRightsAsync } },
    );

    expect(result).toEqual({ parties: [], canReadAsAnyParty: true });

    const replayAccess = await (
      service as never as {
        resolveReplayAccess: (
          node: unknown,
          client: unknown,
          updateDetail: unknown,
        ) => Promise<{ updateVisibleParties?: string[]; queryParties?: string[] }>;
      }
    ).resolveReplayAccess(
      {
        grpc: {
          auth: {
            kind: 'shared_secret_jwt',
            user: 'ledger-api-user',
            audience: 'https://canton.network.global',
            secret: 'unsafe',
          },
        },
      },
      { userManagementService: { listUserRightsAsync } },
      { parties: ['Alice'], events: [{ witnesses: ['Alice'] }] },
    );

    expect(replayAccess).toEqual({
      updateVisibleParties: undefined,
      queryParties: undefined,
    });
  });

  it('does not resolve debugger rights for a static token', async () => {
    const service = new DebuggerService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const listUserRightsAsync = jest.fn().mockResolvedValue({
      rights: [{ type: 'canReadAsAnyParty' }],
    });

    const result = await (
      service as never as {
        fetchGrantedReplayAccess: (
          node: unknown,
          client: unknown,
        ) => Promise<{ parties: string[]; canReadAsAnyParty: boolean }>;
      }
    ).fetchGrantedReplayAccess(
      {
        grpc: {
          auth: {
            kind: 'static_token',
            tokenEnv: 'CANTON_STATIC_TOKEN',
          },
        },
      },
      { userManagementService: { listUserRightsAsync } },
    );

    expect(listUserRightsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ parties: [], canReadAsAnyParty: false });
  });
});
