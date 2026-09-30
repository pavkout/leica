// English: the source language. Every key the app uses lives here; other
// languages translate a subset and fall back to this text key by key.
// Mode and tool names come from `app/tools.ts`, so they're written once.
// Camera engravings (MENU, PLAY, ROLL, FN, ISO) stay in English in every
// language, as on the camera itself.

import { MODES, TOOLS } from "../../app/tools";
import collect from "./en.collect";
import lab from "./en.lab";
import walks from "./en.walks";
import match from "./en.match";
import col from "./en.col";
import sn from "./en.sn";
import mu from "./en.mu";

export type Dict = Record<string, string>;

const fromTools: Dict = Object.fromEntries([
  ...MODES.flatMap((m) => [
    [`mode.${m.id}`, m.label],
    [`mode.${m.id}.job`, m.job],
  ]),
  ...TOOLS.flatMap((t) => [
    [`tool.${t.id}`, t.label],
    [`tool.${t.id}.blurb`, t.blurb],
  ]),
]);

const en: Dict = {
  ...fromTools,
  ...collect,
  ...lab,
  ...walks,
  ...match,
  ...col,
  ...sn,
  ...mu,

  // Shared words.
  "common.close": "Close",
  "common.back": "Back",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.done": "Done",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.start": "Start",
  "common.on": "On",
  "common.off": "Off",
  "common.yes": "Yes",
  "common.no": "No",
  "common.print": "Print",
  "common.share": "Share",
  "common.download": "Download",
  "common.all": "All",
  "common.optional": "optional",
  "common.camera": "Camera",
  "common.lens": "Lens",
  "common.aperture": "Aperture",
  "common.shutter": "Shutter",
  "common.filmIso": "Film ISO",
  "common.iso": "ISO",
  "common.notes": "Notes",
  "common.date": "Date",
  "common.today": "Today",
  "common.remove": "Remove",
  "common.copyLink": "Copy link",
  "common.copied": "Copied",
  "common.tryAgain": "Try again",

  // MENU.
  "menu.label": "Menu",
  "menu.back": "Back to the camera",
  "menu.sections": "Menu sections",
  "menu.museum": "Museum",
  "menu.setup": "Setup",
  "menu.museum.enter": "Enter the museum",
  "menu.museum.enter.detail": "Cameras, lenses, how they work, accessories and your collection, full screen.",
  "menu.museum.display": "Display mode",
  "menu.museum.display.detail": "Runs on its own on an iPad or TV: a slow loop of pieces, touch to explore. Hold the top-left corner to leave.",
  "setup.language": "Language",
  "setup.units": "Distance units",
  "setup.units.metric": "Metres",
  "setup.units.imperial": "Feet",
  "setup.sound": "Sounds",
  "setup.haptics": "Haptics",
  "setup.safelight": "Red safelight",
  "setup.camera": "Camera and lens",
  "setup.tour": "60-second tour",
  "setup.signout": "Sign out",
  "setup.signout.detail": "Leave this device signed out",

  // Language picker.
  "lang.title": "Choose a language",
  "lang.note": "Pages that aren't translated yet are shown in English.",
  "lang.auto": "Translations were written with AI help and haven't all been checked by native speakers yet.",

  // Top plate on tool pages.
  "top.back": "Back to the camera",
  "top.rig": "Camera on the simulator",
  "top.changeCamera": "Change the camera",
  "top.changeLens": "Change the lens",
  "top.builtIn": "This camera's lens is built in",
  "top.cameraAria": "Camera: {name}. Change camera",
  "top.lensAria": "Lens: {name}. Change lens",
  "top.settingsAria": "Settings: aperture {f}, shutter {s}, {iso}",
  "tools.navAria": "{mode} tools",
  "tool.stopped": "{tool} stopped working",

  // Footer.
  "footer.disclaimer": "Independent tool, not affiliated with or endorsed by Leica Camera AG. Product names are trademarks of their owners.",
  "footer.specs": "Lens specs come from public sources; check them against Leica's datasheets. Distances are measured from the lens (thin-lens model).",
  "footer.photos": "Product photos: {credits}.",

  // Gear pickers.
  "picker.camera": "Choose a camera",
  "picker.lenses": "Lenses for the {body}",
  "picker.filter": "Filter",
  "picker.myGear": "My Gear",
  "picker.viaAdapter": "Via adapter",

  // Camera screen (aria and small text; engravings stay English).
  "cam.release": "Release the shutter",
  "cam.shutterDial": "Shutter speed dial",
  "cam.isoDial": "ISO dial",
  "cam.menu": "Menu",
  "cam.roll": "Roll: your frames",
  "cam.play": "Play: review pictures",
  "cam.fn": "FN: choose the scene",
  "cam.scene": "Scene",
  "cam.sceneLight": "Scene light",
  "cam.liveOn": "Live on: back to the scene",
  "cam.liveOff": "Live: use your phone's camera",
  "cam.simulated": "Simulated exposure",
  "cam.meterHint": "Metering for a real camera? The light meter has spot readings and the equivalent settings.",
  "cam.showControls": "Show the camera controls",
  "cam.hideControls": "Viewfinder mode: hide the controls",
  "cam.pickBody": "Camera: {name}, change the camera",
  "cam.pickLens": "Lens: {name}, change the lens",
  "cam.withLens": "{body} with {lens}",
  "cam.evComp": "Exposure compensation",
  "play.title": "Review pictures",
  "play.empty": "No pictures on the card yet.",
  "play.prev": "Previous picture",
  "play.next": "Next picture",
};

export default en;
