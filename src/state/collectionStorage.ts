// Where My collection is kept on this device, shared by the collection page
// and the museum's "Your collection" room.

import { getString } from "../services/persistence";
import type { CollectionItem } from "./collection";

export const COLLECTION_KEY = "rangefinder-collection";

export function loadCollection(): CollectionItem[] {
  try {
    const list = JSON.parse(getString(COLLECTION_KEY) ?? "[]") as CollectionItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
