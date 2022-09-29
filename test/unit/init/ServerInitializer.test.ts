import type { Server } from 'http';
import { ServerInitializer } from '../../../src/init/ServerInitializer';
import type { HttpServerFactory } from '../../../src/server/HttpServerFactory';
import type { ServerListener } from '../../../src/server/ServerListener';

describe('ServerInitializer', (): void => {
  let server: Server;
  let serverFactory: jest.Mocked<HttpServerFactory>;
  let serverListener: jest.Mocked<ServerListener>;
  let initializer: ServerInitializer;

  beforeEach(async(): Promise<void> => {
    server = {
      close: jest.fn((fn: () => void): void => fn()),
    } as any;
    serverFactory = {
      startServer: jest.fn().mockReturnValue(server),
    };
    serverListener = {
      handleSafe: jest.fn(),
    } as any;
    initializer = new ServerInitializer(serverFactory, serverListener, 3000);
  });

  it('starts an HTTP server and calls the listener.', async(): Promise<void> => {
    await initializer.handle();
    expect(serverFactory.startServer).toHaveBeenCalledTimes(1);
    expect(serverFactory.startServer).toHaveBeenLastCalledWith(3000);
    expect(serverListener.handleSafe).toHaveBeenCalledTimes(1);
    expect(serverListener.handleSafe).toHaveBeenLastCalledWith(server);
  });

  it('can stop the server.', async(): Promise<void> => {
    await initializer.handle();
    await expect(initializer.finalize()).resolves.toBeUndefined();
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('only tries to stop the server if it was initialized.', async(): Promise<void> => {
    await expect(initializer.finalize()).resolves.toBeUndefined();
    expect(server.close).toHaveBeenCalledTimes(0);
  });
});
