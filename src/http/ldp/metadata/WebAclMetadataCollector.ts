import type { PermissionReader } from '../../../authorization/PermissionReader';
import { AclMode } from '../../../authorization/permissions/AclPermissionSet';
import type { AclPermissionSet } from '../../../authorization/permissions/AclPermissionSet';
import type { AccessMap } from '../../../authorization/permissions/Permissions';
import { AccessMode } from '../../../authorization/permissions/Permissions';
import { IdentifierSetMultiMap } from '../../../util/map/IdentifierMap';
import { ACL, AUTH } from '../../../util/Vocabularies';

import type { OperationMetadataCollectorInput } from './OperationMetadataCollector';
import { OperationMetadataCollector } from './OperationMetadataCollector';

const VALID_METHODS = new Set([ 'HEAD', 'GET' ]);
const VALID_ACL_MODES = new Set([ AccessMode.read, AccessMode.write, AccessMode.append, AclMode.control ]);

/**
 * Indicates which acl permissions are available on the requested resource.
 * Only adds public and agent permissions for HEAD/GET requests.
 */
export class WebAclMetadataCollector extends OperationMetadataCollector {
  private readonly permissionReader: PermissionReader;

  public constructor(permissionReader: PermissionReader) {
    super();
    this.permissionReader = permissionReader;
  }

  public async handle({ metadata, operation }: OperationMetadataCollectorInput): Promise<void> {
    const permissionSet = operation.availablePermissions?.get(operation.target);
    if (!permissionSet || !VALID_METHODS.has(operation.method)) {
      return;
    }
    const user: AclPermissionSet = permissionSet;
    let everyone: AclPermissionSet;

    // User is not authenticated so public permissions are the same as agent permissions.
    // Only the agent WebID matters since WebACL does not care about other credentials.
    if (!operation.credentials?.agent?.webId) {
      everyone = user;
    } else {
      // Need to determine public permissions.
      // Since we don't know which modes are relevant we ask the reader to check all of them.
      const requestedModes = new IdentifierSetMultiMap([[ operation.target, VALID_ACL_MODES ]]) as AccessMap;
      const permissionMap = await this.permissionReader.handleSafe({ credentials: {}, requestedModes });
      everyone = permissionMap.get(operation.target) ?? {};
    }

    const modes = new Set<AccessMode>([ ...Object.keys(user), ...Object.keys(everyone) ] as AccessMode[]);

    for (const mode of modes) {
      if (VALID_ACL_MODES.has(mode)) {
        const capitalizedMode = mode.charAt(0).toUpperCase() + mode.slice(1) as 'Read' | 'Write' | 'Append' | 'Control';
        if (everyone[mode]) {
          metadata.add(AUTH.terms.publicMode, ACL.terms[capitalizedMode]);
        }
        if (user[mode]) {
          metadata.add(AUTH.terms.userMode, ACL.terms[capitalizedMode]);
        }
      }
    }
  }
}
