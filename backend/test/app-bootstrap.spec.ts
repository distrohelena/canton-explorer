import { describe, expect, it, jest } from '@jest/globals';
import { DEFAULT_HOST, DEFAULT_PORT, startApp } from '../src/app-bootstrap';

describe('startApp', () => {
  it('binds the Nest app to 0.0.0.0', async () => {
    process.env.PORT = '4600';

    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const createApp = jest.fn().mockResolvedValue({
      enableCors,
      listen,
    });

    await startApp(createApp);

    expect(createApp).toHaveBeenCalledTimes(1);
    expect(enableCors).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(DEFAULT_PORT, DEFAULT_HOST);
  });
});
