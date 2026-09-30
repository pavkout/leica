// The mark on the front of the museum's display stand (#39).
//
// The owner chose (2026-09-30) to show the Leica red dot on the stand, as on
// Leica's own display stands. The app deliberately doesn't draw a lookalike:
// the official artwork goes in `public/brand/`, and until it's there the stand
// simply carries no mark. Checked once per visit, so a missing file costs one
// request, not one per piece.
//
// Trademark note: the Leica logo is a registered trademark of Leica Camera AG.
// Showing it suits private use or use with Leica's permission; see
// docs/PROJECT_STATUS.md (#39).

const FILES = ["brand/stand-logo.svg", "brand/stand-logo.png"];

let found: Promise<string | null> | null = null;

function probe(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/** The logo's URL when the artwork has been added, otherwise null. */
export function standLogo(): Promise<string | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  if (!found)
    found = (async () => {
      for (const f of FILES) {
        const src = `${import.meta.env.BASE_URL}${f}`;
        if (await probe(src)) return src;
      }
      return null;
    })();
  return found;
}
