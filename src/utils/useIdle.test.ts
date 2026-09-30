import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchIdle } from "./useIdle";

describe("watchIdle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once after the quiet period", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(target, 30_000, onIdle);
    vi.advanceTimersByTime(29_999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("restarts the wait on activity", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    watchIdle(target, 30_000, onIdle);
    vi.advanceTimersByTime(20_000);
    target.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(20_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("stops when disposed", () => {
    const target = new EventTarget();
    const onIdle = vi.fn();
    const stop = watchIdle(target, 1000, onIdle);
    stop();
    target.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
