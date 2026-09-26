// Confidence metadata for a value the app displays or computes with.
//
// Every non-obvious number in this app — a blade count, a film's latitude, a
// finder's field of view — comes from somewhere, and that somewhere ranges
// from "derived from physics" to "nobody publishes this, so it's a guess."
// Attaching a Provenance lets the UI (eventually) say which is which instead
// of presenting all values with equal, false confidence.

export type ProvenanceKind =
  | "calculated"
  | "published"
  | "measured"
  | "calibrated"
  | "approximate"
  | "illustrative";

export interface Provenance {
  kind: ProvenanceKind;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  lastVerifiedAt?: string;
}
