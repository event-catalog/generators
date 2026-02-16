type SpecificationType = 'openapi' | 'asyncapi' | 'graphql';

type LegacySpecifications = {
  openapiPath?: string;
  asyncapiPath?: string;
  graphqlPath?: string;
};

export type Specification = {
  type: SpecificationType;
  path: string;
  name?: string;
  headers?: Record<string, string>;
};

export type Specifications = LegacySpecifications | Specification[] | undefined;

const toArray = (specifications: Specifications): Specification[] => {
  if (!specifications) return [];

  if (Array.isArray(specifications)) {
    return specifications
      .filter((spec) => spec?.type && spec?.path)
      .map((spec) => ({
        type: spec.type,
        path: spec.path,
        ...(spec.name ? { name: spec.name } : {}),
        ...(spec.headers ? { headers: spec.headers } : {}),
      }));
  }

  const output: Specification[] = [];

  if (specifications.openapiPath) {
    output.push({ type: 'openapi', path: specifications.openapiPath });
  }

  if (specifications.asyncapiPath) {
    output.push({ type: 'asyncapi', path: specifications.asyncapiPath });
  }

  if (specifications.graphqlPath) {
    output.push({ type: 'graphql', path: specifications.graphqlPath });
  }

  return output;
};

const dedupe = (specifications: Specification[]) => {
  const unique = new Map<string, Specification>();

  for (const spec of specifications) {
    const key = `${spec.type}:${spec.path}`;
    if (!unique.has(key)) {
      unique.set(key, spec);
    }
  }

  return [...unique.values()];
};

const canUseLegacyFormat = (specifications: Specification[]) => {
  const countByType: Record<SpecificationType, number> = {
    openapi: 0,
    asyncapi: 0,
    graphql: 0,
  };

  for (const spec of specifications) {
    countByType[spec.type] += 1;

    // legacy object shape cannot represent name / headers
    if (spec.name || spec.headers) {
      return false;
    }
  }

  return Object.values(countByType).every((count) => count <= 1);
};

const toLegacy = (specifications: Specification[]): LegacySpecifications => {
  const legacy: LegacySpecifications = {};

  for (const spec of specifications) {
    if (spec.type === 'openapi') legacy.openapiPath = spec.path;
    if (spec.type === 'asyncapi') legacy.asyncapiPath = spec.path;
    if (spec.type === 'graphql') legacy.graphqlPath = spec.path;
  }

  return legacy;
};

export const mergeSpecifications = (
  existing: Specifications,
  incoming: Specifications,
  options?: { preferArray?: boolean }
): Specifications => {
  const merged = dedupe([...toArray(existing), ...toArray(incoming)]);

  if (merged.length === 0) return undefined;

  if (options?.preferArray) {
    return merged;
  }

  if (canUseLegacyFormat(merged)) {
    return toLegacy(merged);
  }

  return merged;
};
