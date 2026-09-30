import type { Confidence } from "../../state/collection";
import { t } from "../../i18n";

/** The AI's confidence in words anyone understands. */
export function sureness(c: Confidence): string {
  return t(`col.sure.${c}`);
}
