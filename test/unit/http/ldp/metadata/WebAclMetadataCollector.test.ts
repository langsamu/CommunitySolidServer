import 'jest-rdf';
import type { PermissionReader } from '../../../../../src/authorization/PermissionReader';
import { WebAclMetadataCollector } from '../../../../../src/http/ldp/metadata/WebAclMetadataCollector';
import type { Operation } from '../../../../../src/http/Operation';
import { BasicRepresentation } from '../../../../../src/http/representation/BasicRepresentation';
import { RepresentationMetadata } from '../../../../../src/http/representation/RepresentationMetadata';
import { IdentifierMap } from '../../../../../src/util/map/IdentifierMap';
import { ACL, AUTH } from '../../../../../src/util/Vocabularies';

describe('A WebAclMetadataCollector', (): void => {
  const target = { path: 'http://example.com/foo' };
  let operation: Operation;
  let metadata: RepresentationMetadata;
  let permissionReader: jest.Mocked<PermissionReader>;
  let writer: WebAclMetadataCollector;

  beforeEach(async(): Promise<void> => {
    operation = {
      method: 'GET',
      target,
      preferences: {},
      body: new BasicRepresentation(),
    };

    metadata = new RepresentationMetadata();

    permissionReader = {
      handleSafe: jest.fn().mockResolvedValue({ read: true }),
    } as any;

    writer = new WebAclMetadataCollector(permissionReader);
  });

  it('adds no metadata if there is no target entry.', async(): Promise<void> => {
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(0);

    operation.availablePermissions = new IdentifierMap();
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(0);
  });

  it('adds no metadata if there are no permissions.', async(): Promise<void> => {
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(0);

    operation.availablePermissions = new IdentifierMap([[ target, {}]]);
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(0);
  });

  it('adds no metadata if the method is wrong.', async(): Promise<void> => {
    operation.availablePermissions = new IdentifierMap([[ target, { read: true, write: false }]]);
    operation.method = 'DELETE';
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(0);
  });

  it('adds corresponding metadata for all permissions present.', async(): Promise<void> => {
    operation.availablePermissions = new IdentifierMap([[ target, { read: true, write: false }]]);
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(2);
    expect(metadata.get(AUTH.terms.userMode)).toEqualRdfTerm(ACL.terms.Read);
    expect(metadata.get(AUTH.terms.publicMode)).toEqualRdfTerm(ACL.terms.Read);
  });

  it('ignores unknown modes.', async(): Promise<void> => {
    operation.availablePermissions = new IdentifierMap([[ target, { read: true, create: true }]]);
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(2);
    expect(metadata.get(AUTH.terms.userMode)).toEqualRdfTerm(ACL.terms.Read);
    expect(metadata.get(AUTH.terms.publicMode)).toEqualRdfTerm(ACL.terms.Read);
  });

  it('determines public permissions in case the request was authenticated.', async(): Promise<void> => {
    operation.credentials = { agent: { webId: 'http://example.com/profile/card#me' }};
    operation.availablePermissions = new IdentifierMap([[ target, { read: false, write: true }]]);
    permissionReader.handleSafe.mockResolvedValue(new IdentifierMap([[ target, { read: true, write: false }]]));
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(2);
    expect(metadata.get(AUTH.terms.userMode)).toEqualRdfTerm(ACL.terms.Write);
    expect(metadata.get(AUTH.terms.publicMode)).toEqualRdfTerm(ACL.terms.Read);
  });

  it('defaults to no public permissions if the permission reader has no matching result.', async(): Promise<void> => {
    operation.credentials = { agent: { webId: 'http://example.com/profile/card#me' }};
    operation.availablePermissions = new IdentifierMap([[ target, { read: false, write: true }]]);
    permissionReader.handleSafe
      .mockResolvedValue(new IdentifierMap([[{ path: 'http://example/wrong' }, { read: true, write: false }]]));
    await expect(writer.handle({ metadata, operation })).resolves.toBeUndefined();
    expect(metadata.quads()).toHaveLength(1);
    expect(metadata.get(AUTH.terms.userMode)).toEqualRdfTerm(ACL.terms.Write);
    expect(metadata.get(AUTH.terms.publicMode)).toBeUndefined();
  });
});
