import { describe, expect, it } from "vitest";
import { AGITATION_PRESETS, agitatingAt, clock, parseMinSec, cues, elapsedSec, filmSteps, pause, resume, skip, stateAt, totalSeconds } from "./devTimer";

const kodak = AGITATION_PRESETS.find((p) => p.id === "kodak")!.agitation;
const ilford = AGITATION_PRESETS.find((p) => p.id === "ilford")!.agitation;

describe("agitation", () => {
  it("follows Kodak's every-30-seconds pattern", () => {
    expect(agitatingAt(kodak, 0)).toBe(true);
    expect(agitatingAt(kodak, 29)).toBe(true);
    expect(agitatingAt(kodak, 31)).toBe(false);
    expect(agitatingAt(kodak, 60)).toBe(true);
    expect(agitatingAt(kodak, 64)).toBe(true);
    expect(agitatingAt(kodak, 66)).toBe(false);
  });
  it("follows Ilford's once-a-minute pattern, and stand stays still", () => {
    expect(agitatingAt(ilford, 5)).toBe(true);
    expect(agitatingAt(ilford, 30)).toBe(false);
    expect(agitatingAt(ilford, 72)).toBe(true);
    const stand = AGITATION_PRESETS.find((p) => p.id === "stand")!.agitation;
    expect(agitatingAt(stand, 600)).toBe(false);
  });
});

describe("a film run", () => {
  const steps = filmSteps(6.75 * 60, kodak);
  it("lays out develop, stop, fix, wash and wetting agent", () => {
    expect(steps.map((s) => s.kind)).toEqual(["develop", "stop", "fix", "wash", "wetting"]);
    expect(totalSeconds(steps)).toBe(405 + 60 + 300 + 600 + 30);
  });
  it("knows where it is at any moment", () => {
    expect(stateAt(steps, 0)).toMatchObject({ step: 0, agitating: true, done: false });
    expect(stateAt(steps, 400)).toMatchObject({ step: 0, draining: true });
    expect(stateAt(steps, 406)).toMatchObject({ step: 1, inStep: 1 });
    expect(stateAt(steps, 99999).done).toBe(true);
  });
  it("cues agitation, rests, drains and the next step in order", () => {
    const c = cues(steps);
    expect(c[0]).toEqual({ at: 30, kind: "rest", step: 0 });
    expect(c.find((x) => x.kind === "agitate")?.at).toBe(60);
    expect(c.find((x) => x.kind === "drain")?.at).toBe(395);
    expect(c.find((x) => x.kind === "next")?.at).toBe(405);
    expect(c[c.length - 1].kind).toBe("done");
    for (let i = 1; i < c.length; i++) expect(c[i].at).toBeGreaterThanOrEqual(c[i - 1].at);
    // No agitation cue inside the last ten seconds, when the tank is being emptied.
    expect(c.filter((x) => x.step === 0 && x.kind === "agitate").every((x) => x.at < 395)).toBe(true);
  });
});

describe("the wall clock", () => {
  it("pauses, resumes and skips", () => {
    const steps = filmSteps(300, kodak);
    let run = { startedAt: 0, pausedMs: 0, pausedAt: null as number | null };
    expect(elapsedSec(run, 10_000)).toBe(10);
    run = pause(run, 10_000);
    expect(elapsedSec(run, 50_000)).toBe(10);
    run = resume(run, 50_000);
    expect(elapsedSec(run, 60_000)).toBe(20);
    run = skip(run, steps, 60_000);
    expect(stateAt(steps, elapsedSec(run, 60_000)).step).toBe(1);
  });
  it("formats the clock", () => {
    expect(clock(405)).toBe("6:45");
    expect(clock(0)).toBe("0:00");
    expect(clock(3725)).toBe("1:02:05");
  });
});

describe("typed times", () => {
  it("reads minutes:seconds, decimal minutes and seconds", () => {
    expect(parseMinSec("8:30")).toBe(510);
    expect(parseMinSec("8.5")).toBe(510);
    expect(parseMinSec("45s")).toBe(45);
    expect(parseMinSec("")).toBeNull();
    expect(parseMinSec("abc")).toBeNull();
  });
});
