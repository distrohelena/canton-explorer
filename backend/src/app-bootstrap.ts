import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 4600;
export const DEFAULT_API_BASE_PATH = '/api';

type BootstrapApp = {
  enableCors(): void;
  listen(port: number, host: string): Promise<unknown>;
  useStaticAssets?(path: string): void;
  getHttpAdapter?(): {
    getInstance(): {
      get(path: RegExp, handler: (request: unknown, response: { sendFile(path: string): void }) => void): void;
    };
  };
};

export function resolveFrontendAssetsDir(): string {
  return join(__dirname, 'public');
}

export function resolveHost(host = process.env.HOST): string {
  return host?.trim() ? host.trim() : DEFAULT_HOST;
}

export function resolvePort(port = process.env.PORT): number {
  if (!port) {
    return DEFAULT_PORT;
  }

  const parsed = Number(port);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_PORT;
}

export function configureFrontendAssets(
  app: BootstrapApp,
  frontendAssetsDir = resolveFrontendAssetsDir(),
) {
  const indexPath = join(frontendAssetsDir, 'index.html');
  if (!existsSync(indexPath) || !app.useStaticAssets || !app.getHttpAdapter) {
    return;
  }

  app.useStaticAssets(frontendAssetsDir);
  app
    .getHttpAdapter()
    .getInstance()
    .get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(indexPath);
    });
}

export async function startApp(
  createApp: () => Promise<BootstrapApp> = () =>
    NestFactory.create<NestExpressApplication>(AppModule),
) {
  const app = await createApp();
  app.enableCors();
  configureFrontendAssets(app);
  await app.listen(resolvePort(), resolveHost());
}

export async function bootstrap() {
  await startApp();
}
