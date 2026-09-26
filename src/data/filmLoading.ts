// Film loading trainer content (feature #22). Every sequence below follows
// the manufacturer's instruction manual cited in its `source` — step order,
// counter behaviour and warnings are taken from those manuals, not from
// general film-camera knowledge. Bodies without a manual that has been read
// and checked are listed in UNSOURCED_FILM_BODY_IDS and get no tutorial
// rather than a plausible-sounding guess.

import type { MechState, Tutorial, TutorialAction, TutorialStep } from "../state/loadingTutorial";

const VERIFIED = "2026-09-26";

// Mechanical state keys:
//   camera: "closed" (bottom cover locked) | "unlocked" | "open" (bottom cover off)
//   back: "closed" | "open"                 spool: "in" | "out" (M3's removable take-up spool)
//   cartridge: "none" | "hand" | "half" | "in"   leader: "free" | "attached"
//   cocked: boolean   lever: "A" | "R" (rewind lever)   film: "none" | "loaded" | "exposed" | "rewound"
//   counter: display label for the exposure counter, set only where the manual states it.

const CLOSED_CAMERA = { key: "camera", oneOf: ["closed"], reason: "Do this with the bottom cover on and locked." };

/** Shared action catalog. Order here is the palette order, deliberately not the loading order. */
export const LOADING_ACTIONS: Record<string, TutorialAction> = Object.fromEntries(
  (
    [
      {
        id: "wind",
        label: "Work the advance lever",
        requires: [
          { key: "camera", oneOf: ["closed"], reason: "Don't work the film transport with the bottom cover off — the cover is what guides the film into its correct position." },
          { key: "cocked", oneOf: [false], reason: "The shutter is already cocked, so the lever won't move. Release the shutter first." },
        ],
      },
      { id: "release", label: "Release the shutter", requires: [{ key: "cocked", oneOf: [true], reason: "The shutter isn't cocked yet — there's nothing to release." }] },
      { id: "check-empty", label: "Turn the rewind knob to feel for film", requires: [CLOSED_CAMERA] },
      { id: "tension", label: "Take up slack with the rewind knob", requires: [{ ...CLOSED_CAMERA, reason: "The film can only be tensioned once the camera is closed." }] },
      { id: "set-rewind", label: "Set the rewind lever to R", requires: [{ key: "lever", oneOf: ["A"], reason: "The rewind lever is already at R." }] },
      {
        id: "rewind",
        label: "Rewind the film",
        requires: [
          { key: "lever", oneOf: ["R"], reason: "The transport is still engaged. Set the rewind lever to R first." },
          { key: "film", oneOf: ["exposed"], reason: "There's no exposed film on the take-up spool to rewind." },
        ],
      },
      { id: "reset-lever", label: "Return the rewind lever upright", requires: [{ key: "lever", oneOf: ["R"], reason: "The rewind lever is already upright." }] },
      {
        id: "unlock",
        label: "Unlock the bottom-cover toggle",
        requires: [
          { ...CLOSED_CAMERA, reason: "The bottom cover is already unlocked." },
          { key: "film", oneOf: ["none", "rewound"], reason: "Opening now would fog the exposed film. Rewind it into the cartridge first." },
        ],
      },
      { id: "remove-cover", label: "Take off the bottom cover", requires: [{ key: "camera", oneOf: ["unlocked"], reason: "The bottom cover is locked. Unlock its toggle first." }] },
      {
        id: "refit-cover",
        label: "Refit and lock the bottom cover",
        requires: [
          { key: "camera", oneOf: ["open"], reason: "The bottom cover is already on." },
          { key: "back", oneOf: ["closed"], reason: "Close the rear panel first — it has to sit under the lip of the bottom cover." },
        ],
      },
      {
        id: "open-back",
        label: "Swing open the rear panel",
        requires: [
          { key: "camera", oneOf: ["open"], reason: "The rear panel is held shut by the bottom cover. Take that off first." },
          { key: "back", oneOf: ["closed"], reason: "The rear panel is already open." },
        ],
      },
      { id: "close-back", label: "Close the rear panel", requires: [{ key: "back", oneOf: ["open"], reason: "The rear panel is already closed." }] },
      {
        id: "remove-spool",
        label: "Pull out the take-up spool",
        requires: [
          { key: "camera", oneOf: ["open"], reason: "The take-up spool is under the bottom cover. Take that off first." },
          { key: "spool", oneOf: ["in"], reason: "The take-up spool is already out." },
        ],
      },
      { id: "attach-leader-spool", label: "Clip the leader to the take-up spool", requires: [{ key: "spool", oneOf: ["out"], reason: "The take-up spool is still in the camera. Pull it out first." }] },
      {
        id: "insert-pair",
        label: "Drop cartridge and spool in together",
        requires: [{ key: "leader", oneOf: ["attached"], reason: "Clip the leader to the take-up spool first — they go in as a pair." }],
      },
      { id: "check-sprockets", label: "Check the sprockets engage", requires: [{ key: "back", oneOf: ["open"], reason: "Swing the back open so you can see the sprockets." }] },
      {
        id: "insert-cartridge",
        label: "Push the cartridge into its chamber",
        requires: [
          { key: "back", oneOf: ["open"], reason: "Open the rear panel too — the leader has to lie across the film gate." },
          { key: "cartridge", oneOf: ["none"], reason: "The cartridge is already in." },
        ],
      },
      { id: "pull-leader", label: "Pull the leader into the take-up spool", requires: [{ key: "cartridge", oneOf: ["half"], reason: "Put the cartridge in its chamber first." }] },
      {
        id: "seat-on-prongs",
        label: "Press cartridge and film end onto the loading prongs",
        requires: [{ key: "cartridge", oneOf: ["half"], reason: "Start the cartridge into its chamber first." }],
      },
      { id: "seat-film", label: "Press cartridge and leader home", requires: [{ key: "leader", oneOf: ["attached"], reason: "Pull the leader into the take-up spool first." }] },
      {
        id: "remove-cartridge",
        label: "Take out the cartridge",
        requires: [
          { key: "camera", oneOf: ["open"], reason: "The cartridge is under the bottom cover. Open the camera first." },
          { key: "cartridge", oneOf: ["in"], reason: "There's no cartridge in the camera." },
        ],
      },
    ] satisfies TutorialAction[]
  ).map((a) => [a.id, a]),
);

const EMPTY: MechState = { camera: "closed", back: "closed", spool: "in", cartridge: "none", leader: "free", cocked: false, lever: "A", film: "none", counter: "—" };
const FULL: MechState = { ...EMPTY, cartridge: "in", leader: "attached", film: "exposed" };

// The current Leica M6 (2022) and MP manuals give the same bottom-loading
// procedure step for step; only the lever's name differs.
function quickLoadSteps(lever: "rewind lever" | "rewind release lever"): { load: TutorialStep[]; unload: TutorialStep[] } {
  const open: TutorialStep[] = [
    { action: "unlock", text: "Hold the camera base up, click the locking toggle up and turn it anticlockwise.", set: { camera: "unlocked" } },
    { action: "remove-cover", text: "Remove the bottom cover.", note: "The exposure counter resets automatically when the bottom cover is opened.", set: { camera: "open", counter: "Reset" } },
    { action: "open-back", text: "Flip open the rear panel.", set: { back: "open" } },
  ];
  return {
    load: [
      ...open,
      { action: "insert-cartridge", text: "Push the film cartridge about half-way into its recess.", set: { cartridge: "half" } },
      {
        action: "pull-leader",
        text: "Take the start of the film and pull it across into the take-up spool on the other side. The diagram on the camera base shows the end position.",
        note: "Trim the leader as for any standard film. It doesn't matter if the tip pokes out of a slit on the far side of the spool — except below freezing, when it should be caught by one slit only so the tip can't snap off.",
        set: { leader: "attached" },
      },
      { action: "seat-film", text: "Use your fingertips to gently push the cartridge and the film start into the camera.", set: { cartridge: "in" } },
      { action: "close-back", text: "Close the rear panel.", set: { back: "closed" } },
      {
        action: "refit-cover",
        text: "Hook the bottom cover onto the pin on the side of the camera and close it, with the rear panel pressed fully in under its lip. Turn the toggle clockwise and press it down.",
        note: "Don't test the film advance while the camera is open — the bottom cover is what guides the film into position.",
        set: { camera: "closed", film: "loaded" },
      },
      { action: "wind", text: "Cock the shutter.", set: { cocked: true } },
      { action: "release", text: "Release the shutter.", set: { cocked: false } },
      { action: "wind", text: "Cock the shutter again.", note: "The rewind crank turning as you wind shows the film is advancing correctly.", set: { cocked: true } },
      { action: "release", text: "Release the shutter again.", set: { cocked: false } },
      { action: "wind", text: "Cock the shutter a third time. The exposure counter should now show 1 — the camera is ready to shoot.", set: { cocked: true, counter: "1" } },
    ],
    unload: [
      { action: "set-rewind", text: `When the shutter can no longer be cocked, the roll is finished. Move the ${lever} to R.`, set: { lever: "R" } },
      {
        action: "rewind",
        text: "Fold out the rewind crank and turn it clockwise. After a little resistance the film pulls off the take-up spool; give it a few more turns, then fold the crank back in.",
        note: "The film must be fully rewound before the camera is opened, or light will ruin part of it.",
        set: { film: "rewound", leader: "free" },
      },
      { action: "reset-lever", text: `Tilt the ${lever} back to its vertical position.`, set: { lever: "A" } },
      ...open,
      { action: "remove-cartridge", text: "Pull out the cartridge and store it somewhere cool and dark.", set: { cartridge: "none", film: "none" } },
    ],
  };
}

const m6 = quickLoadSteps("rewind lever");
const mp = quickLoadSteps("rewind release lever");

const M6_SOURCE = {
  kind: "published" as const,
  sourceName: "Leica M6 Instruction manual (M6/EN/2022/10/1)",
  sourceUrl: "https://leica-camera.com/sites/default/files/pm-85045-leica-m6_instructions_en.pdf",
  pages: "pp. 25–29",
  notes: "Current manual for the 2022 M6 re-edition.",
  lastVerifiedAt: VERIFIED,
};
const MP_SOURCE = {
  kind: "published" as const,
  sourceName: "Leica MP Instruction manual",
  sourceUrl: "https://leica-camera.com/sites/default/files/pm-121746-Leica-MP_Instructions_en.pdf",
  pages: "pp. 24–29",
  lastVerifiedAt: VERIFIED,
};
const MA_SOURCE = {
  kind: "published" as const,
  sourceName: "Leica M-A Instructions",
  sourceUrl: "https://leica-camera.com/sites/default/files/pm-72706-Leica-M-A_Instructions_en.pdf",
  pages: "pp. 36–39",
  lastVerifiedAt: VERIFIED,
};
const M3_SOURCE = {
  kind: "published" as const,
  sourceName: "Leica M3 Instruction Book (Ernst Leitz, Wetzlar)",
  sourceUrl: "https://www.cameramanuals.org/leica_pdf/leica_m3-03.pdf",
  pages: "pp. 28–32",
  notes: "Scanned original via the butkus.us manual archive.",
  lastVerifiedAt: VERIFIED,
};

const M4_SOURCE = {
  kind: "published" as const,
  sourceName: "Leica M4 instruction booklet (Ernst Leitz GmbH, Wetzlar)",
  sourceUrl: "https://www.cameramanuals.org/leica_pdf/leica_m4.pdf",
  pages: "pp. 20–21",
  notes: "Scanned original via the butkus.org manual archive; a few OCR-garbled words were read in context.",
  lastVerifiedAt: VERIFIED,
};
const M7_SOURCE = {
  kind: "published" as const,
  sourceName: "Leica M7 Bedienungsanleitung / Instructions (Leica Camera AG, German/English edition, 930 22 III/04)",
  sourceUrl: "https://apotelyt.com/abc-doc/leica-manual-m7.pdf",
  pages: "pp. 77–78",
  notes: "Official Leica manual; linked via a mirror because leica-camera.com no longer hosts it.",
  lastVerifiedAt: VERIFIED,
};

// On the M4 the back panel swings open by itself once the baseplate is off,
// and the frame counter springs back as it does.
const M4_OPEN: TutorialStep[] = [
  { action: "unlock", text: "Turn the baseplate latch to the left.", set: { camera: "unlocked" } },
  {
    action: "remove-cover",
    text: "Remove the baseplate — the back panel swings open. Set the camera on its top, with the lens facing you.",
    note: "The frame counter springs back to 2 marks before 0.",
    set: { camera: "open", back: "open", counter: "2 marks before 0" },
  },
];

const M7_OPEN: TutorialStep[] = [
  { action: "unlock", text: "Hold the camera with the base plate pointing up. Raise the latch on the base plate and turn it to the left.", set: { camera: "unlocked" } },
  { action: "remove-cover", text: "Remove the base plate.", set: { camera: "open" } },
  { action: "open-back", text: "Fold the back out towards the rear.", set: { back: "open" } },
];

const MA_OPEN: TutorialStep[] = [
  { action: "unlock", text: "Hold the camera with the bottom cover facing up. Fold up the toggle and turn it to the left.", set: { camera: "unlocked" } },
  { action: "remove-cover", text: "Lift off the bottom cover.", set: { camera: "open" } },
  { action: "open-back", text: "Open the rear panel backwards.", set: { back: "open" } },
];

const M3_OPEN: TutorialStep[] = [
  { action: "unlock", text: "Turn the camera upside down, raise the baseplate locking swivel and turn it from CLOSE to OPEN.", set: { camera: "unlocked" } },
  { action: "remove-cover", text: "Take off the baseplate and put it aside.", set: { camera: "open" } },
];

export const LOADING_TUTORIALS: Tutorial[] = [
  { bodyIds: ["m6"], mode: "load", initial: EMPTY, steps: m6.load, source: M6_SOURCE },
  { bodyIds: ["m6"], mode: "unload", initial: FULL, steps: m6.unload, source: M6_SOURCE },
  { bodyIds: ["mp"], mode: "load", initial: EMPTY, steps: mp.load, source: MP_SOURCE },
  { bodyIds: ["mp"], mode: "unload", initial: FULL, steps: mp.unload, source: MP_SOURCE },
  {
    bodyIds: ["m-a"],
    mode: "load",
    initial: EMPTY,
    source: MA_SOURCE,
    steps: [
      { action: "check-empty", text: "First check no film is loaded: turn the pull-out rewind button in the direction of the arrow. If you feel resistance, rewind and remove that film first.", set: {} },
      ...MA_OPEN,
      { action: "insert-cartridge", text: "Take the cartridge in your right hand and insert it about halfway into its cavity.", set: { cartridge: "half" } },
      {
        action: "pull-leader",
        text: "Take hold of the film leader and insert it into the take-up spool, as the diagram inside the housing shows.",
        note: "Trim the leader as for any standard film. Below freezing, the leader should be held by one slit of the spool only, so the protruding end can't snap off.",
        set: { leader: "attached" },
      },
      { action: "seat-film", text: "Carefully press the cartridge and leader into the camera with your fingertips.", set: { cartridge: "in" } },
      { action: "close-back", text: "Close the rear panel.", set: { back: "closed" } },
      {
        action: "refit-cover",
        text: "Lower the bottom cover onto the locking pin on the side of the camera and close it, with the rear panel pressed completely in. Lock it with the toggle.",
        note: "Don't check the film winding with the camera open — refitting the bottom cover is what brings the film into position.",
        set: { camera: "closed", film: "loaded" },
      },
      { action: "wind", text: "Wind on one frame with the quick-wind lever…", set: { cocked: true } },
      { action: "release", text: "…and release the shutter.", set: { cocked: false } },
      { action: "tension", text: "Tension the film by carefully turning the pull-out rewind button in the direction of the arrow.", set: {} },
      { action: "wind", text: "Work the quick-wind lever again. The film is winding properly if the rewind button turns against the arrow as you do.", set: { cocked: true } },
      { action: "release", text: "Release the shutter again.", set: { cocked: false } },
      { action: "wind", text: "Cock the shutter a third time. The frame counter now shows 1 and the camera is ready.", set: { cocked: true, counter: "1" } },
    ],
  },
  {
    bodyIds: ["m-a"],
    mode: "unload",
    initial: FULL,
    source: MA_SOURCE,
    steps: [
      { action: "set-rewind", text: "When the quick-wind lever can no longer be operated, the roll is finished. Move the rewind release lever to R.", set: { lever: "R" } },
      {
        action: "rewind",
        text: "Pull out the rewind button and turn it clockwise until, after a slight resistance, the film has been wound off the take-up spool.",
        set: { film: "rewound", leader: "free" },
      },
      ...MA_OPEN,
      { action: "remove-cartridge", text: "Remove the film cartridge.", set: { cartridge: "none", film: "none" } },
    ],
  },
  {
    bodyIds: ["m3"],
    mode: "load",
    initial: EMPTY,
    source: M3_SOURCE,
    steps: [
      { action: "check-empty", text: "Make sure the camera is empty: pull out the rewind knob and turn it in the direction of the arrow. If you feel resistance, rewind and remove that film first.", set: {} },
      ...M3_OPEN,
      {
        action: "remove-spool",
        text: "Place the camera top-down on a table and pull out the take-up spool.",
        note: "The exposure counter returns to its start position — two marks before 0 — whenever the take-up spool is removed.",
        set: { spool: "out", counter: "2 marks before 0" },
      },
      { action: "open-back", text: "Swing open the hinged back plate.", set: { back: "open" } },
      {
        action: "attach-leader-spool",
        text: "Hold the spool and the cartridge with both knurled heads pointing up. Slide the film leader under the spool's clamping spring as far as it will go — emulsion side out, film edges against the spool flanges.",
        set: { leader: "attached", cartridge: "hand" },
      },
      {
        action: "insert-pair",
        text: "Draw out just enough film to drop cartridge and spool into their recesses together, knurled heads uppermost, with the matt emulsion side facing the lens.",
        set: { spool: "in", cartridge: "in" },
      },
      { action: "check-sprockets", text: "With the back still open, check that the sprockets of the transport roller fully engage the perforations on both edges.", set: {} },
      { action: "close-back", text: "Close the hinged back plate so it clicks into position.", set: { back: "closed" } },
      { action: "refit-cover", text: "Hook the baseplate over the pin and lock it by turning the swivel to CLOSE.", set: { camera: "closed", film: "loaded" } },
      { action: "tension", text: "Pull out the rewind knob and turn it gently in the direction of the arrow until you feel slight resistance. This tightens the film for proper transport.", set: {} },
      { action: "wind", text: "Advance the film…", note: "The film between cartridge and spool was fogged while loading, so it's wound on before the first frame.", set: { cocked: true } },
      { action: "release", text: "…and release the shutter.", set: { cocked: false } },
      { action: "wind", text: "Advance again.", note: "The red mark in the centre of the rewind knob should revolve as the film winds on.", set: { cocked: true } },
      { action: "release", text: "Release the shutter a second time.", set: { cocked: false } },
      { action: "wind", text: "Advance a third time. The counter moves to 1 and the camera is ready for the first shot.", set: { cocked: true, counter: "1" } },
    ],
  },
  {
    bodyIds: ["m3"],
    mode: "unload",
    initial: FULL,
    source: M3_SOURCE,
    steps: [
      { action: "set-rewind", text: "When the film transport lever no longer operates, the roll is finished. Set the reversing lever on the front of the camera to R.", set: { lever: "R" } },
      {
        action: "rewind",
        text: "Pull out the rewind knob and turn it in the direction of the arrow until you feel marked resistance, then one more full turn to free the film from the take-up spool and sprockets.",
        set: { film: "rewound", leader: "free" },
      },
      ...M3_OPEN,
      {
        action: "remove-cartridge",
        text: "Withdraw the cartridge with the leader protruding. Tear off the leader or mark the cartridge as exposed so it isn't reused by accident.",
        set: { cartridge: "none", film: "none" },
      },
    ],
  },
  {
    bodyIds: ["m4"],
    mode: "load",
    initial: EMPTY,
    source: M4_SOURCE,
    steps: [
      { action: "check-empty", text: "Before opening, make sure the camera isn't already loaded: unfold the rewind crank and turn it gently in the direction of the arrow. If you feel resistance, a film is in the camera — rewind it first.", set: {} },
      ...M4_OPEN,
      { action: "insert-cartridge", text: "Start the cartridge into the left-hand chamber, drawing out only enough film to reach the three prongs in the right-hand chamber.", set: { cartridge: "half" } },
      {
        action: "seat-on-prongs",
        text: "Press the cartridge and the film end straight into the camera. All that matters is that the film end lies between two of the three loading prongs.",
        note: "Bulk film needs a tongue cut like factory-loaded film, and must be attached very securely to the cartridge spool.",
        set: { cartridge: "in", leader: "attached" },
      },
      { action: "close-back", text: "Close the back panel.", set: { back: "closed" } },
      { action: "refit-cover", text: "Replace and lock the baseplate. A disc on its inner side presses the film into the correct position.", set: { camera: "closed", film: "loaded" } },
      { action: "wind", text: "Complete loading with two blank exposures: advance the film…", set: { cocked: true } },
      { action: "release", text: "…and release the shutter.", set: { cocked: false } },
      { action: "wind", text: "Advance again.", note: "The rewind crank turning backwards is your proof that the film is being transported properly.", set: { cocked: true } },
      { action: "release", text: "Release the shutter for the second blank exposure.", set: { cocked: false } },
      { action: "wind", text: "Advance once more. The frame counter now stands at 1 and the M4 is ready.", set: { cocked: true, counter: "1" } },
    ],
  },
  {
    bodyIds: ["m4"],
    mode: "unload",
    initial: FULL,
    source: M4_SOURCE,
    steps: [
      { action: "set-rewind", text: "When the transport lever can no longer be moved, the last exposure has been made. Set the reversing lever at R and leave it there.", set: { lever: "R" } },
      {
        action: "rewind",
        text: "Unfold the rewinding crank and turn it in the direction of the arrow until no further resistance is felt — the film is then completely rewound.",
        note: "To leave the film end protruding from the cartridge, stop turning as soon as the resistance drops. Otherwise give a few extra turns so all the film goes into the cartridge.",
        set: { film: "rewound", leader: "free" },
      },
      ...M4_OPEN,
      { action: "remove-cartridge", text: "Take out the cartridge.", set: { cartridge: "none", film: "none" } },
    ],
  },
  {
    bodyIds: ["m7"],
    mode: "load",
    initial: EMPTY,
    source: M7_SOURCE,
    steps: [
      { action: "check-empty", text: "Always start by making sure there's no film in the camera: turn the rewind crank gently in the direction of the arrow. If there's any resistance, rewind and remove that film first.", set: {} },
      ...M7_OPEN,
      {
        action: "insert-cartridge",
        text: "Hold the film cartridge in your right hand and insert it about half-way into the empty chamber.",
        note: "You'll feel slight resistance as the cartridge pushes past the spring-loaded DX contacts.",
        set: { cartridge: "half" },
      },
      {
        action: "pull-leader",
        text: "Take the film leader and pull it into the take-up spool, as the schematic diagram inside the camera housing shows.",
        note: "Trim the leader as for any ready-to-use film. It doesn't matter if the tip pokes out of a slit on the far side of the spool — except in frosty conditions, when it should be taken up by one slit only so the end can't break off.",
        set: { leader: "attached" },
      },
      { action: "seat-film", text: "Carefully press the film cartridge and the leader into the camera with your fingertips.", set: { cartridge: "in" } },
      { action: "close-back", text: "Replace the camera back.", set: { back: "closed" } },
      {
        action: "refit-cover",
        text: "Hook the base plate onto the retaining pin on the side of the camera, return it to its normal position with the back pressed completely in under it, and lock it with the latch.",
        note: "Don't check the film transport with the camera open — replacing the base plate is what guides the film into position.",
        set: { camera: "closed", film: "loaded" },
      },
      { action: "wind", text: "Advance the film with the quick-wind lever…", set: { cocked: true } },
      { action: "release", text: "…and release the shutter.", set: { cocked: false } },
      { action: "tension", text: "Pull the film taut by carefully turning the rewind crank in the direction of the arrow.", set: {} },
      { action: "wind", text: "Operate the quick-wind lever again. The film is transporting properly if the rewind crank turns against the arrow as you do.", set: { cocked: true } },
      { action: "release", text: "Release the shutter again.", set: { cocked: false } },
      { action: "wind", text: "Cock the shutter a third time. The frame counter now shows 1 — check or set the film speed, and the camera is ready.", set: { cocked: true, counter: "1" } },
    ],
  },
  {
    bodyIds: ["m7"],
    mode: "unload",
    initial: FULL,
    source: M7_SOURCE,
    steps: [
      { action: "set-rewind", text: "When the last frame has been exposed, the quick-wind lever can no longer be operated. Turn the rewind release lever to R.", set: { lever: "R" } },
      {
        action: "rewind",
        text: "Swing out the rewind crank and turn it clockwise, in the direction of the arrow, until you feel slight resistance and the film is freed from the take-up spool.",
        set: { film: "rewound", leader: "free" },
      },
      ...M7_OPEN,
      {
        action: "remove-cartridge",
        text: "Remove the film cartridge.",
        note: "The spring-loaded DX contacts press on the cartridge, so you'll feel slight resistance. If needed, tap the camera lightly against your hand.",
        set: { cartridge: "none", film: "none" },
      },
    ],
  },
];

/** Film bodies in the catalog whose loading procedure hasn't been sourced from a manual yet. */
export const UNSOURCED_FILM_BODY_IDS: string[] = [];

export function tutorialFor(bodyId: string, mode: Tutorial["mode"]): Tutorial | undefined {
  return LOADING_TUTORIALS.find((t) => t.mode === mode && t.bodyIds.includes(bodyId));
}
