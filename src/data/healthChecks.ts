// The health check's guided list (#42): what a careful buyer or owner looks
// at besides the shutter. General handling checks, nothing model-specific
// that would need a source; each one's words live in the i18n dictionaries
// (health.check.<id> and health.check.<id>.how).

import type { Body } from "./gear";

export interface HealthCheck {
  id: string;
  /** Which bodies it applies to. */
  applies: (body: Body | undefined) => boolean;
  /** A tool in the app that helps with it. */
  tool?: "rfcheck" | "live";
}

const isFilm = (b?: Body) => !b || b.medium === "film";

export const HEALTH_CHECKS: HealthCheck[] = [
  { id: "body", applies: () => true },
  { id: "curtains", applies: isFilm },
  { id: "advance", applies: isFilm },
  { id: "infinity", applies: (b) => !b || b.rangefinder !== undefined, tool: "rfcheck" },
  { id: "finder", applies: () => true },
  { id: "meter", applies: (b) => !b || b.meter !== "none", tool: "live" },
  { id: "lens", applies: () => true },
  { id: "leaks", applies: isFilm },
];

export function checksFor(body: Body | undefined): HealthCheck[] {
  return HEALTH_CHECKS.filter((c) => c.applies(body));
}
