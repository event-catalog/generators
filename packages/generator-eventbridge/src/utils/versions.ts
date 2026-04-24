import { valid as semverValid, gt as semverGt, eq as semverEq, coerce as semverCoerce } from 'semver';

const tryCoerceToSemver = (version: string): string | null => {
  if (semverValid(version)) return version;
  const coerced = semverCoerce(version);
  return coerced ? coerced.version : null;
};

/**
 * Returns true when `incoming` is strictly newer than `existing`.
 *
 * Uses semver for comparison. Versions that aren't valid semver (e.g. EventBridge's
 * integer counters like "99", "100") are coerced via `semver.coerce` — "99" becomes
 * "99.0.0" — so they sort numerically as expected. When neither side can be coerced
 * we return `false`, so callers treat unknown versions as "not confidently newer"
 * and avoid demoting the cataloged entry.
 */
export const isNewerVersion = (incoming: string, existing: string): boolean => {
  if (!incoming || !existing) return false;
  if (incoming === existing) return false;

  const incomingSemver = tryCoerceToSemver(incoming);
  const existingSemver = tryCoerceToSemver(existing);
  if (!incomingSemver || !existingSemver) return false;

  return semverGt(incomingSemver, existingSemver);
};

/**
 * Returns true when `a` and `b` represent the same version, accounting for semver
 * coercion (e.g. "1" and "1.0.0" are considered equal).
 */
export const isSameVersion = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  const aSemver = tryCoerceToSemver(a);
  const bSemver = tryCoerceToSemver(b);
  if (!aSemver || !bSemver) return false;
  return semverEq(aSemver, bSemver);
};
