import { describe, expect, it } from "vitest";
import { AiError, describeApiError } from "./errors";

describe("AI errors", () => {
  it("maps API statuses to plain-language kinds", () => {
    expect(describeApiError({ status: 401 }).kind).toBe("bad-key");
    expect(describeApiError({ status: 400, message: "Your credit balance is too low to access the Anthropic API." }).kind).toBe("no-credit");
    expect(describeApiError({ status: 529 }).kind).toBe("busy");
    expect(describeApiError({ status: 400, message: "bad" }).kind).toBe("other");
  });

  it("reads retry-after on rate limits", () => {
    const e = describeApiError({ status: 429, headers: { "retry-after": "12" } });
    expect(e.kind).toBe("rate-limit");
    expect(e.retryAfter).toBe(12);
  });

  it("treats a failed connection as offline and passes AiErrors through", () => {
    expect(describeApiError({ name: "APIConnectionError", message: "Connection error." }).kind).toBe("offline");
    const own = new AiError("limit", "x");
    expect(describeApiError(own)).toBe(own);
  });
});
