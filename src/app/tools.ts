// App structure. Home is the camera itself (#/camera, feature #37); MENU
// (#/menu) lists the Master Plan's four modes, each a small set of tools, and
// a tool opens on its own page (#/learn/sunny16) so it can be linked. The
// existing query links (?recipe, ?try, ?demo, ?kiosk) keep working alongside.

export type ModeId = "simulate" | "learn" | "shoot" | "explore";

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
  { id: "explore", label: "Explore", job: "The cameras, the lenses and their history." },
];

export type ToolId =
  | "studio"
  | "motion"
  | "character"
  | "flare"
  | "perspective"
  | "iris"
  | "finder"
  | "finders"
  | "calibration"
  | "sunny16"
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
  | "camera3d"
  | "timeline"
  | "generations"
  | "trial";

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

  { id: "finder", mode: "learn", label: "Rangefinder focus", blurb: "Merge the two images in the patch, then take the shot.", stages: ["stage-finder"] },
  { id: "finders", mode: "learn", label: "Finders compared", blurb: "The same scene through each M body's viewfinder.", stages: ["stage-finder-compare"] },
  { id: "sunny16", mode: "learn", label: "Sunny 16", blurb: "Guess the exposure without a meter.", stages: ["stage-trainer"] },
  { id: "portrait", mode: "learn", label: "Portrait distance", blurb: "Where to stand for a head, a half or a full figure.", stages: ["stage-portrait"] },
  { id: "stability", mode: "learn", label: "Steady hands", blurb: "How slow you can go handheld, measured with your phone.", stages: ["stage-stability"] },
  { id: "loading", mode: "learn", label: "Loading film", blurb: "Load each M body step by step.", stages: ["stage-loading"] },
  { id: "anatomy", mode: "learn", label: "Inside the camera", blurb: "Take the camera apart and slow the shutter down.", stages: ["stage-anatomy"] },
  { id: "calibration", mode: "learn", label: "Calibration", blurb: "What a misaligned rangefinder does to focus.", stages: ["stage-calibration"] },

  { id: "live", mode: "shoot", label: "Live view", blurb: "Your phone's camera with this lens's framing and a light meter.", stages: ["stage-live"] },
  { id: "intent", mode: "shoot", label: "Shooting intent", blurb: "Say what you want; get settings that do it.", stages: ["stage-intent"] },
  { id: "recipes", mode: "shoot", label: "Recipes", blurb: "Proven starting points for common situations.", stages: ["stage-recipes"] },
  { id: "roll", mode: "shoot", label: "Roll", blurb: "Your frames, notes and what they teach you.", stages: ["stage-roll", "stage-insights"] },
  { id: "darkroom", mode: "shoot", label: "Darkroom", blurb: "How development changes a black-and-white roll.", stages: ["stage-darkroom"] },
  { id: "longexp", mode: "shoot", label: "Long exposure", blurb: "Your camera on a tripod, this screen as the light.", stages: ["stage-longexp"] },

  { id: "camera3d", mode: "explore", label: "Virtual camera", blurb: "Turn the rings and dials on a 3D camera.", stages: ["stage-camera3d"] },
  { id: "timeline", mode: "explore", label: "Timeline", blurb: "Cameras and lenses through the years, with sources.", stages: ["stage-museum"] },
  { id: "generations", mode: "explore", label: "Lens generations", blurb: "One name, several designs: compare the versions.", stages: ["stage-generations"] },
  { id: "trial", mode: "explore", label: "Try before you buy", blurb: "What another focal length would frame from where you stand.", stages: ["stage-trial"] },
];

export const DEFAULT_TOOL: Record<ModeId, ToolId> = { simulate: "studio", learn: "finder", shoot: "live", explore: "camera3d" };

export function findTool(id: string | undefined): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsFor(mode: ModeId, available: (t: Tool) => boolean = () => true): Tool[] {
  return TOOLS.filter((t) => t.mode === mode && available(t));
}

export type Screen = "camera" | "menu" | "tool";

export interface Route {
  screen: Screen;
  /** The tool page's mode and tool (kept while on the camera, so MENU reopens where you were). */
  mode: ModeId;
  tool: ToolId;
}

export const HOME: Route = { screen: "camera", mode: "simulate", tool: "studio" };

/** `#/learn/sunny16` → a tool page; `#/menu` → the menu; a bare mode goes to its default tool; anything else is the camera. */
export function parseRoute(hash: string): Route {
  const [modePart, toolPart] = hash.replace(/^#\/?/, "").split("/");
  if (modePart === "menu") return { ...HOME, screen: "menu" };
  const mode = MODES.find((m) => m.id === modePart)?.id;
  if (!mode) return HOME;
  const tool = findTool(toolPart);
  return { screen: "tool", mode, tool: tool && tool.mode === mode ? tool.id : DEFAULT_TOOL[mode] };
}

export function routeHash(r: Route): string {
  if (r.screen === "camera") return "#/camera";
  if (r.screen === "menu") return "#/menu";
  return `#/${r.mode}/${r.tool}`;
}

/** The tool that renders a section class (for the tour's `reveal` and old anchors). */
export function toolForStage(stageClass: string): Tool | undefined {
  return TOOLS.find((t) => t.stages.includes(stageClass));
}
