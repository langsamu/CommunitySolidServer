import { createHash } from 'crypto';
import { object, string } from 'yup';
import type { ResourceIdentifier } from '../../http/representation/ResourceIdentifier';
import type { IdentifierGenerator } from '../../pods/generate/IdentifierGenerator';
import type { PodManager } from '../../pods/PodManager';
import { joinUrl } from '../../util/PathUtil';
import type { AccountStore } from '../account/AccountStore';
import { getRequiredAccount } from '../account/AccountUtil';
import type { JsonInteractionHandlerInput, JsonRepresentation } from './JsonInteractionHandler';
import { JsonInteractionHandler } from './JsonInteractionHandler';
import type { AccountPodRoute, AccountWebIdRoute } from './routing/InteractionRoute';
import { parseSchema } from './ViewUtil';
import type { JsonView } from './ViewUtil';

// TODO: document that generated WebID is automatically linked but can be unlinked
//       or only if no WebID was provided?
//       ^ just take an extra input parameter "register"...
//       or do nothing but only add oidcissuer triple
const inSchema = object({
  name: string().trim().min(1).optional(),
  settings: object({
    webId: string().trim().optional(),
  }).optional(),
});

// TODO:
export interface CreatePodHandlerArgs {
  podManager: PodManager;
  identifierGenerator: IdentifierGenerator;
  webIdSuffix: string;
  accountStore: AccountStore;
  podRoute: AccountPodRoute;
  webIdRoute: AccountWebIdRoute;
  baseUrl: string;
  allowRoot: boolean;
}

// TODO:
export class CreatePodHandler extends JsonInteractionHandler implements JsonView {
  // TODO: many parameters, can sone be combined somewhere?
  private readonly podManager: PodManager;
  private readonly identifierGenerator: IdentifierGenerator;
  // TODO: this could also be a route
  private readonly webIdSuffix: string;
  private readonly accountStore: AccountStore;
  private readonly podRoute: AccountPodRoute;
  private readonly webIdRoute: AccountWebIdRoute;
  private readonly baseUrl: string;

  private readonly inSchema: typeof inSchema;

  public constructor(args: CreatePodHandlerArgs) {
    super();
    this.podManager = args.podManager;
    this.identifierGenerator = args.identifierGenerator;
    this.webIdSuffix = args.webIdSuffix;
    this.podRoute = args.podRoute;
    this.webIdRoute = args.webIdRoute;
    this.accountStore = args.accountStore;
    this.baseUrl = args.baseUrl;

    this.inSchema = inSchema.clone();

    // TODO: check if this works
    if (!args.allowRoot) {
      this.inSchema.fields.name = this.inSchema.fields.name.required();
    }
  }

  public async getView(): Promise<JsonRepresentation> {
    return { json: parseSchema(this.inSchema) };
  }

  public async handle({ json, accountId }: JsonInteractionHandlerInput): Promise<JsonRepresentation> {
    const account = await getRequiredAccount(this.accountStore, accountId);

    // In case the class was not initialized with allowRoot: false, missing name values will result in an error
    const { name, settings } = await this.inSchema.validate(json);
    let podBaseUrl: ResourceIdentifier;
    if (name) {
      podBaseUrl = this.identifierGenerator.generate(name);
    } else {
      podBaseUrl = { path: this.baseUrl };
    }

    const generatedWebId = joinUrl(podBaseUrl.path, this.webIdSuffix);

    const webId = settings?.webId ?? generatedWebId;

    // TODO: use podsettings interface and/or fix that one
    const podSettings = {
      ...settings,
      podBaseUrl: podBaseUrl.path,
      webId,
      oidcIssuer: this.baseUrl,
    };

    await this.podManager.createPod(podBaseUrl, podSettings, !name);
    // This could cause issues if a user later also creates a pod with name `root`.
    // But this brings other issues of making pods in pods that would need to be resolved anyway.
    const path = this.podRoute.getPath({ accountId, podId: encodeURIComponent(name ?? 'root') });
    account.pods[podBaseUrl.path] = path!;

    // Link the generated WebID to the account
    // TODO: this needs to be utility since duplication!
    // TODO: can this class take a WebIDLinker as input?
    //       ^ or have a wrapper that takes both pod creator and web id linker as input?
    // TODO: could also not do this even though we add the oidcissuer triple
    const webIdHash = createHash('sha256').update(generatedWebId).digest('hex');
    const webIdPath = this.webIdRoute.getPath({ accountId, webIdHash });
    account.webIds[generatedWebId] = webIdPath!;

    // TODO: update account first and remove again in case of error? Prevents pod being created without linked to account
    //       ^ (this is what we used to do)
    await this.accountStore.update(account);

    return { json: { baseUrl: podBaseUrl.path, webId }};
  }
}
