import { Module } from '@nestjs/common';
import { DebuggerController } from './api/debugger.controller';
import { MarketController } from './api/market.controller';
import { NodesController } from './api/nodes.controller';
import { NodeCacheService } from './cache/node-cache.service';
import { NodeConfigService } from './config/node-config.service';
import { DebuggerService } from './debugger/debugger.service';
import { GrpcClientFactory } from './grpc/grpc-client.factory';
import { GrpcOperationsService } from './grpc/grpc-operations.service';
import { NodePollerService } from './orchestrator/node-poller.service';
import { PqsManagerFactory } from './pqs/pqs-manager.factory';
import { PqsSummaryService } from './pqs/pqs-summary.service';
import { PackageCacheService } from './packages/package-cache.service';
import { DamlValueDecoderService } from './packages/daml-value-decoder.service';
import { PackageRegistryService } from './packages/package-registry.service';
import { PackageSyncService } from './packages/package-sync.service';
import { PqsPackageService } from './packages/pqs-package.service';
import { NamespaceFingerprintService } from './namespaces/namespace-fingerprint.service';
import { BybitCantonCoinProvider } from './market/bybit-canton-coin.provider';
import {
  CANTON_COIN_PRICE_PROVIDERS,
  CantonCoinPriceService,
} from './market/canton-coin-price.service';
import { OkxCantonCoinProvider } from './market/okx-canton-coin.provider';
import { TrafficCostEstimateService } from './traffic/traffic-cost-estimate.service';

@Module({
  controllers: [NodesController, DebuggerController, MarketController],
  providers: [
    NodeConfigService,
    PqsManagerFactory,
    PqsSummaryService,
    PqsPackageService,
    GrpcClientFactory,
    GrpcOperationsService,
    NodeCacheService,
    PackageCacheService,
    PackageRegistryService,
    DamlValueDecoderService,
    PackageSyncService,
    DebuggerService,
    NamespaceFingerprintService,
    NodePollerService,
    OkxCantonCoinProvider,
    BybitCantonCoinProvider,
    {
      provide: CANTON_COIN_PRICE_PROVIDERS,
      useFactory: (
        okxProvider: OkxCantonCoinProvider,
        bybitProvider: BybitCantonCoinProvider,
      ) => [okxProvider, bybitProvider],
      inject: [OkxCantonCoinProvider, BybitCantonCoinProvider],
    },
    CantonCoinPriceService,
    TrafficCostEstimateService,
  ],
})
export class AppModule {}
