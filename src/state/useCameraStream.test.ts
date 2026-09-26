import { describe, expect, it } from "vitest";
import { classifyStreamError } from "./useCameraStream";

describe("classifyStreamError", () => {
  it("maps a denied permission to the 'denied' status", () => {
    const { status, message } = classifyStreamError({ name: "NotAllowedError" });
    expect(status).toBe("denied");
    expect(message).toMatch(/denied/i);
  });

  it("maps a missing camera to the 'unsupported' status", () => {
    expect(classifyStreamError({ name: "NotFoundError" }).status).toBe("unsupported");
  });

  it("maps a camera already in use to the 'error' status with an explanatory message", () => {
    const { status, message } = classifyStreamError({ name: "NotReadableError" });
    expect(status).toBe("error");
    expect(message).toMatch(/in use/i);
  });

  it("maps an insecure context to 'unsupported' with an HTTPS hint", () => {
    const { status, message } = classifyStreamError({ name: "SecurityError" });
    expect(status).toBe("unsupported");
    expect(message).toMatch(/https/i);
  });

  it("falls back to 'error' with the error's own message for anything unrecognized", () => {
    const { status, message } = classifyStreamError(new Error("something odd"));
    expect(status).toBe("error");
    expect(message).toBe("something odd");
  });

  it("never throws on a non-error value", () => {
    expect(() => classifyStreamError("just a string")).not.toThrow();
    expect(() => classifyStreamError(null)).not.toThrow();
    expect(() => classifyStreamError(undefined)).not.toThrow();
  });
});
