import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import type {
  CantonManager,
  CantonManagerOptions,
  QueryClient,
} from '@distrohelena/canton-typescript-sdk';
import type { NodeConfig } from '../config/node-config.schema';
import { appLogger, truncateForLog } from '../logging/app-logger';

type PqsManager = Pick<CantonManager, 'query' | 'disposeAsync'>;
export interface PqsRawExecutor {
  query<TRow>(sql: string, values?: readonly unknown[]): Promise<{ rows: TRow[] }>;
}
type SdkModule = Pick<
  typeof import('@distrohelena/canton-typescript-sdk'),
  'CantonManager' | 'CantonClientOptions' | 'QuerySource' | 'TransportKind'
>;

@Injectable()
export class PqsManagerFactory implements OnModuleDestroy {
  private readonly managers = new Map<string, Promise<PqsManager>>();

  constructor(
    @Optional()
    private readonly loadSdk: () => Promise<SdkModule> = () =>
      import('@distrohelena/canton-typescript-sdk') as Promise<SdkModule>,
  ) {}

  async getPqsQuery(node: NodeConfig): Promise<QueryClient> {
    return (await this.getManager(node)).query;
  }

  async getRawExecutor(node: NodeConfig): Promise<PqsRawExecutor> {
    const query = await this.getPqsQuery(node);
    return {
      query: async <TRow>(sql: string, values: readonly unknown[] = []) => {
        const startedAt = Date.now();
        try {
          const rows = [...(await query.$queryRaw<TRow>(sql, values))];
          appLogger.debug(
            `[pqs] node=${node.id} ms=${Date.now() - startedAt} rows=${rows.length} sql=${truncateForLog(sql)}`,
          );
          return { rows };
        } catch (error) {
          appLogger.debug(
            `[pqs] node=${node.id} ms=${Date.now() - startedAt} sql=${truncateForLog(sql)} failed=${(error as Error)?.message ?? error}`,
          );
          throw error;
        }
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    const managers = await Promise.all(this.managers.values());
    await Promise.all(managers.map((manager) => manager.disposeAsync()));
    this.managers.clear();
  }

  private getManager(node: NodeConfig): Promise<PqsManager> {
    const existing = this.managers.get(node.id);
    if (existing) {
      return existing;
    }

    const manager = this.createManager(node);
    this.managers.set(node.id, manager);
    return manager;
  }

  private async createManager(node: NodeConfig): Promise<PqsManager> {
    const connectionString = process.env[node.pqs.connectionUriEnv];
    if (!connectionString) {
      throw new Error(`Missing PQS connection string env var: ${node.pqs.connectionUriEnv}`);
    }

    const sdk = await this.loadSdk();
    const options = {
      grpc: new sdk.CantonClientOptions({ transportKind: sdk.TransportKind.grpc }),
      querySource: sdk.QuerySource.pqs,
      pqs: {
        connectionString,
        schema: node.pqs.schema,
      },
    } satisfies CantonManagerOptions;

    return new sdk.CantonManager(options);
  }
}
