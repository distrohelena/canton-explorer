import { describe, expect, it, jest } from '@jest/globals';
import { GrpcClientFactory } from '../../src/grpc/grpc-client.factory';

describe('GrpcClientFactory', () => {
  it('passes separate ledger admin and participant admin endpoints to the SDK', async () => {
    const optionsSpy = jest.fn((options: unknown) => options);
    const clientSpy = jest.fn((options: unknown) => ({ options }));

    class TestGrpcClientFactory extends GrpcClientFactory {
      protected override async loadSdk() {
        return {
          BearerTokenAuthProvider: class {
            constructor(_token: string) {}

            async getHeadersAsync() {
              return {};
            }
          },
          CantonClient: clientSpy as never,
          CantonClientOptions: optionsSpy as never,
          TransportKind: { grpc: 'grpc' },
          GrpcChannelSecurity: { tls: 'tls', insecure: 'insecure' },
        };
      }
    }

    const factory = new TestGrpcClientFactory();

    await factory.create({
      id: 'participant-1',
      label: 'Participant 1',
      role: 'participant',
      mode: 'pqs_with_grpc',
      pqs: { connectionUriEnv: 'PARTICIPANT_1_PQS_URL' },
      grpc: {
        ledgerTarget: 'localhost:5012',
        ledgerAdminTarget: 'localhost:5013',
        participantAdminTarget: 'localhost:5014',
        useTls: false,
        connectTimeoutMs: 5000,
      },
    });

    expect(optionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ledgerEndpoint: 'localhost:5012',
        ledgerAdminEndpoint: 'localhost:5013',
        participantAdminEndpoint: 'localhost:5014',
      }),
    );
    expect(clientSpy).toHaveBeenCalledTimes(1);
  });
});
