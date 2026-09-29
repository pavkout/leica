import type { Confidence } from "../../state/collection";

/** The AI's confidence in words anyone understands. */
export function sureness(c: Confidence): string {
  return c === "high" ? "Sure" : c === "medium" ? "Fairly sure" : "Not sure";
}
