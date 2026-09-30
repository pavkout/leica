// Full screen for the museum's display mode. Browsers only allow it from a
// tap or click, and iPhone Safari has no page full screen at all: then the
// museum simply fills the window.

export function requestFullscreen() {
  if (typeof document === "undefined") return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (!document.fullscreenElement) (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {});
  } catch {
    // Not allowed here.
  }
}

export function leaveFullscreen() {
  if (typeof document === "undefined") return;
  try {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch {
    // Nothing to leave.
  }
}
