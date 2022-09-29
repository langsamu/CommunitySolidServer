import type { Server, IncomingMessage, ServerResponse } from 'http';
import { getLoggerFor } from '../logging/LogUtil';
import { isError } from '../util/errors/ErrorUtil';
import { guardStream } from '../util/GuardedStream';
import type { HttpHandler } from './HttpHandler';
import { ServerListener } from './ServerListener';

/**
 * A {@link ServerListener} that attaches an {@link HttpHandler} to the `request` event of a {@link Server}.
 * All incoming requests will be sent to the provided handler.
 * Failsafes are added to make sure a valid response is sent in case something goes wrong.
 *
 * The `showStackTrace` parameter can be used to add stack traces to error outputs.
 */
export class HandlerServerListener extends ServerListener {
  protected readonly logger = getLoggerFor(this);

  /** The main HttpHandler */
  private readonly handler: HttpHandler;
  private readonly showStackTrace: boolean;

  public constructor(handler: HttpHandler, showStackTrace = false) {
    super();
    this.handler = handler;
    this.showStackTrace = showStackTrace;
  }

  public async handle(server: Server): Promise<void> {
    server.on('request',
      async(request: IncomingMessage, response: ServerResponse): Promise<void> => {
        try {
          this.logger.info(`Received ${request.method} request for ${request.url}`);
          const guardedRequest = guardStream(request);
          guardedRequest.on('error', (error): void => {
            this.logger.error(`Request error: ${error.message}`);
          });
          await this.handler.handleSafe({ request: guardedRequest, response });
        } catch (error: unknown) {
          let errMsg: string;
          if (!isError(error)) {
            errMsg = `Unknown error: ${error}.\n`;
          } else if (this.showStackTrace && error.stack) {
            errMsg = `${error.stack}\n`;
          } else {
            errMsg = `${error.name}: ${error.message}\n`;
          }
          this.logger.error(errMsg);
          if (response.headersSent) {
            response.end();
          } else {
            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            response.writeHead(500).end(errMsg);
          }
        } finally {
          if (!response.headersSent) {
            response.writeHead(404).end();
          }
        }
      });
  }
}
