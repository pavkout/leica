// App structure. Home is the camera itself (#/camera, feature #37); MENU
// (#/menu) lists the Master Plan's four modes, each a small set of tools, and
// a tool opens on its own page (#/learn/sunny16) so it can be linked. The
// existing query links (?recipe, ?try, ?demo, ?kiosk) keep working alongside.

export type ModeId = "simulate" | "learn" | "shoot" | "film" | "explore" | "collect";

export interface Mode {
  id: ModeId;
  label: string;
  /** What the mode is for, in one line. */
  job: string;
}

export const MODES: Mode[] = [
  { id: "simulate", label: "Simulate", job: "See what a setting does to the picture." },
  { id: "learn", label: "Learn", job: "Practise the skills a rangefinder asks for." },
  { id: "shoot", label: "Shoot", job: "Take it out with your own camera." },
  { id: "film", label: "Film & darkroom", job: "Your film stock, developing, printing and scans." },
  { id: "explore", label: "Explore", job: "The cameras, the lenses and their history." },
  { id: "collect", label: "Collectors", job: "Keep track of what you own, and check what you might buy." },
];

export type ToolId =
  | "studio"
  | "motion"
  | "character"
  | "flare"
  | "perspective"
  | "iris"
  | "assignment"
  | "finder"
  | "finders"
  | "calibration"
  | "sunny16"
  | "guess"
  | "portrait"
  | "stability"
  | "loading"
  | "anatomy"
  | "live"
  | "intent"
  | "recipes"
  | "roll"
  | "darkroom"
  | "longexp"
  | "card"
  | "shotlog"
  | "zone"
  | "light"
  | "rfcheck"
  | "filmfinder"
  | "camera3d"
  | "timeline"
  | "generations"
  | "trial"
  | "kit"
  | "compat"
  | "collection"
  | "sounds"
  | "today"
  | "coding"
  | "serial"
  | "famous"
  | "identify"
  | "listing"
  | "aihelper"
  | "passport"
  | "health"
  | "lab"
  | "walks"
  | "matcher"
  | "develop"
  | "negative"
  | "filmstock"
  | "travel"
  | "sun"
  | "tagscans"
  | "printing"
  | "calcs"
  | "feedback"
  | "care";

export interface Tool {
  id: ToolId;
  mode: ModeId;
  label: string;
  /** One plain sentence: what you do here. */
  blurb: string;
  /** Section classes this tool renders, so the tour and links can find them. */
  stages: string[];
}

export const TOOLS: Tool[] = [
  { id: "studio", mode: "simulate", label: "Studio", blurb: "See what's sharp in the picture, and why.", stages: ["stage-preview", "stage-scene", "stage-barrel", "readouts", "stage-exposure", "stage-setup", "stage-details"] },
  { id: "motion", mode: "simulate", label: "Motion blur", blurb: "How shutter speed freezes or smears movement.", stages: ["stage-motion"] },
  { id: "character", mode: "simulate", label: "Lens character", blurb: "What sets this lens apart, with where each fact comes from.", stages: ["stage-dna"] },
  { id: "flare", mode: "simulate", label: "Flare", blurb: "Point the lens at the light and watch what happens.", stages: ["stage-flare"] },
  { id: "perspective", mode: "simulate", label: "Perspective", blurb: "Distance changes perspective; focal length only crops.", stages: ["stage-perspective"] },
  { id: "iris", mode: "simulate", label: "Aperture iris", blurb: "The blades behind every out-of-focus highlight.", stages: ["stage-iris"] },

  { id: "assignment", mode: "learn", label: "Today's assignment", blurb: "One brief a day. Shoot it, hand it in, keep the streak.", stages: ["stage-assignment"] },
  { id: "lab", mode: "learn", label: "Photography Lab", blurb: "A course for your own camera: shoot each exercise, hand in the photo, and see if it did what you meant.", stages: ["stage-lab"] },
  { id: "feedback", mode: "learn", label: "Photo feedback", blurb: "Show one of your pictures to an AI teacher: what works, what to change, one thing to try next.", stages: ["stage-feedback"] },
  { id: "finder", mode: "learn", label: "Rangefinder focus", blurb: "Merge the two images in the patch, then take the shot.", stages: ["stage-finder"] },
  { id: "finders", mode: "learn", label: "Finders compared", blurb: "The same scene through each M body's viewfinder.", stages: ["stage-finder-compare"] },
  { id: "sunny16", mode: "learn", label: "Sunny 16", blurb: "Guess the exposure without a meter.", stages: ["stage-trainer"] },
  { id: "guess", mode: "learn", label: "Guess the lens", blurb: "Name the focal length and aperture from the picture alone.", stages: ["stage-guess"] },
  { id: "portrait", mode: "learn", label: "Portrait distance", blurb: "Where to stand for a head, a half or a full figure.", stages: ["stage-portrait"] },
  { id: "stability", mode: "learn", label: "Steady hands", blurb: "How slow you can go handheld, measured with your phone.", stages: ["stage-stability"] },
  { id: "loading", mode: "learn", label: "Loading film", blurb: "Load each M body step by step.", stages: ["stage-loading"] },
  { id: "anatomy", mode: "learn", label: "Inside the camera", blurb: "Take the camera apart and slow the shutter down.", stages: ["stage-anatomy"] },
  { id: "rfcheck", mode: "learn", label: "Check your rangefinder", blurb: "Print a target, photograph it, and see if your camera front- or back-focuses.", stages: ["stage-rfcheck"] },
  { id: "calibration", mode: "learn", label: "Calibration", blurb: "What a misaligned rangefinder does to focus.", stages: ["stage-calibration"] },

  { id: "live", mode: "shoot", label: "Light meter", blurb: "Point your phone at the scene; get the settings for the camera in your hands.", stages: ["stage-live"] },
  { id: "intent", mode: "shoot", label: "Shooting intent", blurb: "Say what you want; get settings that do it.", stages: ["stage-intent"] },
  { id: "filmfinder", mode: "shoot", label: "Film finder", blurb: "Which film for what you'll shoot, the light and the look you want.", stages: ["stage-film"] },
  { id: "recipes", mode: "shoot", label: "Recipes", blurb: "Proven starting points for common situations.", stages: ["stage-recipes"] },
  { id: "roll", mode: "shoot", label: "Roll", blurb: "Your frames, notes and what they teach you.", stages: ["stage-roll", "stage-insights"] },
  { id: "darkroom", mode: "shoot", label: "Darkroom", blurb: "How development changes a black-and-white roll.", stages: ["stage-darkroom"] },
  { id: "walks", mode: "shoot", label: "Photo walks", blurb: "A theme, one lens set for zone focus, pictures to find and the best light today. Send it to a friend to walk together.", stages: ["stage-walks"] },
  { id: "calcs", mode: "shoot", label: "Exposure calculators", blurb: "Long exposures through ND filters with your film's reciprocity correction, and flash by guide number.", stages: ["stage-calcs"] },
  { id: "sun", mode: "shoot", label: "Sun finder", blurb: "Where the sun will be at any time, on a compass or over your camera view, and what the clouds mean for the golden hours.", stages: ["stage-sun"] },
  { id: "travel", mode: "shoot", label: "Travel kit", blurb: "The airport card asking for a hand check of your film, in the local language; a packing list; and proof of ownership for customs.", stages: ["stage-travel"] },
  { id: "light", mode: "shoot", label: "Light planner", blurb: "When the light is good today, and what to set for it.", stages: ["stage-light"] },
  { id: "zone", mode: "shoot", label: "Zone coach", blurb: "Big, glanceable zone focus for a walk: what to set and what's sharp.", stages: ["stage-zone"] },
  { id: "shotlog", mode: "shoot", label: "Shot log", blurb: "Note every frame on your real camera; match the scans when they're back.", stages: ["stage-shotlog"] },
  { id: "card", mode: "shoot", label: "Pocket card", blurb: "A printable card for your camera bag: zone focus and exposure without a meter.", stages: ["stage-card"] },
  { id: "longexp", mode: "shoot", label: "Long exposure", blurb: "Your camera on a tripod, this screen as the light.", stages: ["stage-longexp"] },

  { id: "filmstock", mode: "film", label: "Film stock", blurb: "The film in your fridge and in each camera: what's loaded, what's left, what's expiring.", stages: ["stage-filmstock"] },
  { id: "develop", mode: "film", label: "Developing timer", blurb: "The datasheet time for your film and developer, then every step on a clock with agitation cues.", stages: ["stage-develop"] },
  { id: "negative", mode: "film", label: "Negative viewer", blurb: "Point your phone at a negative and see the positive, live. Or make this screen the light table.", stages: ["stage-negative"] },
  { id: "printing", mode: "film", label: "Printing", blurb: "An enlarger timer that runs your test strip, print-size changes, and chemistry you can count.", stages: ["stage-printing"] },
  { id: "tagscans", mode: "film", label: "Tag your scans", blurb: "Write each frame's camera, lens, settings and film from the Shot log into your scans, for Lightroom and photo apps.", stages: ["stage-tagscans"] },
  { id: "today", mode: "explore", label: "Today in the museum", blurb: "One camera or lens a day, with its history.", stages: ["stage-today"] },
  { id: "famous", mode: "explore", label: "Famous frames", blurb: "Pictures made with a Leica, the gear behind them, and the lens to try.", stages: ["stage-famous"] },
  { id: "camera3d", mode: "explore", label: "Virtual camera", blurb: "Turn the rings and dials on a 3D camera.", stages: ["stage-camera3d"] },
  { id: "timeline", mode: "explore", label: "Timeline", blurb: "Cameras and lenses through the years, with sources.", stages: ["stage-museum"] },
  { id: "generations", mode: "explore", label: "Lens generations", blurb: "One name, several designs: compare the versions.", stages: ["stage-generations"] },
  { id: "compat", mode: "explore", label: "Will it fit?", blurb: "Any lens on any camera: mount, adapter, frame lines and Leica's warnings.", stages: ["stage-compat"] },
  { id: "sounds", mode: "explore", label: "Sound library", blurb: "Every shutter mechanism and camera sound, drawn and played.", stages: ["stage-sounds"] },
  { id: "coding", mode: "explore", label: "Lens coding", blurb: "The 6-bit code on an M lens: look it up, or read it off the lens in your hand.", stages: ["stage-coding"] },
  { id: "kit", mode: "explore", label: "Kit planner", blurb: "Plan the bag for a trip: what's covered, what's missing, which two to take.", stages: ["stage-kit"] },
  { id: "matcher", mode: "explore", label: "Which Leica for me?", blurb: "Six plain questions: a camera and lenses that suit you, with the reasons, to try here before a shop.", stages: ["stage-matcher"] },
  { id: "trial", mode: "explore", label: "Try before you buy", blurb: "What another focal length would frame from where you stand.", stages: ["stage-trial"] },

  { id: "collection", mode: "collect", label: "My collection", blurb: "Every camera, lens and accessory you own, in one place. Printable for insurance.", stages: ["stage-collection"] },
  { id: "passport", mode: "collect", label: "Camera passport", blurb: "Your camera's life story: where it came from, every service, its condition. Hand it to the next owner when you sell.", stages: ["stage-passport"] },
  { id: "health", mode: "collect", label: "Camera health check", blurb: "Test a real camera with your phone: shutter speeds by sound, then a guided check of everything else.", stages: ["stage-health"] },
  { id: "care", mode: "collect", label: "Manuals and care", blurb: "Each camera's manual, when it was last serviced, your workshops, and the habits that keep old cameras working.", stages: ["stage-care"] },
  { id: "identify", mode: "collect", label: "What is this?", blurb: "Take a photo of a camera or lens. We'll tell you what it is and read its serial number.", stages: ["stage-identify"] },
  { id: "listing", mode: "collect", label: "Before you buy", blurb: "Paste a link to something for sale. We'll check it and compare the price.", stages: ["stage-listing"] },
  { id: "serial", mode: "collect", label: "Serial numbers", blurb: "Type a serial number: which camera it is, or when your lens was made.", stages: ["stage-serial"] },
  { id: "aihelper", mode: "collect", label: "AI helper", blurb: "Turn on the photo and price tools, choose how much to spend, and see what you've spent.", stages: ["stage-aihelper"] },
];

export const DEFAULT_TOOL: Record<ModeId, ToolId> = { simulate: "studio", learn: "assignment", shoot: "live", film: "filmstock", explore: "today", collect: "collection" };

/** Tools that moved to another mode: their old links still open them. */
const MOVED: Partial<Record<ModeId, ToolId[]>> = { explore: ["collection", "serial"] };

export function findTool(id: string | undefined): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsFor(mode: ModeId, available: (t: Tool) => boolean = () => true): Tool[] {
  return TOOLS.filter((t) => t.mode === mode && available(t));
}

/** "museum" is the full-screen museum (#39); it keeps its own place inside `#/museum/…`. */
export type Screen = "camera" | "menu" | "tool" | "museum";

export interface Route {
  screen: Screen;
  /** The tool page's mode and tool (kept while on the camera, so MENU reopens where you were). */
  mode: ModeId;
  tool: ToolId;
}

export const HOME: Route = { screen: "camera", mode: "simulate", tool: "studio" };

/** `#/learn/sunny16` → a tool page; `#/menu` → the menu; a bare mode goes to its default tool; anything else is the camera. */
export function parseRoute(hash: string): Route {
  // A tool may carry a query (#/collect/health?item=…); it belongs to the tool, not the route.
  const [modePart, toolPart] = hash.replace(/^#\/?/, "").split("?")[0].split("/");
  if (modePart === "menu") return { ...HOME, screen: "menu" };
  if (modePart === "museum") return { ...HOME, screen: "museum" };
  const mode = MODES.find((m) => m.id === modePart)?.id;
  if (!mode) return HOME;
  const tool = findTool(toolPart);
  if (tool && tool.mode !== mode && MOVED[mode]?.includes(tool.id)) return { screen: "tool", mode: tool.mode, tool: tool.id };
  return { screen: "tool", mode, tool: tool && tool.mode === mode ? tool.id : DEFAULT_TOOL[mode] };
}

export function routeHash(r: Route): string {
  if (r.screen === "camera") return "#/camera";
  if (r.screen === "menu") return "#/menu";
  if (r.screen === "museum") return "#/museum";
  return `#/${r.mode}/${r.tool}`;
}

/** The tool that renders a section class (for the tour's `reveal` and old anchors). */
export function toolForStage(stageClass: string): Tool | undefined {
  return TOOLS.find((t) => t.stages.includes(stageClass));
}
