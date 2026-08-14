import { bootstrap } from './app-bootstrap';

export async function bootstrapHttp(): Promise<void> {
  await bootstrap();
}
