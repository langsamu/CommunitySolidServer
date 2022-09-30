import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
import { BasicRepresentation } from '../../../../../src/http/representation/BasicRepresentation';
import type {
  SubscriptionInfo,
  SubscriptionStorage,
} from '../../../../../src/server/notifications/SubscriptionStorage';
import {
  WebSocket2021Emitter,
} from '../../../../../src/server/notifications/WebSocketSubscription2021/WebSocket2021Emitter';
import { flushPromises } from '../../../../util/Util';

describe('A WebSocket2021Emitter', (): void => {
  const info: SubscriptionInfo = {
    id: 'id',
    topic: 'http://example.com/foo',
    type: 'type',
    features: {},
    lastEmit: 0,
  };

  let webSocket: jest.Mocked<WebSocket>;
  let storage: jest.Mocked<SubscriptionStorage>;
  let emitter: WebSocket2021Emitter;

  beforeEach(async(): Promise<void> => {
    webSocket = new EventEmitter() as any;
    webSocket.send = jest.fn();
    webSocket.close = jest.fn();

    storage = {
      get: jest.fn(),
    } as any;

    emitter = new WebSocket2021Emitter(storage);
  });

  it('stores WebSockets to emit notifications.', async(): Promise<void> => {
    await expect(emitter.handle({ info, webSocket })).resolves.toBeUndefined();
    const representation = new BasicRepresentation('notification', 'text/plain');
    await expect(emitter.handle({ info, representation })).resolves.toBeUndefined();
    expect(webSocket.send).toHaveBeenCalledTimes(1);
    expect(webSocket.send).toHaveBeenLastCalledWith('notification');
  });

  it('does not emit notifications to WebSockets that were closed.', async(): Promise<void> => {
    await expect(emitter.handle({ info, webSocket })).resolves.toBeUndefined();
    webSocket.emit('close');
    const representation = new BasicRepresentation('notification', 'text/plain');
    await expect(emitter.handle({ info, representation })).resolves.toBeUndefined();
    expect(webSocket.send).toHaveBeenCalledTimes(0);
  });

  it('closes WebSockets that error.', async(): Promise<void> => {
    await expect(emitter.handle({ info, webSocket })).resolves.toBeUndefined();
    webSocket.emit('error');
    const representation = new BasicRepresentation('notification', 'text/plain');
    await expect(emitter.handle({ info, representation })).resolves.toBeUndefined();
    expect(webSocket.send).toHaveBeenCalledTimes(0);
  });

  it('destroys the representation if there is no matching WebSocket.', async(): Promise<void> => {
    const representation = new BasicRepresentation('notification', 'text/plain');
    await expect(emitter.handle({ info, representation })).resolves.toBeUndefined();
    expect(webSocket.send).toHaveBeenCalledTimes(0);
    expect(representation.data.destroyed).toBe(true);
  });

  it('can send to multiple matching WebSockets.', async(): Promise<void> => {
    const webSocket2: jest.Mocked<WebSocket> = new EventEmitter() as any;
    webSocket2.send = jest.fn();
    await expect(emitter.handle({ info, webSocket })).resolves.toBeUndefined();
    await expect(emitter.handle({ info, webSocket: webSocket2 })).resolves.toBeUndefined();
    const representation = new BasicRepresentation('notification', 'text/plain');
    await expect(emitter.handle({ info, representation })).resolves.toBeUndefined();
    expect(webSocket.send).toHaveBeenCalledTimes(1);
    expect(webSocket.send).toHaveBeenLastCalledWith('notification');
    expect(webSocket2.send).toHaveBeenCalledTimes(1);
    expect(webSocket2.send).toHaveBeenLastCalledWith('notification');
  });

  it('only sends to the matching WebSockets.', async(): Promise<void> => {
    const webSocket2: jest.Mocked<WebSocket> = new EventEmitter() as any;
    webSocket2.send = jest.fn();
    const info2: SubscriptionInfo = {
      ...info,
      id: 'other',
    };
    await expect(emitter.handle({ info, webSocket })).resolves.toBeUndefined();
    await expect(emitter.handle({ info: info2, webSocket: webSocket2 })).resolves.toBeUndefined();
    const representation = new BasicRepresentation('notification', 'text/plain');
    await expect(emitter.handle({ info, representation })).resolves.toBeUndefined();
    expect(webSocket.send).toHaveBeenCalledTimes(1);
    expect(webSocket.send).toHaveBeenLastCalledWith('notification');
    expect(webSocket2.send).toHaveBeenCalledTimes(0);
  });

  it('removes expired WebSockets.', async(): Promise<void> => {
    jest.useFakeTimers();

    // Need to create class after fake timers have been enabled
    emitter = new WebSocket2021Emitter(storage);

    const webSocket2: jest.Mocked<WebSocket> = new EventEmitter() as any;
    webSocket2.close = jest.fn();
    const webSocketOther: jest.Mocked<WebSocket> = new EventEmitter() as any;
    webSocketOther.close = jest.fn();
    const infoOther: SubscriptionInfo = {
      ...info,
      id: 'other',
    };
    await expect(emitter.handle({ info, webSocket })).resolves.toBeUndefined();
    await expect(emitter.handle({ info, webSocket: webSocket2 })).resolves.toBeUndefined();
    await expect(emitter.handle({ info: infoOther, webSocket: webSocketOther })).resolves.toBeUndefined();

    // `info` expired, `infoOther` did not
    storage.get.mockImplementation((id): any => {
      if (id === infoOther.id) {
        return infoOther;
      }
    });

    jest.advanceTimersToNextTimer();

    await flushPromises();

    expect(webSocket.close).toHaveBeenCalledTimes(1);
    expect(webSocket2.close).toHaveBeenCalledTimes(1);
    expect(webSocketOther.close).toHaveBeenCalledTimes(0);

    jest.useRealTimers();
  });
});
