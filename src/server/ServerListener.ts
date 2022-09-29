import type { Server } from 'http';
import { AsyncHandler } from '../util/handlers/AsyncHandler';

/**
 * Listens to specific events from a {@link Server}.
 */
export abstract class ServerListener extends AsyncHandler<Server> {}
