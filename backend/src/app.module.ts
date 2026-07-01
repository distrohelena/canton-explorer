import { Module } from '@nestjs/common';
import { NodesController } from './api/nodes.controller';
import { NodeCacheService } from './cache/node-cache.service';
import { NodeConfigService } from './config/node-config.service';
import { GrpcClientFactory } from './grpc/grpc-client.factory';
import { GrpcOperationsService } from './grpc/grpc-operations.service';
import { NodePollerService } from './orchestrator/node-poller.service';
import { PqsClientFactory } from './pqs/pqs-client.factory';
import { PqsSummaryService } from './pqs/pqs-summary.service';

@Module({
  controllers: [NodesController],
  providers: [
    NodeConfigService,
    PqsClientFactory,
    PqsSummaryService,
    GrpcClientFactory,
    GrpcOperationsService,
    NodeCacheService,
    NodePollerService,
  ],
})
export class AppModule {}
