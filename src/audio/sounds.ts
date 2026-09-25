// Mechanical camera sounds, synthesised with the Web Audio API (no samples).
// Each sound is built from short filtered noise bursts ("clicks") and low
// thumps, shaped to evoke the real mechanism.

const MUTE_KEY = "rangefinder-muted";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode); the setting lasts for this visit.
  }
}

function audio() {
  if (muted || typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
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
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  click(ac, t, 3800, 7, 0.16, 0.018);
  click(ac, t + 0.006, 2200, 4, 0.06, 0.02);
}

/** Shutter-speed dial detent: heavier than the aperture ring. */
export function playDialClick() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  click(ac, t, 2600, 5, 0.18, 0.025);
  thump(ac, t, 420, 0.05, 0.03);
}

/**
 * The cloth focal-plane shutter of an M: the first curtain opens, the second
 * follows after the exposure time. Digital Ms then recock with a small motor.
 */
export function playShutter(exposureSec: number, digital: boolean) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  const second = t + Math.min(Math.max(exposureSec, 0.012), 2);
  click(ac, t, 1400, 1.2, 0.5, 0.05);
  thump(ac, t, 160, 0.32, 0.06);
  click(ac, second, 1800, 1.4, 0.42, 0.06);
  thump(ac, second, 140, 0.26, 0.07);
  if (digital) {
    const motor = ac.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.setValueAtTime(95, second + 0.08);
    motor.frequency.linearRampToValueAtTime(140, second + 0.22);
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, second + 0.08);
    amp.gain.linearRampToValueAtTime(0.06, second + 0.1);
    amp.gain.linearRampToValueAtTime(0.0001, second + 0.26);
    motor.connect(filter).connect(amp).connect(ac.destination);
    motor.start(second + 0.08);
    motor.stop(second + 0.3);
  }
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
