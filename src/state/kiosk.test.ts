import { describe, expect, it } from "vitest";
import { DEFAULT_IDLE_SEC, KIOSK_HOME, idlePhase, keysToClear, kioskReducer, parseKiosk, warningSec } from "./kiosk";

describe("config", () => {
  it("is off without ?kiosk, on with it, with a clamped idle timeout", () => {
    expect(parseKiosk("").enabled).toBe(false);
    expect(parseKiosk("?kiosk")).toEqual({ enabled: true, idleSec: DEFAULT_IDLE_SEC });
    expect(parseKiosk("?kiosk=120").idleSec).toBe(120);
    expect(parseKiosk("?kiosk=1").idleSec).toBe(5);
    expect(parseKiosk("?kiosk=99999").idleSec).toBe(3600);
    expect(parseKiosk("?kiosk=abc").idleSec).toBe(DEFAULT_IDLE_SEC);
  });
});

describe("guided flow", () => {
  it("home → body → lens → try, and only with a body and lens", () => {
    let s = kioskReducer(KIOSK_HOME, { type: "start" });
    expect(s.step).toBe("body");
    expect(kioskReducer(s, { type: "tryIt" })).toBe(s);
    s = kioskReducer(s, { type: "chooseBody", bodyId: "m6" });
    expect(s).toEqual({ step: "lens", bodyId: "m6", lensId: null });
    expect(kioskReducer(s, { type: "tryIt" }).step).toBe("lens");
    s = kioskReducer(s, { type: "attachLens", lensId: "m-50-2" });
    s = kioskReducer(s, { type: "tryIt" });
    expect(s).toEqual({ step: "try", bodyId: "m6", lensId: "m-50-2" });
  });

  it("back steps out; reset always returns a clean home (acceptance)", () => {
    const lens = { step: "lens" as const, bodyId: "m6", lensId: "m-50-2" };
    expect(kioskReducer(lens, { type: "back" })).toEqual({ step: "body", bodyId: "m6", lensId: null });
    expect(kioskReducer({ ...KIOSK_HOME, step: "body" }, { type: "back" })).toEqual(KIOSK_HOME);
    expect(kioskReducer({ step: "try", bodyId: "m6", lensId: "m-50-2" }, { type: "reset" })).toEqual(KIOSK_HOME);
  });

  it("choosing another body drops the attached lens", () => {
    const s = kioskReducer({ step: "lens", bodyId: "m6", lensId: "m-50-2" }, { type: "chooseBody", bodyId: "m11" });
    expect(s.lensId).toBeNull();
  });
});

describe("idle timing", () => {
  it("warns before resetting", () => {
    expect(warningSec(90)).toBe(10);
    expect(warningSec(6)).toBe(2);
    expect(idlePhase(0, 10_000, 90).phase).toBe("active");
    expect(idlePhase(0, 81_000, 90)).toEqual({ phase: "warning", secondsLeft: 9 });
    expect(idlePhase(0, 90_000, 90).phase).toBe("reset");
  });
});

describe("reset scope", () => {
  it("clears the visitor's stored state but keeps venue settings", () => {
    const keys = ["rangefinder-last-used", "rangefinder-bag", "rangefinder-roll-development", "rangefinder-muted", "other-app"];
    expect(keysToClear(keys)).toEqual(["rangefinder-last-used", "rangefinder-bag", "rangefinder-roll-development"]);
  });
});
