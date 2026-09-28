// Mechanical camera sounds, synthesised with the Web Audio API (no samples).
// Each sound is built from short filtered noise bursts ("clicks") and low
// thumps, shaped to evoke the real mechanism.

import { getString, setString } from "../services/persistence";
import type { ShutterStrike, ShutterVoice } from "./voices";

const MUTE_KEY = "rangefinder-muted";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = getString(MUTE_KEY) === "1";

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  // Storage may be unavailable (private mode); the setting then lasts for
  // this visit only, same as before — setString() already swallows that.
  setString(MUTE_KEY, value ? "1" : "0");
}

/**
 * True once per `minIntervalMs` for a given key, false otherwise — dragging
 * a ring fast across several detents fires the same click repeatedly, and
 * without this, overlapping Web Audio nodes stack into noise instead of a
 * clean click train. Pure and exported so the throttling logic itself is
 * testable without a real AudioContext.
 */
export function rateLimit(lastPlayedAt: Map<string, number>, key: string, minIntervalMs: number, now: number): boolean {
  const last = lastPlayedAt.get(key) ?? -Infinity;
  if (now - last < minIntervalMs) return false;
  lastPlayedAt.set(key, now);
  return true;
}

const clickTimes = new Map<string, number>();
const DETENT_MIN_INTERVAL_MS = 30;

function allowDetent(kind: string) {
  return rateLimit(clickTimes, kind, DETENT_MIN_INTERVAL_MS, typeof performance !== "undefined" ? performance.now() : Date.now());
}

/**
 * Optional haptic pairing on devices that support it. Tied to the same mute
 * flag as sound rather than a second setting the spec doesn't ask for; a
 * missing/denied Vibration API is a silent no-op, same as unsupported audio.
 */
/**
 * True once the user has actually interacted with the page. Sounds and haptics
 * triggered by code (e.g. the tour starting from `?demo`) stay silent until
 * then — "no sound before user interaction" holds on every path. Browsers
 * without the User Activation API fall back to allowing it (they block audio
 * before a gesture themselves).
 */
export function userHasInteracted(nav: { userActivation?: { hasBeenActive: boolean } } | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  return nav.userActivation ? nav.userActivation.hasBeenActive : true;
}

function vibrate(ms: number) {
  if (muted || typeof navigator === "undefined" || !("vibrate" in navigator) || !userHasInteracted()) return;
  try {
    navigator.vibrate(ms);
  } catch {
    // Restricted contexts (e.g. some cross-origin iframes) can throw; a haptic is never worth failing over.
  }
}

/** Creates the (suspended) audio context and noise buffer: the slow part, ~0.1 s on some machines. */
function build(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Builds the audio engine ahead of time, silently (the context stays suspended until a sound is played
 * after a user gesture), so the first click under a finger isn't delayed by setting it up.
 */
export function prepareAudio() {
  if (muted || typeof window === "undefined" || ctx) return;
  try {
    build();
  } catch {
    // No audio here; sounds simply stay off.
  }
}

function audio() {
  if (muted || typeof window === "undefined" || !userHasInteracted()) return null;
  const ac = build();
  if (!ac) return null;
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

/** A filtered noise burst with an exponential decay. */
function click(ac: AudioContext, at: number, freq: number, q: number, gain: number, decay: number, type: BiquadFilterType = "bandpass") {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(gain, at + 0.0015);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(at, Math.random() * 0.5);
  src.stop(at + decay + 0.02);
}

/** A short low sine thump, the body of a mechanical movement. */
function thump(ac: AudioContext, at: number, freq: number, gain: number, decay: number) {
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + decay);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(amp).connect(ac.destination);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

/** Aperture ring detent. */
export function playApertureClick() {
  if (!allowDetent("aperture")) return;
  vibrate(8);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  click(ac, t, 3800, 7, 0.16, 0.018);
  click(ac, t + 0.006, 2200, 4, 0.06, 0.02);
}

/** Shutter-speed dial detent: heavier than the aperture ring. */
export function playDialClick() {
  if (!allowDetent("dial")) return;
  vibrate(8);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  click(ac, t, 2600, 5, 0.18, 0.025);
  thump(ac, t, 420, 0.05, 0.03);
}

/** Lens bayonet mount: a short rotational scrape, then the locking click. */
export function playMountClick() {
  vibrate(12);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  click(ac, t, 900, 0.6, 0.05, 0.12, "lowpass");
  click(ac, t + 0.11, 3200, 6, 0.15, 0.02);
  thump(ac, t + 0.11, 380, 0.05, 0.025);
}

/**
 * A shutter release in the given body's voice: the first curtain (or leaf)
 * opens, the second closes after the exposure time, then a motorised body
 * recocks. See `voices.ts` for which mechanism each body family gets.
 */
export function playShutter(exposureSec: number, voice: ShutterVoice) {
  vibrate(15);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const second = t + Math.min(Math.max(exposureSec, voice.minGapSec), 2);
  strike(ac, t, voice.open);
  strike(ac, second, voice.close);
  if (voice.recock) {
    const { startHz, endHz, gain, durationSec } = voice.recock;
    const from = second + 0.08;
    const motor = ac.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.setValueAtTime(startHz, from);
    motor.frequency.linearRampToValueAtTime(endHz, from + durationSec * 0.8);
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, from);
    amp.gain.linearRampToValueAtTime(gain, from + 0.02);
    amp.gain.linearRampToValueAtTime(0.0001, from + durationSec);
    motor.connect(filter).connect(amp).connect(ac.destination);
    motor.start(from);
    motor.stop(from + durationSec + 0.04);
  }
}

function strike(ac: AudioContext, at: number, s: ShutterStrike) {
  click(ac, at, s.clickHz, s.clickQ, s.clickGain, s.clickDecay);
  thump(ac, at, s.thumpHz, s.thumpGain, s.thumpDecay);
}

/** Film advance lever: a ratchet under the thumb, then the lever springs back. */
export function playAdvance() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.12;
  for (let i = 0; i < 9; i++) click(ac, t + i * 0.028 + Math.random() * 0.004, 3000 + i * 60, 6, 0.07, 0.012);
  click(ac, t, 600, 0.8, 0.05, 0.3, "lowpass");
  click(ac, t + 0.3, 1200, 2, 0.12, 0.04);
  thump(ac, t + 0.3, 260, 0.08, 0.04);
}

/** Rewinding the roll: fast, slowing clicks from the rewind crank. */
export function playRewind() {
  const ac = audio();
  if (!ac) return;
  let t = ac.currentTime + 0.05;
  for (let i = 0; i < 40; i++) {
    click(ac, t, 2400, 5, 0.05, 0.01);
    t += 0.03 + i * 0.0012;
  }
  click(ac, t + 0.05, 900, 1, 0.1, 0.08);
}
