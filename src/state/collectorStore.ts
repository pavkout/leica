// Shared state for the Collectors pages (#38). Each page is its own tool and
// stays mounted once visited, so they share two things through here: the AI
// helper's settings (a change on the AI helper page reaches every page at
// once) and a draft item handed from "What is this?" or "Before you buy" to
// My collection, which opens it in the editor.

import { useSyncExternalStore } from "react";
import { loadAiSettings, saveAiSettings, type AiSettings } from "../services/ai/aiSettings";
import type { CollectionItem } from "./collection";

type Listener = () => void;
const listeners = new Set<Listener>();
const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

let settings: AiSettings | null = null;
let draft: CollectionItem | null = null;

function currentSettings(): AiSettings {
  if (!settings) settings = loadAiSettings();
  return settings;
}

/** Saves and shares new settings. Returns false when storage refused them (they still apply for this visit). */
export function updateAiSettings(next: AiSettings): boolean {
  settings = next;
  const ok = saveAiSettings(next);
  emit();
  return ok;
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, currentSettings, currentSettings);
}

/** Hands a draft to My collection and opens that page. */
export function sendDraftToCollection(item: CollectionItem): void {
  draft = item;
  emit();
  openCollectorPage("collection");
}

export function usePendingDraft(): CollectionItem | null {
  return useSyncExternalStore(subscribe, () => draft, () => draft);
}

export function takeDraft(): CollectionItem | null {
  const d = draft;
  draft = null;
  if (d) emit();
  return d;
}

export type CollectorPage = "collection" | "passport" | "health" | "care" | "identify" | "listing" | "serial" | "aihelper";

export function openCollectorPage(page: CollectorPage): void {
  if (typeof location !== "undefined") location.hash = `#/collect/${page}`;
}
