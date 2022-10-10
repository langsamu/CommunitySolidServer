import type { Server } from 'http';
import request from 'supertest';
import { BaseHttpServerFactory } from '../../../src/server/BaseHttpServerFactory';
import type { HttpHandler } from '../../../src/server/HttpHandler';
import type { HttpResponse } from '../../../src/server/HttpResponse';
import { getSocket } from '../../util/Util';

const isWin = process.platform === 'win32';

if (!isWin) {
  const handler: jest.Mocked<HttpHandler> = {
    handleSafe: jest.fn(async(input: { response: HttpResponse }): Promise<void> => {
      input.response.writeHead(200);
      input.response.end();
    }),
  } as any;

  describe('A Base HttpServerFactory (With Unix Sockets)', (): void => {
    let server: Server;
    const socket = getSocket('UnixSocketHttpServerFactory');
    const httpOptions = {
      http: true,
      showStackTrace: true,
    };

    afterAll(async(): Promise<void> => {
      server.close();
    });

    beforeEach(async(): Promise<void> => {
      jest.clearAllMocks();
    });

    it('sends incoming requests to the handler.', async(): Promise<void> => {
      const factory = new BaseHttpServerFactory(handler, httpOptions);
      server = factory.startServer(socket);
      await request(`http+unix://${socket.replace(/\//gui, '%2F')}`).get('/').set('Host', 'test.com').expect(200);

      expect(handler.handleSafe).toHaveBeenCalledTimes(1);
      expect(handler.handleSafe).toHaveBeenLastCalledWith({
        request: expect.objectContaining({
          headers: expect.objectContaining({ host: 'test.com' }),
        }),
        response: expect.objectContaining({}),
      });
    });

    it('throws an error on windows.', async(): Promise<void> => {
      const prevPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      const factory = new BaseHttpServerFactory(handler, httpOptions);
      expect((): void => {
        factory.startServer(socket);
      }).toThrow();

      Object.defineProperty(process, 'platform', {
        value: prevPlatform,
      });
    });
  });
} else {
  const handler: jest.Mocked<HttpHandler> = {
    handleSafe: jest.fn(async(input: { response: HttpResponse }): Promise<void> => {
      input.response.writeHead(200);
      input.response.end();
    }),
  } as any;

  describe('A Base HttpServerFactory (With Unix Sockets) on Windows', (): void => {
    const socket = getSocket('UnixSocketHttpServerFactory');
    const httpOptions = {
      http: true,
      showStackTrace: true,
    };

    it('throws an error when trying to start the server.', async(): Promise<void> => {
      const factory = new BaseHttpServerFactory(handler, httpOptions);
      expect((): void => {
        factory.startServer(socket);
      }).toThrow();
    });

    it('throws an error when trying to start the server (100% coverage on every platform).', async(): Promise<void> => {
      const prevPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      const factory = new BaseHttpServerFactory(handler, httpOptions);
      expect((): void => {
        factory.startServer(socket);
      }).toThrow();

      Object.defineProperty(process, 'platform', {
        value: prevPlatform,
      });
    });
  });
}
