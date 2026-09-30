// Spoken cues (#62): the timers say what to do ("Agitate now") in the
// reader's own language, for hands in a changing bag or eyes on a print. Uses
// the browser's own speech synthesis; where there is none, or no voice for
// the language, the beeps and vibration carry on as before.

import { useSyncExternalStore } from "react";
import { langTag } from "../i18n";
import { getString, setString } from "./persistence";

const KEY = "rangefinder-spoken-cues";
let on = getString(KEY) === "1";
const listeners = new Set<() => void>();

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export function spokenCuesOn() {
  return on;
}

export function setSpokenCues(value: boolean) {
  on = value;
  setString(KEY, value ? "1" : "0");
  listeners.forEach((l) => l());
  // Saying something from the tap also unlocks speech on iOS for later cues.
  if (value) speak(" ", true);
}

export function useSpokenCues(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
    () => false,
  );
}

/** Says `text` when spoken cues are on (or `always`), cutting off anything still being said. */
export function speak(text: string, always = false): void {
  if (!(on || always) || !canSpeak()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langTag();
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
    if (voice) u.voice = voice;
    u.rate = 1;
    synth.speak(u);
  } catch {
    // Speech isn't available here; the tones still sound.
  }
}
