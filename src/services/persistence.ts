// Local-first storage wrapper. Every call is safe to use without a
// surrounding try/catch: reads fall back to a default and writes report
// success instead of throwing, so private browsing, disabled storage or a
// full quota degrade the feature rather than crashing the app.
//
// `getVersioned`/`setVersioned` wrap a value in `{ version, value }` so a
// later schema change (My Leica Bag, Film Roll Companion) can migrate old
// stored data step by step instead of discarding it.

export interface Versioned<T> {
  version: number;
  value: T;
}

function safeGetRaw(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetRaw(key: string, raw: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to remove.
  }
}

export function getString(key: string): string | null {
  return safeGetRaw(key);
}

export function setString(key: string, value: string): boolean {
  return safeSetRaw(key, value);
}

/**
 * Reads a versioned JSON value. Returns `fallback` when nothing is stored,
 * the value is corrupt, or the stored version is older than `version` and no
 * `migrate` is given. `migrate` is applied one version step at a time until
 * the value reaches `version`.
 */
export function getVersioned<T>(
  key: string,
  version: number,
  fallback: T,
  migrate?: (value: unknown, fromVersion: number) => unknown
): T {
  const raw = safeGetRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<Versioned<unknown>>;
    if (typeof parsed !== "object" || parsed === null || typeof parsed.version !== "number") return fallback;
    let value = parsed.value;
    let from = parsed.version;
    while (from < version) {
      if (!migrate) return fallback;
      value = migrate(value, from);
      from += 1;
    }
    return value as T;
  } catch {
    return fallback;
  }
}

export function setVersioned<T>(key: string, version: number, value: T): boolean {
  try {
    return safeSetRaw(key, JSON.stringify({ version, value } satisfies Versioned<T>));
  } catch {
    return false;
  }
}
