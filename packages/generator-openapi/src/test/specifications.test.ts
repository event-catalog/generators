import { describe, expect, it } from 'vitest';
import { mergeSpecifications } from '../utils/specifications';

describe('mergeSpecifications', () => {
  it('keeps the legacy object shape when each type has one path', () => {
    expect(mergeSpecifications({ asyncapiPath: 'asyncapi.yml' }, [{ type: 'openapi', path: 'openapi.yml' }])).toEqual({
      asyncapiPath: 'asyncapi.yml',
      openapiPath: 'openapi.yml',
    });
  });

  it('keeps a generic specification, which the legacy object shape cannot hold', () => {
    const merged = mergeSpecifications(
      [{ type: 'generic', path: 'schema.xsd', name: 'Schema' }],
      [{ type: 'openapi', path: 'openapi.yml' }]
    );

    expect(merged).toEqual([
      { type: 'generic', path: 'schema.xsd', name: 'Schema' },
      { type: 'openapi', path: 'openapi.yml' },
    ]);
  });

  it('keeps a generic specification without a name as a list too', () => {
    expect(mergeSpecifications([{ type: 'generic', path: 'schema.xsd' }], [{ type: 'openapi', path: 'openapi.yml' }])).toEqual([
      { type: 'generic', path: 'schema.xsd' },
      { type: 'openapi', path: 'openapi.yml' },
    ]);
  });
});
