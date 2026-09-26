import { describe, expect, it, vi } from "vitest";
import { classifyMotionAccess, sampleFromEvent, subscribeMotion } from "./motionSensor";

describe("motion sensor adapter", () => {
  it("maps iOS permission outcomes, including denial, to clear statuses", () => {
    expect(classifyMotionAccess("granted")).toEqual({ status: "granted", message: null });
    expect(classifyMotionAccess("denied").status).toBe("denied");
    expect(classifyMotionAccess("denied").message).toMatch(/declined/);
    expect(classifyMotionAccess("default").status).toBe("denied");
    expect(classifyMotionAccess(Object.assign(new Error("x"), { name: "NotAllowedError" })).status).toBe("denied");
    expect(classifyMotionAccess(Object.assign(new Error("x"), { name: "SecurityError" })).status).toBe("unsupported");
    expect(classifyMotionAccess(new Error("boom"))).toEqual({ status: "error", message: "boom" });
  });

  it("ignores events without gyroscope data", () => {
    expect(sampleFromEvent({ rotationRate: null, timeStamp: 1 })).toBeNull();
    expect(sampleFromEvent({ rotationRate: { alpha: 1, beta: null, gamma: 2 }, timeStamp: 1 })).toBeNull();
    expect(sampleFromEvent({ rotationRate: { alpha: 9, beta: 1, gamma: 2 }, timeStamp: 5 })).toEqual({ t: 5, beta: 1, gamma: 2 });
  });

  it("stops delivering samples after unsubscribing", () => {
    const target = new EventTarget();
    const onSample = vi.fn();
    const fire = () => target.dispatchEvent(Object.assign(new Event("devicemotion"), { rotationRate: { alpha: 0, beta: 1, gamma: 1 } }));
    const stop = subscribeMotion(onSample, target as unknown as Window);
    fire();
    expect(onSample).toHaveBeenCalledTimes(1);
    stop();
    fire();
    expect(onSample).toHaveBeenCalledTimes(1);
  });
});
