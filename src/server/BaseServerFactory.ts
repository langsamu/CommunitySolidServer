import { readFileSync } from 'fs';
import type { Server } from 'http';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { URL } from 'url';
import { getLoggerFor } from '../logging/LogUtil';
import type { HttpServerFactory } from './HttpServerFactory';

/**
 * Options to be used when creating the server.
 * Due to Components.js not supporting external types, this has been simplified (for now?).
 * The common https keys here (key/cert/pfx) will be interpreted as file paths that need to be read
 * before passing the options to the `createServer` function.
 */
export interface BaseServerFactoryOptions {
  /**
   * If the server should start as an HTTP or HTTPS server.
   */
  https?: boolean;

  key?: string;
  cert?: string;

  pfx?: string;
  passphrase?: string;
}

/**
 * Creates an HTTP(S) server listening to the requested port using the native Node.js `http` module.
 *
 * The server does not do anything, listeners should be attached to add behavior.
 */
export class BaseServerFactory implements HttpServerFactory {
  protected readonly logger = getLoggerFor(this);

  private readonly options: BaseServerFactoryOptions;

  public constructor(options: BaseServerFactoryOptions = { https: false }) {
    this.options = { ...options };
  }

  /**
   * Creates and starts an HTTP(S) server
   * @param port - Port on which the server listens
   */
  public startServer(port: number): Server {
    const protocol = this.options.https ? 'https' : 'http';
    const url = new URL(`${protocol}://localhost:${port}/`).href;
    this.logger.info(`Listening to server at ${url}`);

    const createServer = this.options.https ? createHttpsServer : createHttpServer;
    const options = this.createServerOptions();

    const server = createServer(options);

    return server.listen(port);
  }

  private createServerOptions(): BaseServerFactoryOptions {
    const options = { ...this.options };
    for (const id of [ 'key', 'cert', 'pfx' ] as const) {
      const val = options[id];
      if (val) {
        options[id] = readFileSync(val, 'utf8');
      }
    }
    return options;
  }
}
