import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 4600;

type BootstrapApp = {
  enableCors(): void;
  listen(port: number, host: string): Promise<unknown>;
};

export async function startApp(
  createApp: () => Promise<BootstrapApp> = () => NestFactory.create(AppModule),
) {
  const app = await createApp();
  app.enableCors();
  await app.listen(process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT, DEFAULT_HOST);
}

export async function bootstrap() {
  await startApp();
}
