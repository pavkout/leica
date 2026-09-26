# Product photos

The app shows a real product photo for any body or lens that has one here,
and its drawing otherwise.

1. Put photos in `bodies/` and `lenses/`, named by id: `bodies/m11.jpg`,
   `lenses/m-50-0.95.png`. The ids are listed in `IDS.md` (ticked = done).
   Any size or format works (JPG, PNG, WebP, TIFF); white or plain studio
   backgrounds trim best.
2. Optional: add `credits.json` with the credit line your licence requires,
   per id or for all (`"*"`): `{ "*": "© Leica Camera AG, used with permission" }`.
3. Run `npm run gear-images`. It writes 320 px and 640 px WebP tiles to
   `public/gear/` and updates `src/data/gearImages.json`.

Only use images you have permission to publish. The originals in `bodies/`
and `lenses/` are git-ignored; only the generated thumbnails are committed.
