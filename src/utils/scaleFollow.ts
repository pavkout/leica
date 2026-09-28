// Scales (the `.dial` rows of f-stops, speeds, ISOs) are wider than their
// box on a phone. Like a lens ring bringing its figure under the index, a
// scale scrolls so its set value sits in the middle: when it first becomes
// visible, and whenever the set value changes. A scale the viewer scrolled
// by hand is left alone until its value changes again.

/** The set value each scale was last centred on. */
const centred = new WeakMap<Element, Element>();

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function align() {
  document.querySelectorAll<HTMLElement>(".dial").forEach((scale) => {
    // Hidden (a closed fold, another tool) or not overflowing: nothing to do, and nothing recorded yet.
    if (scale.clientWidth === 0 || scale.scrollWidth <= scale.clientWidth + 1) return;
    const on = scale.querySelector<HTMLElement>(".dial-on");
    if (!on || centred.get(scale) === on) return;
    const first = !centred.has(scale);
    centred.set(scale, on);
    const box = scale.getBoundingClientRect();
    const mark = on.getBoundingClientRect();
    const left = scale.scrollLeft + (mark.left - box.left) - (box.width - mark.width) / 2;
    scale.scrollTo({ left, behavior: first || reducedMotion() ? "auto" : "smooth" });
  });
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    align();
  });
}

/** Starts following. Call once, after the app mounts. */
export function followScales() {
  if (typeof MutationObserver === "undefined") return;
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "open"],
  });
  window.addEventListener("resize", schedule);
  schedule();
}
