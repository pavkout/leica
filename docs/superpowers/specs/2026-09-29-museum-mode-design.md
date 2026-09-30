# Museum mode — design

Date: 2026-09-29 · Master Plan brief: #39 · Status: approved in conversation (the user chose the Night gallery look, rooms → exhibits, and self-explore plus unattended display)

## Intent

The user wants a presentation of cameras, lenses, parts and accessories that works like an Apple Store demo unit. It is full screen and premium, in Leica's style, and people who see it should say "wow". It serves two uses:
- **Explore:** anyone opens it from MENU and walks through at their own pace.
- **Display:** it runs unattended on an iPad or TV. It plays an attract loop and returns to it when left alone.

## Decisions (user, 2026-09-29)

- **Both uses** (explore and display), in one presentation.
- **Rooms:**
  - Cameras
  - Lenses
  - Inside the camera (parts)
  - Accessories (only sourced items; nothing invented)
  - Your collection
- **Structure:** rooms → exhibits → story.
  - A room is a full-screen deck: one exhibit at a time, swipe or arrow keys, in date order.
  - "Explore" opens the exhibit's story: hero, key facts, what it's known for, history with sources, and "Try it in the simulator".
- **Look:** the Night gallery.
  - A black room with a warm spotlight on the product and chrome catching the light.
  - Leica red only as the index mark and the main action.

## Design system

- **Colours:**
  - gallery black `#0a0a0a`
  - spotlight `#2a2927`
  - chrome `#dedbd4`
  - text `#ece9e2`
  - quiet `#8d8a83`
  - Leica red `#cf2e25`
- **Type:** Archivo, the app's typeface, in three widths:
  - expanded (display stretch) for exhibit names, set very large
  - regular for text
  - condensed (engraving) for figures and specs
- **The one bold element:** a giant exhibit name set behind the product, which floats in a spotlight. Changing exhibits moves the product and the spotlight together, like a camera dolly.
- **Motion:** only in answer to the user (swipe, open), plus the attract loop's slow drift. Reduced motion swaps instantly.

## Architecture

- **Route:**
  - `#/museum` (lobby)
  - `#/museum/<room>` and `#/museum/<room>/<exhibit>`
  - `#/museum/display` (attract loop)
  - `?museum=display` starts the app straight into display mode, for unattended setups.
- **Entry:** a new MENU section, **Museum**, with "Enter the museum" and "Start display mode".
- **Lazy-loaded:** the museum code loads only when it opens.
- **Pure logic (`src/museum/`):**
  - `exhibits.ts` builds rooms and exhibits from the existing catalogue, timeline notes, anatomy parts, sourced accessories and the user's collection. It adds no new claims.
  - `deck.ts` handles deck navigation and the attract-loop order.
  - Both are tested.
- **Content rules:**
  - Every fact comes from the gear catalogue or a cited note.
  - Exhibit one-liners are derived from specs (e.g. "35 mm film · 0.91× finder · no meter").
  - Accessories live in `src/content/accessories.json`, each with a source URL and a date checked.
- **Display mode:**
  - Cycles hero exhibits every ~9 s with a slow drift.
  - A touch opens the exhibit in explore mode.
  - After 60 s idle it returns to the loop.
  - Exit is hidden from visitors: hold the corner for 3 s, or press Esc.
  - It asks for full screen when started from a tap.

## Slices

1. Lobby, Cameras and Lenses rooms, exhibit story, MENU entry.
2. Inside the camera room (anatomy parts, the part highlighted in the drawing).
3. Your collection room.
4. Display mode (attract loop, idle return, hidden exit, `?museum=display`).
5. Accessories room (researched, cited data).

## Testing

- **Unit:**
  - exhibit building (counts, order, one-liners from specs, notes attached)
  - deck navigation (wrap, bounds)
  - attract order
  - route parsing
  - accessory data validation (every item has a source and a date checked)
- **Browser:** walkthroughs at 1280, 1024 (iPad), 390 and 320 px; no overflow; reduced motion honoured.
