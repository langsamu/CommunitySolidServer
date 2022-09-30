import type { WebSocket } from 'ws';
import type { SingleThreaded } from '../../../init/cluster/SingleThreaded';
import { getLoggerFor } from '../../../logging/LogUtil';
import { AsyncHandler } from '../../../util/handlers/AsyncHandler';
import type { SetMultiMap } from '../../../util/map/SetMultiMap';
import { WrappedSetMultiMap } from '../../../util/map/WrappedSetMultiMap';
import { readableToString } from '../../../util/StreamUtil';
import { setSafeInterval } from '../../../util/TimerUtil';
import type { NotificationEmitter, NotificationEmitterInput } from '../NotificationEmitter';
import type { SubscriptionStorage } from '../SubscriptionStorage';
import type { WebSocket2021Handler, WebSocket2021HandlerInput } from './WebSocket2021Handler';

/**
 * Keeps track of the WebSockets that were opened for a WebSocketSubscription2021 subscription
 * and uses them to emit events when necessary.
 *
 * SingleThreaded since the opened WebSocket might not be stored in the same thread
 * as the one that emits a relevant event.
 *
 * `cleanupTimer` defines in minutes how often the stored WebSockets are closed
 * if their corresponding subscription has expired.
 * Defaults to 60 minutes.
 * Although the WebSocket connection might still be open,
 * if the subscription has expired no notifications will be sent.
 */
export class WebSocket2021Emitter extends AsyncHandler<NotificationEmitterInput | WebSocket2021HandlerInput>
  implements NotificationEmitter, WebSocket2021Handler, SingleThreaded {
  protected readonly logger = getLoggerFor(this);

  private readonly storage: SubscriptionStorage;
  private readonly webSockets: SetMultiMap<string, WebSocket>;

  public constructor(storage: SubscriptionStorage, cleanupTimer = 60) {
    super();

    this.storage = storage;
    this.webSockets = new WrappedSetMultiMap<string, WebSocket>();

    const timer = setSafeInterval(this.logger,
      'Failed to remove closed WebSockets',
      this.closeExpiredSockets.bind(this),
      cleanupTimer * 60 * 1000);
    timer.unref();
  }

  public async handle(input: NotificationEmitterInput): Promise<void>;
  public async handle(input: WebSocket2021HandlerInput): Promise<void>;
  public async handle(input: NotificationEmitterInput | WebSocket2021HandlerInput): Promise<void> {
    if (this.isWebSocket2021HandlerInput(input)) {
      // Called as a WebSocket2021Handler: store the WebSocket
      const { webSocket, info } = input;
      this.webSockets.add(info.id, webSocket);
      webSocket.on('error', (): boolean => this.webSockets.deleteEntry(info.id, webSocket));
      webSocket.on('close', (): boolean => this.webSockets.deleteEntry(info.id, webSocket));
    } else {
      // Called as a NotificationEmitter: emit the notification
      const webSockets = this.webSockets.get(input.info.id);
      if (webSockets) {
        const data = await readableToString(input.representation.data);
        for (const webSocket of webSockets) {
          webSocket.send(data);
        }
      } else {
        input.representation.data.destroy();
      }
    }
  }

  private isWebSocket2021HandlerInput(input: NotificationEmitterInput | WebSocket2021HandlerInput):
    input is WebSocket2021HandlerInput {
    return Boolean((input as WebSocket2021HandlerInput).webSocket);
  }

  /**
   * Close all WebSockets that are attached to a subscription that no longer exists.
   */
  private async closeExpiredSockets(): Promise<void> {
    this.logger.debug('Closing expired WebSockets');
    for (const [ id, sockets ] of this.webSockets.entrySets()) {
      const result = await this.storage.get(id);
      if (!result) {
        for (const socket of sockets) {
          // Due to the attached listener this also deletes the entries
          socket.close();
        }
      }
    }
    this.logger.debug('Finished closing expired WebSockets');
  }
}
