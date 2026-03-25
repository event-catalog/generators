import { RouteFilter } from '../types';

type MessageWithPath = {
  id: string;
  version: string;
  path: string;
};

type Pointer = {
  id: string;
  version?: string;
};

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

const matchesWildcard = (operationPath: string, pattern: string): boolean => {
  // Convert wildcard pattern to regex: * matches one or more path segments
  const regexStr = '^' + pattern.replace(/\*/g, '[^/]+(/[^/]+)*') + '$';
  return new RegExp(regexStr).test(operationPath);
};

const matchesSingleFilter = (operationPath: string, filter: RouteFilter): boolean => {
  const checks: boolean[] = [];

  if (filter.path !== undefined) {
    const paths = toArray(filter.path);
    checks.push(paths.some((p) => operationPath === p));
  }

  if (filter.prefix !== undefined) {
    const prefixes = toArray(filter.prefix);
    checks.push(prefixes.some((p) => operationPath.startsWith(p)));
  }

  if (filter.suffix !== undefined) {
    const suffixes = toArray(filter.suffix);
    checks.push(suffixes.some((s) => operationPath.endsWith(s)));
  }

  if (filter.match !== undefined) {
    const patterns = toArray(filter.match);
    checks.push(patterns.some((p) => matchesWildcard(operationPath, p)));
  }

  // All specified keys must match (intersection within a single filter)
  return checks.length > 0 && checks.every(Boolean);
};

export const filterMessagesByRoutes = (allMessages: MessageWithPath[], routes?: RouteFilter[]): Pointer[] => {
  // No routes = all messages
  if (!routes || routes.length === 0) {
    return allMessages.map(({ id, version }) => ({ id, version }));
  }

  const matched = new Map<string, Pointer>();

  for (const message of allMessages) {
    // Union across route filter objects
    for (const route of routes) {
      if (matchesSingleFilter(message.path, route)) {
        matched.set(message.id, { id: message.id, version: message.version });
        break; // Already matched, no need to check more filters
      }
    }
  }

  return Array.from(matched.values());
};

export const mergeReceives = (existing: Pointer[], incoming: Pointer[]): Pointer[] => {
  const merged = new Map<string, Pointer>();

  // Start with existing
  for (const entry of existing) {
    merged.set(entry.id, { ...entry });
  }

  // Merge incoming: update version if exists, add if new
  for (const entry of incoming) {
    const current = merged.get(entry.id);
    if (current) {
      // Only update version if the existing one has a version (not "latest")
      if (current.version !== undefined) {
        current.version = entry.version;
      }
    } else {
      merged.set(entry.id, { ...entry });
    }
  }

  return Array.from(merged.values());
};
