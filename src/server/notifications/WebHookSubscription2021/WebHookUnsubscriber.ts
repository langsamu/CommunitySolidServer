import type { CredentialsExtractor } from '../../../authentication/CredentialsExtractor';
import { ResetResponseDescription } from '../../../http/output/response/ResetResponseDescription';
import type { ResponseDescription } from '../../../http/output/response/ResponseDescription';
import { getLoggerFor } from '../../../logging/LogUtil';
import { ForbiddenHttpError } from '../../../util/errors/ForbiddenHttpError';
import { NotFoundHttpError } from '../../../util/errors/NotFoundHttpError';
import type { OperationHttpHandlerInput } from '../../OperationHttpHandler';
import { OperationHttpHandler } from '../../OperationHttpHandler';
import type { SubscriptionStorage } from '../SubscriptionStorage';
import type { WebHookFeatures } from './WebHookSubscription2021';

/**
 * Allows clients to unsubscribe from a WebHookSubscription2021.
 * Assumed the trailing part of the incoming URL is the identifier of the subscription.
 * Should be wrapped in a route handler that only allows `DELETE` operations.
 */
export class WebHookUnsubscriber extends OperationHttpHandler {
  protected readonly logger = getLoggerFor(this);

  private readonly credentialsExtractor: CredentialsExtractor;
  private readonly storage: SubscriptionStorage<WebHookFeatures>;

  public constructor(credentialsExtractor: CredentialsExtractor, storage: SubscriptionStorage<WebHookFeatures>) {
    super();
    this.credentialsExtractor = credentialsExtractor;
    this.storage = storage;
  }

  public async handle({ operation, request }: OperationHttpHandlerInput): Promise<ResponseDescription> {
    // Split always returns an array of at least length 1 so result can not be undefined
    const id = operation.target.path.split(/\//u).pop()!;

    const info = await this.storage.get(id);

    if (!info) {
      throw new NotFoundHttpError();
    }

    const credentials = await this.credentialsExtractor.handleSafe(request);

    if (info.features.webId !== credentials.agent?.webId) {
      throw new ForbiddenHttpError();
    }

    this.logger.debug(`Deleting WebHook subscription ${id}`);
    await this.storage.delete(id);

    return new ResetResponseDescription();
  }
}
