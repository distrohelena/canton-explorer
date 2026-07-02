import { Module } from '@nestjs/common';
import { NodesController } from './api/nodes.controller';
import { NodeCacheService } from './cache/node-cache.service';
import { NodeConfigService } from './config/node-config.service';
import { GrpcClientFactory } from './grpc/grpc-client.factory';
import { GrpcOperationsService } from './grpc/grpc-operations.service';
import { NodePollerService } from './orchestrator/node-poller.service';
import { PqsClientFactory } from './pqs/pqs-client.factory';
import { PqsSummaryService } from './pqs/pqs-summary.service';
import { PackageCacheService } from './packages/package-cache.service';
import { DamlValueDecoderService } from './packages/daml-value-decoder.service';
import { PackageRegistryService } from './packages/package-registry.service';
import { PackageSyncService } from './packages/package-sync.service';
import { PqsPackageService } from './packages/pqs-package.service';

@Module({
  controllers: [NodesController],
  providers: [
    NodeConfigService,
    PqsClientFactory,
    PqsSummaryService,
    PqsPackageService,
    GrpcClientFactory,
    GrpcOperationsService,
    NodeCacheService,
    PackageCacheService,
    PackageRegistryService,
    DamlValueDecoderService,
    PackageSyncService,
    NodePollerService,
  ],
})
export class AppModule {}
