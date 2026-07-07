import { inspect } from 'node:util';
import { NodeConfigService } from '../src/config/node-config.service';
import { GrpcClientFactory } from '../src/grpc/grpc-client.factory';
import { describeGrpcError } from '../src/grpc/grpc-error.util';

async function main() {
  const nodeId = process.argv[2];
  const configService = new NodeConfigService();
  const nodes = configService.list();

  if (!nodeId) {
    console.error('Usage: npm run debug:list-local-parties -- <node-id>');
    console.error(`Available nodes: ${nodes.map((node) => node.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    console.error(`Unknown node: ${nodeId}`);
    console.error(`Available nodes: ${nodes.map((candidate) => candidate.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (node.mode !== 'pqs_with_grpc') {
    console.error(`Node ${node.id} is ${node.mode}; local party listing requires pqs_with_grpc.`);
    process.exitCode = 1;
    return;
  }

  const clientFactory = new GrpcClientFactory();
  const client = await clientFactory.create(node);

  try {
    const response = await client.partyManagementService.listKnownPartiesAsync({ pageSize: 1 });
    console.log(
      inspect(
        {
          ledgerEndpoint: node.grpc.ledgerTarget,
          ledgerAdminEndpoint: node.grpc.ledgerAdminTarget,
          participantAdminEndpoint: node.grpc.participantAdminTarget,
          pageSize: 1,
          nextPageToken: response.nextPageToken ?? null,
          partyDetails: response.partyDetails ?? [],
        },
        { depth: 6, colors: false },
      ),
    );
  } catch (error) {
    const normalized = describeGrpcError(error);
    const errorRecord =
      error && typeof error === 'object'
        ? Object.fromEntries(
            Object.entries(error).map(([key, value]) => [
              key,
              typeof value === 'object' ? inspect(value, { depth: 4, colors: false }) : value,
            ]),
          )
        : error;

    console.error(
      inspect(
        {
          ledgerEndpoint: node.grpc.ledgerTarget,
          ledgerAdminEndpoint: node.grpc.ledgerAdminTarget,
          participantAdminEndpoint: node.grpc.participantAdminTarget,
          normalized,
          raw: errorRecord,
        },
        { depth: 6, colors: false },
      ),
    );
    process.exitCode = 2;
  } finally {
    await client.disposeAsync?.();
  }
}

void main();
