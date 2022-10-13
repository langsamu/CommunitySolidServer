import { OkResponseDescription } from '../../../http/output/response/OkResponseDescription';
import type { ResponseDescription } from '../../../http/output/response/ResponseDescription';
import { BasicRepresentation } from '../../../http/representation/BasicRepresentation';
import { TEXT_TURTLE } from '../../../util/ContentTypes';
import { trimTrailingSlashes } from '../../../util/PathUtil';
import type { OperationHttpHandlerInput } from '../../OperationHttpHandler';
import { OperationHttpHandler } from '../../OperationHttpHandler';

/**
 * The WebHookSubscription2021 requires the server to have a WebID
 * that is used during the generation of the DPoP headers.
 * There are no real specifications about what this should contain or look like,
 * so we just return a turtle document that contains a solid:oidcIssuer triple for now.
 * This way we confirm that our server was allowed to sign the token.
 */
export class WebHookWebId extends OperationHttpHandler {
  private readonly issuer: string;

  public constructor(baseUrl: string) {
    super();
    this.issuer = trimTrailingSlashes(baseUrl);
  }

  public async handle(input: OperationHttpHandlerInput): Promise<ResponseDescription> {
    const webId = `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<> solid:oidcIssuer <${this.issuer}>.`;

    const representation = new BasicRepresentation(webId, input.operation.target, TEXT_TURTLE);
    return new OkResponseDescription(representation.metadata, representation.data);
  }
}
