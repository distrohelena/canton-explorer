import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DEFAULT_FRONTEND_CONFIG } from './config/node-config.schema';
import { NodeConfigService } from './config/node-config.service';

export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 4600;
export const DEFAULT_API_BASE_PATH = '/api';

type BootstrapApp = {
  enableCors(): void;
  listen(port: number, host: string): Promise<unknown>;
  useStaticAssets?(path: string, options?: { index?: boolean }): void;
  getHttpAdapter?(): {
    getInstance(): {
      get(
        path: RegExp,
        handler: (
          request: unknown,
          response: { send(body: string): void },
        ) => void,
      ): void;
    };
  };
};

export function resolveFrontendAssetsDir(baseDir = __dirname): string {
  const srcPublicDir = join(baseDir, 'public');
  if (existsSync(join(srcPublicDir, 'index.html'))) {
    return srcPublicDir;
  }

  return join(baseDir, '..', 'public');
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

export function resolveFrontendBasePath(app: unknown): string {
  const configService = (app as { get?: (token: unknown) => unknown }).get?.(
    NodeConfigService,
  ) as { getFrontendConfig?: () => { basePath?: string } } | undefined;

  return (
    configService?.getFrontendConfig?.().basePath ??
    DEFAULT_FRONTEND_CONFIG.basePath
  );
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function injectFrontendBasePath(
  indexHtml: string,
  basePath: string,
): string {
  const baseTag = `<base href="${escapeHtmlAttribute(basePath)}">`;
  const existingBaseTag = /<base\b[^>]*>/i;
  if (existingBaseTag.test(indexHtml)) {
    return indexHtml.replace(existingBaseTag, baseTag);
  }

  const headTag = /<head\b[^>]*>/i;
  if (headTag.test(indexHtml)) {
    return indexHtml.replace(headTag, (match) => `${match}\n    ${baseTag}`);
  }

  return `${baseTag}\n${indexHtml}`;
}

export function configureFrontendAssets(
  app: BootstrapApp,
  frontendAssetsDir = resolveFrontendAssetsDir(),
  frontendBasePath: string = DEFAULT_FRONTEND_CONFIG.basePath,
) {
  const indexPath = join(frontendAssetsDir, 'index.html');
  if (!existsSync(indexPath) || !app.useStaticAssets || !app.getHttpAdapter) {
    return;
  }

  const indexHtml = injectFrontendBasePath(
    readFileSync(indexPath, 'utf8'),
    frontendBasePath,
  );

  app.useStaticAssets(frontendAssetsDir, { index: false });
  app
    .getHttpAdapter()
    .getInstance()
    .get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
      response.send(indexHtml);
    });
}

export async function startApp(
  createApp: () => Promise<BootstrapApp> = () =>
    NestFactory.create<NestExpressApplication>(AppModule),
) {
  const app = await createApp();
  app.enableCors();
  configureFrontendAssets(app, undefined, resolveFrontendBasePath(app));
  await app.listen(resolvePort(), resolveHost());
}

export async function bootstrap() {
  await startApp();
}
