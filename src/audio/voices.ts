// Per-body shutter "voices": which synthesised shutter sound a body gets.
//
// Keyed by the body's shutter *mechanism*, not by individual model: the
// mechanism per family is public knowledge (film Ms use a horizontally
// travelling cloth focal-plane shutter; digital Ms, SL, CL and S use a
// vertically travelling metal focal-plane shutter recocked by a motor; the Q
// uses a leaf shutter in its fixed lens), whereas how one specific model
// sounds is not published data. The tonal parameters themselves are
// illustrative synthesis choices, not recordings or measurements.

import type { Body } from "../data/gear";
import type { Provenance } from "../data/provenance";

export type ShutterMechanism = "cloth-focal-plane" | "metal-focal-plane" | "leaf";

/** One curtain (or leaf) event: a filtered noise click plus a low thump. */
export interface ShutterStrike {
  clickHz: number;
  clickQ: number;
  clickGain: number;
  clickDecay: number;
  thumpHz: number;
  thumpGain: number;
  thumpDecay: number;
}

export interface ShutterVoice {
  mechanism: ShutterMechanism;
  label: string;
  /** First curtain / leaves opening. */
  open: ShutterStrike;
  /** Second curtain / leaves closing, after the exposure time. */
  close: ShutterStrike;
  /** Shortest audible gap between the two strikes, in seconds. */
  minGapSec: number;
  /** Motorised recocking after the exposure; `null` for a hand-wound or spring-return mechanism. */
  recock: { startHz: number; endHz: number; gain: number; durationSec: number } | null;
}

export const SHUTTER_VOICE_PROVENANCE: Provenance = {
  kind: "illustrative",
  notes:
    "Shutter mechanism per camera family is public knowledge; the sounds themselves are synthesised, not recorded from real cameras, and don't reproduce any specific model.",
};

const CLOTH: ShutterVoice = {
  mechanism: "cloth-focal-plane",
  label: "Cloth focal-plane shutter",
  open: { clickHz: 1400, clickQ: 1.2, clickGain: 0.5, clickDecay: 0.05, thumpHz: 160, thumpGain: 0.32, thumpDecay: 0.06 },
  close: { clickHz: 1800, clickQ: 1.4, clickGain: 0.42, clickDecay: 0.06, thumpHz: 140, thumpGain: 0.26, thumpDecay: 0.07 },
  minGapSec: 0.012,
  recock: null,
};

const METAL: ShutterVoice = {
  mechanism: "metal-focal-plane",
  label: "Metal focal-plane shutter, motor recock",
  open: { clickHz: 2600, clickQ: 2.2, clickGain: 0.46, clickDecay: 0.035, thumpHz: 190, thumpGain: 0.24, thumpDecay: 0.045 },
  close: { clickHz: 3000, clickQ: 2.4, clickGain: 0.4, clickDecay: 0.04, thumpHz: 170, thumpGain: 0.2, thumpDecay: 0.05 },
  minGapSec: 0.008,
  recock: { startHz: 95, endHz: 140, gain: 0.06, durationSec: 0.18 },
};

const LEAF: ShutterVoice = {
  mechanism: "leaf",
  label: "Leaf shutter",
  open: { clickHz: 4200, clickQ: 5, clickGain: 0.14, clickDecay: 0.012, thumpHz: 320, thumpGain: 0.05, thumpDecay: 0.02 },
  close: { clickHz: 4600, clickQ: 5, clickGain: 0.12, clickDecay: 0.012, thumpHz: 300, thumpGain: 0.04, thumpDecay: 0.02 },
  minGapSec: 0.004,
  recock: null,
};

export function shutterMechanism(body: Pick<Body, "family">): ShutterMechanism {
  switch (body.family) {
    case "M film":
      return "cloth-focal-plane";
    case "Q":
      return "leaf";
    case "M digital":
    case "SL":
    case "CL":
    case "S":
      return "metal-focal-plane";
  }
}

const VOICES: Record<ShutterMechanism, ShutterVoice> = {
  "cloth-focal-plane": CLOTH,
  "metal-focal-plane": METAL,
  leaf: LEAF,
};

export function shutterVoiceFor(body: Pick<Body, "family">): ShutterVoice {
  return VOICES[shutterMechanism(body)] ?? CLOTH;
}
