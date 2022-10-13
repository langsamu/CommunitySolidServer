import { DataFactory, Parser } from 'n3';
import type { Operation } from '../../../../../src/http/Operation';
import { BasicRepresentation } from '../../../../../src/http/representation/BasicRepresentation';
import type { HttpRequest } from '../../../../../src/server/HttpRequest';
import type { HttpResponse } from '../../../../../src/server/HttpResponse';
import { WebHookWebId } from '../../../../../src/server/notifications/WebHookSubscription2021/WebHookWebId';
import { readableToString } from '../../../../../src/util/StreamUtil';
import { SOLID } from '../../../../../src/util/Vocabularies';
const { namedNode, quad } = DataFactory;

describe('A WebHookWebId', (): void => {
  const request: HttpRequest = {} as any;
  const response: HttpResponse = {} as any;
  let operation: Operation;
  const baseUrl = 'http://example.com/';
  let webIdHandler: WebHookWebId;

  beforeEach(async(): Promise<void> => {
    operation = {
      method: 'GET',
      target: { path: 'http://example.com/.notifications/webhooks/webid' },
      preferences: {},
      body: new BasicRepresentation(),
    };

    webIdHandler = new WebHookWebId(baseUrl);
  });

  it('returns a solid:oidcIssuer triple.', async(): Promise<void> => {
    const turtle = await webIdHandler.handle({ operation, request, response });
    expect(turtle.statusCode).toBe(200);
    expect(turtle.metadata?.contentType).toBe('text/turtle');
    expect(turtle.data).toBeDefined();
    const quads = new Parser({ baseIRI: operation.target.path }).parse(await readableToString(turtle.data!));
    expect(quads).toHaveLength(1);
    expect(quads).toEqual([ quad(
      namedNode('http://example.com/.notifications/webhooks/webid'),
      SOLID.terms.oidcIssuer,
      namedNode('http://example.com'),
    ) ]);
  });
});
