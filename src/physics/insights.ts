// Learn-from-your-negatives / scan feedback loop: transparent statistics over
// the user's own explicit outcome tags and each frame's shooting metadata —
// no image analysis, no automated inference presented as fact, per the
// spec's v1 requirement. Every statement traces back to specific frame
// numbers, and any bucket with too few tags to be meaningful is withheld
// rather than guessed at.

import type { Frame, OutcomeTag } from "../state/rollExport";

/** Below this many tags in a bucket, don't state a trend — just say so isn't enough data. */
export const MIN_SAMPLE = 3;

export interface Insight {
  id: string;
  text: string;
  frameNumbers: number[];
}

export interface NotEnoughData {
  tag: OutcomeTag;
  label: string;
  count: number;
  needed: number;
}

export interface InsightReport {
  insights: Insight[];
  notEnoughData: NotEnoughData[];
  tagCounts: Record<OutcomeTag, number>;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function signed(evOffset: number): string {
  return `${evOffset >= 0 ? "+" : ""}${evOffset.toFixed(1)} EV`;
}

/** Most common value in a list, alongside how many frames share it. */
function mode<T>(items: { value: T; number: number }[]): { value: T; count: number; frameNumbers: number[] } | null {
  if (items.length === 0) return null;
  const buckets = new Map<string, { value: T; frameNumbers: number[] }>();
  for (const item of items) {
    const key = JSON.stringify(item.value);
    const bucket = buckets.get(key);
    if (bucket) bucket.frameNumbers.push(item.number);
    else buckets.set(key, { value: item.value, frameNumbers: [item.number] });
  }
  const [top] = [...buckets.values()].sort((a, b) => b.frameNumbers.length - a.frameNumbers.length);
  return { value: top.value, count: top.frameNumbers.length, frameNumbers: top.frameNumbers };
}

const TAG_LABELS: Record<OutcomeTag, string> = {
  good: "good",
  "missed-focus": "missed-focus",
  "motion-blur": "motion-blur",
  underexposed: "underexposed",
  overexposed: "overexposed",
};

/**
 * Aggregates a roll/card's tagged frames into plain-language trend
 * statements. Each frame contributes to at most one bucket per tag it
 * carries (a frame has exactly one outcome tag), so buckets never
 * double-count a frame.
 */
export function computeInsights(frames: Frame[]): InsightReport {
  const tagCounts = { good: 0, "missed-focus": 0, "motion-blur": 0, underexposed: 0, overexposed: 0 } as Record<OutcomeTag, number>;
  for (const f of frames) if (f.outcome) tagCounts[f.outcome]++;

  const insights: Insight[] = [];
  const notEnoughData: NotEnoughData[] = [];
  const byTag = (tag: OutcomeTag) => frames.filter((f) => f.outcome === tag);

  const motionBlur = byTag("motion-blur");
  if (motionBlur.length < MIN_SAMPLE) {
    if (motionBlur.length > 0) notEnoughData.push({ tag: "motion-blur", label: TAG_LABELS["motion-blur"], count: motionBlur.length, needed: MIN_SAMPLE });
  } else {
    const top = mode(motionBlur.map((f) => ({ value: { shutterSec: f.meta.shutterSec, focalMm: f.meta.focalMm }, number: f.number })));
    if (top) {
      const shutterLabel = top.value.shutterSec >= 1 ? `${top.value.shutterSec}s` : `1/${Math.round(1 / top.value.shutterSec)}s`;
      insights.push({
        id: "motion-blur",
        text: `Most shake tags (${top.count} of ${motionBlur.length}) occur at ${shutterLabel} with a ${top.value.focalMm} mm lens.`,
        frameNumbers: top.frameNumbers,
      });
    }
  }

  const missedFocus = byTag("missed-focus");
  if (missedFocus.length < MIN_SAMPLE) {
    if (missedFocus.length > 0) notEnoughData.push({ tag: "missed-focus", label: TAG_LABELS["missed-focus"], count: missedFocus.length, needed: MIN_SAMPLE });
  } else {
    const top = mode(missedFocus.map((f) => ({ value: f.meta.fNumber, number: f.number })));
    if (top) {
      insights.push({
        id: "missed-focus",
        text: `Most missed-focus tags (${top.count} of ${missedFocus.length}) happen at f/${top.value}.`,
        frameNumbers: top.frameNumbers,
      });
    }
  }

  const good = byTag("good");
  if (good.length < MIN_SAMPLE) {
    if (good.length > 0) notEnoughData.push({ tag: "good", label: TAG_LABELS.good, count: good.length, needed: MIN_SAMPLE });
  } else {
    const avg = mean(good.map((f) => f.meta.evOffset));
    insights.push({
      id: "good-ev",
      text: `Your ${good.length} "good" frames average ${signed(avg)} relative to a metered exposure.`,
      frameNumbers: good.map((f) => f.number),
    });
  }

  for (const tag of ["underexposed", "overexposed"] as const) {
    const set = byTag(tag);
    if (set.length < MIN_SAMPLE) {
      if (set.length > 0) notEnoughData.push({ tag, label: TAG_LABELS[tag], count: set.length, needed: MIN_SAMPLE });
      continue;
    }
    const avg = mean(set.map((f) => f.meta.evOffset));
    insights.push({
      id: tag,
      text: `Your ${set.length} "${tag}" frames average ${signed(avg)} from metered.`,
      frameNumbers: set.map((f) => f.number),
    });
  }

  return { insights, notEnoughData, tagCounts };
}
